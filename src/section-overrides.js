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
    vars.push(`  --${name}: ${value};`)
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
 * - block.themeOverrides — the section's `theme:`, as @uniweb/core normalizes it:
 *   `{ colors, contexts, vars, tokens }` — a palette, tokens per color context, the
 *   foundation's variables, and tokens for the section in any context
 * - block.componentVars — merged meta.js defaults + frontmatter overrides
 * - block.standardOptions — ⚠️ the older editor envelope, `{ colors, foundationStyles }`,
 *   read by its own rules until an editor writes the section's `theme` instead
 * - block.childBlocks — child sections get the same, at any depth: rendered as sections,
 *   they carry the `#section-{id}` these rules select [2026-09-28]
 *
 * ⭐ Which context's values apply, for the section's `theme`: a pinned section uses its own
 * context's; a section that follows the site (Auto) uses `light` under a light scheme and
 * `dark` under `.scheme-dark` — two rules, so no knowledge of whether the site can go dark
 * is needed. A context's own token beats one written beside `mode`, being more specific.
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
    css += buildBlockRules(block, appearance || {})
    if (Array.isArray(block.childBlocks) && block.childBlocks.length > 0) {
      css += buildSectionOverrides(block.childBlocks, appearance)
    }
  }
  return css
}

/**
 * The rules for one section: declarations for any scheme, and for an Auto section under a
 * light and under a dark scheme.
 */
function buildBlockRules(block, appearance) {
  const selector = `#section-${block.stableId || block.id}`
  const isAuto = !block.themeName
  const always = []
  const light = []
  const dark = []

  // ⚠️ The older editor envelope — its rules unchanged, the `light` bucket without a toggle
  // included, so an editor sending it renders as before.
  const legacy = block.standardOptions
  const compVars = buildFoundationVars(block.componentVars)
  if (hasOverrides(legacy)) {
    const { colors, foundationStyles } = legacy
    const hasToggle = appearance.allowToggle
    const paletteVars = buildPaletteVars(colors?.colors?.light)
    const { flat: flatFoundation, contexts: ctxFoundation } = splitFoundationStyles(foundationStyles)
    const foundationVars = buildFoundationVars(flatFoundation)
    if (isAuto && hasToggle) {
      always.push(...paletteVars, ...foundationVars, ...compVars)
      light.push(...buildElementVars(colors?.elements?.light), ...buildFoundationVars(ctxFoundation.light))
      dark.push(...buildElementVars(colors?.elements?.dark), ...buildFoundationVars(ctxFoundation.dark))
    } else {
      const ctx = hasToggle ? (block.themeName || 'light') : 'light'
      always.push(
        ...paletteVars,
        ...buildElementVars(colors?.elements?.[ctx]),
        ...foundationVars,
        ...compVars,
        ...buildFoundationVars(ctxFoundation[ctx])
      )
    }
  } else {
    always.push(...compVars)
  }

  // The section's `theme:` — theme.yml's keys, scoped to the section.
  const theme = block.themeOverrides
  const themeDark = []
  if (theme) {
    const { flat, contexts: ctxVars } = splitFoundationStyles(theme.vars)
    always.push(...buildPaletteVars(theme.colors), ...buildFoundationVars(flat), ...buildElementVars(theme.tokens))
    if (isAuto) {
      light.push(...buildElementVars(theme.contexts?.light), ...buildFoundationVars(ctxVars.light))
      themeDark.push(...buildElementVars(theme.contexts?.dark), ...buildFoundationVars(ctxVars.dark))
      dark.push(...themeDark)
    } else {
      always.push(...buildElementVars(theme.contexts?.[block.themeName]), ...buildFoundationVars(ctxVars[block.themeName]))
    }
  }

  return (
    buildRule(selector, always) +
    buildRule(`:root:not(.scheme-dark) ${selector}`, light) +
    buildRule(`.scheme-dark ${selector}`, dark) +
    // A site that follows the visitor's system goes dark through a media query before any
    // class is set — as the theme's own dark tokens do (`generateDarkSchemeCSS`) — so the
    // section's dark values follow it there too. Same specificity as the light rule, later.
    (appearance.default === 'system' && themeDark.length > 0
      ? `@media (prefers-color-scheme: dark) {\n${buildRule(`:root:not(.scheme-light) ${selector}`, themeDark)}}\n`
      : '')
  )
}
