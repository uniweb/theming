/**
 * Section Override CSS Builder
 *
 * Builds a single CSS string from all section-level overrides on a page.
 * Follows the same pattern as buildTheme() for global CSS:
 * all overrides are pre-built into a <style id="uniweb-page-overrides"> tag.
 *
 * @module @uniweb/theming/section-overrides
 */

import { generatePalettes } from './shade-generator.js'
import { normalizeTokenValue } from './normalize.js'

/**
 * Check if a block has any section-level overrides worth emitting.
 *
 * @param {Object} standardOptions - Block's standardOptions
 * @returns {boolean}
 */
function hasOverrides(standardOptions) {
  if (!standardOptions) return false

  const { colors, foundationStyles } = standardOptions

  if (foundationStyles && Object.keys(foundationStyles).length > 0) return true
  if (!colors) return false

  const hasColors =
    colors.colors?.light && Object.keys(colors.colors.light).length > 0
  const hasElements =
    colors.elements &&
    Object.values(colors.elements).some(
      (ctx) => ctx && Object.keys(ctx).length > 0
    )

  return hasColors || hasElements
}

/**
 * Build CSS variable declarations for base palette overrides.
 * Base palette is context-independent — always stored under the 'light' key.
 *
 * @param {Object} baseColors - e.g. { primary: "#3b82f6", accent: "#f59e0b" }
 * @returns {string[]} CSS declaration lines
 */
function buildPaletteVars(baseColors) {
  if (!baseColors || Object.keys(baseColors).length === 0) return []

  const vars = []
  const palettes = generatePalettes(baseColors)

  for (const [name, shades] of Object.entries(palettes)) {
    for (const [level, value] of Object.entries(shades)) {
      vars.push(`  --${name}-${level}: ${value};`)
    }
  }

  return vars
}

/**
 * Build CSS variable declarations for semantic token overrides.
 *
 * @param {Object} elements - e.g. { heading: "rgba(var(--primary-900) / 1.00)", ... }
 * @returns {string[]} CSS declaration lines
 */
function buildElementVars(elements) {
  if (!elements || Object.keys(elements).length === 0) return []

  const vars = []
  for (const [token, value] of Object.entries(elements)) {
    if (value === '' || value == null) continue
    vars.push(`  --${token}: ${normalizeTokenValue(value)};`)
  }
  return vars
}

/**
 * Build CSS variable declarations for foundation style overrides.
 *
 * @param {Object} styles - e.g. { "border-radius": "0.5rem" }
 * @returns {string[]} CSS declaration lines
 */
function buildFoundationVars(styles) {
  if (!styles || Object.keys(styles).length === 0) return []

  const vars = []
  for (const [name, value] of Object.entries(styles)) {
    if (value === '' || value == null) continue
    vars.push(`  --${name}: ${value};`)
  }
  return vars
}

/**
 * Build a CSS rule for a section with its overrides.
 *
 * @param {string} selector - CSS selector (e.g. "#section-42")
 * @param {string[]} vars - CSS declaration lines
 * @returns {string} CSS rule string (empty if no vars)
 */
function buildRule(selector, vars) {
  if (vars.length === 0) return ''
  return `${selector} {\n${vars.join('\n')}\n}\n`
}

/**
 * Build section override CSS for all blocks on a page.
 *
 * Takes an array of block-like objects and appearance config,
 * returns a CSS string ready for injection into a <style> tag.
 *
 * Works with both Block instances and plain data objects — only reads:
 * - block.stableId || block.id — for CSS selector
 * - block.themeName — '' for Auto, 'light'/'medium'/'dark' for Pinned
 * - block.standardOptions — { colors, foundationStyles }
 *
 * @param {Array<Object>} blocks - Block data objects
 * @param {Object} appearance - Theme appearance config
 * @param {boolean} appearance.allowToggle - Whether scheme toggle is enabled
 * @param {string} appearance.default - Default scheme ('light' or 'dark')
 * @returns {string} CSS string (empty if no overrides)
 */
export function buildSectionOverrides(blocks, appearance = {}) {
  if (!blocks || blocks.length === 0) return ''

  let css = ''

  for (const block of blocks) {
    if (!hasOverrides(block.standardOptions)) continue

    const { colors, foundationStyles } = block.standardOptions
    const sectionId = block.stableId || block.id
    const selector = `#section-${sectionId}`

    const isAuto = !block.themeName
    const hasToggle = appearance.allowToggle

    // Base palette is context-independent (always under 'light' key)
    const paletteVars = buildPaletteVars(colors?.colors?.light)

    // Foundation styles are context-independent
    const foundationVars = buildFoundationVars(foundationStyles)

    if (isAuto && hasToggle) {
      // Dual rules: light context + dark override
      const lightElementVars = buildElementVars(colors?.elements?.light)
      const darkElementVars = buildElementVars(colors?.elements?.dark)

      // Main rule: palette + light elements + foundation styles
      const mainVars = [...paletteVars, ...lightElementVars, ...foundationVars]
      css += buildRule(selector, mainVars)

      // Dark override: only dark-specific element tokens
      css += buildRule(`.scheme-dark ${selector}`, darkElementVars)
    } else {
      // Single context: pinned context or site default
      const ctx = block.themeName || appearance.default || 'light'
      const elementVars = buildElementVars(colors?.elements?.[ctx])

      const allVars = [...paletteVars, ...elementVars, ...foundationVars]
      css += buildRule(selector, allVars)
    }
  }

  return css
}
