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
    if (value === '' || value == null || typeof value === 'object') continue
    vars.push(`  --foundation-${name}: ${value};`)
  }
  return vars
}

/**
 * Split foundation styles into flat (context-independent) and
 * context-keyed (color/gradient) values.
 *
 * Flat values: { "radius-xl": "1.5rem" }
 * Context-keyed values: { "colorful-bg": { light: "linear-gradient(...)", dark: "..." } }
 *
 * @param {Object} styles - Foundation styles object
 * @returns {{ flat: Object, contexts: Object }} - flat styles + { light: {...}, dark: {...} }
 */
function splitFoundationStyles(styles) {
  if (!styles || Object.keys(styles).length === 0) return { flat: {}, contexts: {} }

  const flat = {}
  const contexts = {}

  for (const [name, value] of Object.entries(styles)) {
    if (value == null) continue
    if (typeof value === 'object') {
      // Context-keyed: { light: "...", dark: "..." }
      for (const [ctx, ctxVal] of Object.entries(value)) {
        if (ctxVal === '' || ctxVal == null) continue
        if (!contexts[ctx]) contexts[ctx] = {}
        contexts[ctx][name] = ctxVal
      }
    } else {
      flat[name] = value
    }
  }

  return { flat, contexts }
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
 * - block.componentVars — merged meta.js defaults + frontmatter overrides
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
    const hasStandardOverrides = hasOverrides(block.standardOptions)
    const hasComponentVars = block.componentVars && Object.keys(block.componentVars).length > 0

    if (!hasStandardOverrides && !hasComponentVars) continue

    const { colors, foundationStyles } = block.standardOptions || {}
    const sectionId = block.stableId || block.id
    const selector = `#section-${sectionId}`

    const isAuto = !block.themeName
    const hasToggle = appearance.allowToggle

    // Base palette is context-independent (always under 'light' key)
    const paletteVars = buildPaletteVars(colors?.colors?.light)

    // Split foundation styles: flat (context-independent) + context-keyed (color/gradient)
    const { flat: flatFoundation, contexts: ctxFoundation } = splitFoundationStyles(foundationStyles)
    const foundationVars = buildFoundationVars(flatFoundation)

    // Component-level CSS vars are context-independent
    const compVars = buildFoundationVars(block.componentVars)

    if (isAuto && hasToggle) {
      // Dual rules: light-scoped elements + dark-scoped elements
      const lightElementVars = buildElementVars(colors?.elements?.light)
      const darkElementVars = buildElementVars(colors?.elements?.dark)

      // Context-aware foundation vars (color/gradient types)
      const lightFoundationCtx = buildFoundationVars(ctxFoundation.light)
      const darkFoundationCtx = buildFoundationVars(ctxFoundation.dark)

      // Context-independent rule: palette + flat foundation + component vars (apply in both schemes)
      const sharedVars = [...paletteVars, ...foundationVars, ...compVars]
      css += buildRule(selector, sharedVars)

      // Light-only overrides (elements + context-aware foundation vars)
      css += buildRule(`:root:not(.scheme-dark) ${selector}`, [...lightElementVars, ...lightFoundationCtx])

      // Dark-only overrides (elements + context-aware foundation vars)
      css += buildRule(`.scheme-dark ${selector}`, [...darkElementVars, ...darkFoundationCtx])
    } else {
      // Single context: when toggle is off, always use 'light' bucket
      // (overrides are context-independent); when toggle is on, use pinned context
      const ctx = hasToggle ? (block.themeName || 'light') : 'light'
      const elementVars = buildElementVars(colors?.elements?.[ctx])
      const ctxFoundationVars = buildFoundationVars(ctxFoundation[ctx])

      const allVars = [...paletteVars, ...elementVars, ...foundationVars, ...compVars, ...ctxFoundationVars]
      css += buildRule(selector, allVars)
    }
  }

  return css
}
