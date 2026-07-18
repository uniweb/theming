/**
 * Theme Processor
 *
 * Reads, validates, and processes theme configuration from theme.yml,
 * merges with foundation defaults, and produces a complete theme config
 * ready for CSS generation.
 *
 * @module @uniweb/theming/processor
 */

import { isValidColor, generatePalettes } from './shade-generator.js'
import { getDefaultColors, getDefaultContextTokens } from './css-generator.js'
import { normalizeTokenValue } from './normalize.js'

/**
 * Named neutral presets mapping to Tailwind gray families
 */
const NEUTRAL_PRESETS = {
  stone: '#78716c',
  zinc: '#71717a',
  gray: '#6b7280',
  slate: '#64748b',
  neutral: '#737373',
}

/**
 * Default inline text styles (content-author markdown: [text]{accent})
 * These reference semantic tokens so they adapt to context automatically
 */
const DEFAULT_INLINE = {
  accent: {
    color: 'var(--link)',
    'font-weight': '600',
  },
  callout: {
    color: 'var(--accent)',
    'font-weight': '600',
  },
  muted: {
    color: 'var(--subtle)',
  },
}

/**
 * Default appearance configuration
 */
const DEFAULT_APPEARANCE = {
  default: 'light',        // Default color scheme
  allowToggle: false,      // Whether to show scheme toggle
  respectSystemPreference: true, // Honor prefers-color-scheme
}

/**
 * Default font configuration
 */
const DEFAULT_FONTS = {
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  code: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
}

/**
 * Default application selectors for the three built-in font roles. These are
 * *defaults*: a foundation can redefine a role's `applyTo` (or add new roles)
 * via a `type: 'font'` var, so the roles and their selectors are one editable
 * font-var namespace, not a fixed contract. `heading` is scoped to h1–h3 (h4–h6
 * render near body size, where a display face reads awkwardly); `code` (formerly
 * `mono`) owns `--font-code`.
 */
const DEFAULT_FONT_ROLES = {
  body: ['body'],
  heading: ['h1', 'h2', 'h3'],
  code: ['code', 'pre', 'kbd', 'samp'],
}

// Foundation `font-*` vars that are CSS longhands, not typefaces to load.
const NON_FAMILY_FONT_VARS = new Set([
  'font-weight', 'font-style', 'font-size', 'font-stretch',
  'font-feature-settings', 'font-variation-settings', 'font-variant',
  'font-kerning', 'font-optical-sizing', 'font-synthesis',
  'font-size-adjust', 'font-smoothing', 'font-palette', 'font-language-override',
])

/**
 * A foundation var is a themeable typeface (font role) when it declares
 * `type: 'font'`. Deprecated fallback: a `font-*`-prefixed name that isn't a
 * known CSS longhand — kept so foundations predating the convention still work.
 */
function isFontVar(name, config) {
  const type = typeof config === 'object' ? config?.type : undefined
  if (type === 'font') return true
  return name.startsWith('font-') && !NON_FAMILY_FONT_VARS.has(name)
}

// A font role's canonical name is bare; `font-X` and `X` are the same role.
function normalizeFontRoleName(name) {
  return name.startsWith('font-') ? name.slice(5) : name
}

// Normalize applyTo to an array of trimmed selectors (or null).
function normalizeApplyTo(applyTo) {
  if (applyTo == null) return null
  const list = Array.isArray(applyTo) ? applyTo : String(applyTo).split(',')
  const cleaned = list.map((s) => String(s).trim()).filter(Boolean)
  return cleaned.length ? cleaned : null
}

/**
 * Default code block theme configuration
 * Uses Shiki CSS variable names for compatibility
 * These values are NOT converted to CSS here - the kit's Code component
 * injects them at runtime only when code blocks are used (tree-shaking)
 */
const DEFAULT_CODE_THEME = {
  // Background and foreground
  background: '#1e1e2e',      // Dark editor background
  foreground: '#cdd6f4',      // Default text color

  // Syntax highlighting colors (Shiki token variables)
  keyword: '#cba6f7',         // Purple - keywords (if, else, function)
  string: '#a6e3a1',          // Green - strings
  number: '#fab387',          // Orange - numbers
  comment: '#6c7086',         // Gray - comments
  function: '#89b4fa',        // Blue - function names
  variable: '#f5e0dc',        // Light pink - variables
  operator: '#89dceb',        // Cyan - operators
  punctuation: '#9399b2',     // Gray - punctuation
  type: '#f9e2af',            // Yellow - types
  constant: '#f38ba8',        // Red - constants
  property: '#94e2d5',        // Teal - properties
  tag: '#89b4fa',             // Blue - HTML/JSX tags
  attribute: '#f9e2af',       // Yellow - attributes

  // UI elements
  lineNumber: '#6c7086',      // Line number color
  selection: '#45475a',       // Selection background
}

/**
 * Validate color configuration
 *
 * @param {Object} colors - Color configuration object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateColors(colors) {
  const errors = []

  if (!colors || typeof colors !== 'object') {
    return { valid: true, errors } // No colors is valid (use defaults)
  }

  for (const [name, value] of Object.entries(colors)) {
    // Skip pre-defined palette objects
    if (typeof value === 'object' && value !== null) {
      continue
    }

    if (typeof value !== 'string') {
      errors.push(`Color "${name}" must be a string or shade object, got ${typeof value}`)
      continue
    }

    // Accept neutral preset names (stone, zinc, gray, slate, neutral)
    if (name === 'neutral' && NEUTRAL_PRESETS[value]) {
      continue
    }

    if (!isValidColor(value)) {
      errors.push(`Color "${name}" has invalid value: ${value}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate context configuration
 *
 * @param {Object} contexts - Context configuration object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContexts(contexts) {
  const errors = []

  if (!contexts || typeof contexts !== 'object') {
    return { valid: true, errors }
  }

  const validContexts = ['light', 'medium', 'dark']

  for (const [context, tokens] of Object.entries(contexts)) {
    if (!validContexts.includes(context)) {
      errors.push(`Unknown context "${context}". Valid contexts: ${validContexts.join(', ')}`)
      continue
    }

    if (typeof tokens !== 'object' || tokens === null) {
      errors.push(`Context "${context}" must be an object`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate font configuration
 *
 * @param {Object} fonts - Font configuration object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFonts(fonts) {
  const errors = []

  if (!fonts || typeof fonts !== 'object') {
    return { valid: true, errors }
  }

  // Validate imports
  if (fonts.import !== undefined) {
    if (!Array.isArray(fonts.import)) {
      errors.push('fonts.import must be an array')
    } else {
      for (const [index, item] of fonts.import.entries()) {
        if (typeof item !== 'object' || !item.url) {
          errors.push(`fonts.import[${index}] must have a "url" property`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate appearance configuration
 *
 * @param {Object} appearance - Appearance configuration
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAppearance(appearance) {
  const errors = []

  if (!appearance || typeof appearance !== 'object') {
    // Simple string value (e.g., appearance: light)
    if (typeof appearance === 'string') {
      if (!['light', 'dark', 'system'].includes(appearance)) {
        errors.push(`Invalid appearance value: ${appearance}. Must be "light", "dark", or "system"`)
      }
    }
    return { valid: errors.length === 0, errors }
  }

  if (appearance.default && !['light', 'dark', 'system'].includes(appearance.default)) {
    errors.push(`Invalid appearance.default: ${appearance.default}`)
  }

  if (appearance.schemes !== undefined) {
    if (!Array.isArray(appearance.schemes)) {
      errors.push('appearance.schemes must be an array')
    } else {
      const validSchemes = ['light', 'dark']
      for (const scheme of appearance.schemes) {
        if (!validSchemes.includes(scheme)) {
          errors.push(`Invalid scheme: ${scheme}. Valid schemes: ${validSchemes.join(', ')}`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate code block theme configuration
 *
 * @param {Object} code - Code theme configuration
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCodeTheme(code) {
  const errors = []

  if (!code || typeof code !== 'object') {
    return { valid: true, errors } // No code config is valid (use defaults)
  }

  // Validate color values
  for (const [name, value] of Object.entries(code)) {
    if (typeof value !== 'string') {
      errors.push(`code.${name} must be a string, got ${typeof value}`)
      continue
    }

    // Basic color format check (hex, rgb, hsl, or color name)
    if (!isValidColor(value)) {
      errors.push(`code.${name} has invalid color value: ${value}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Context-aware var types (stored per light/dark context)
 */
const CONTEXT_AWARE_TYPES = new Set(['color', 'gradient'])

/**
 * Validate foundation variables configuration
 *
 * Accepts enriched var schema: { default, description, label, type, options, group, globalOnly, applyTo }
 * A `type: 'font'` var is a themeable typeface (family loads, schema tags it as
 * a font); its optional `applyTo` is a list of selectors the framework paints
 * `font-family: var(--<name>)` onto, like a built-in role.
 *
 * @param {Object} vars - Foundation variables
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFoundationVars(vars) {
  const errors = []

  if (!vars || typeof vars !== 'object') {
    return { valid: true, errors }
  }

  for (const [name, config] of Object.entries(vars)) {
    // Variable name validation
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
      errors.push(`Invalid variable name "${name}". Use lowercase letters, numbers, and hyphens.`)
    }

    // Config validation
    if (typeof config !== 'object' && typeof config !== 'string' && typeof config !== 'number') {
      errors.push(`Variable "${name}" must have a string, number, or config object value`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate complete theme configuration
 *
 * @param {Object} config - Raw theme configuration
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateThemeConfig(config) {
  const allErrors = []

  if (!config || typeof config !== 'object') {
    return { valid: true, errors: [] } // Empty config is valid (use all defaults)
  }

  const colorValidation = validateColors(config.colors)
  const contextValidation = validateContexts(config.contexts)
  const fontValidation = validateFonts(config.fonts)
  const appearanceValidation = validateAppearance(config.appearance)
  const codeValidation = validateCodeTheme(config.code)

  allErrors.push(...colorValidation.errors)
  allErrors.push(...contextValidation.errors)
  allErrors.push(...fontValidation.errors)
  allErrors.push(...appearanceValidation.errors)
  allErrors.push(...codeValidation.errors)

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  }
}

/**
 * Normalize appearance configuration
 *
 * @param {string|Object} appearance - Raw appearance config
 * @returns {Object} Normalized appearance config
 */
function normalizeAppearance(appearance) {
  if (!appearance) {
    return { ...DEFAULT_APPEARANCE }
  }

  // Simple string value: "light", "dark", or "system"
  if (typeof appearance === 'string') {
    return {
      default: appearance,
      allowToggle: false,
      respectSystemPreference: appearance === 'system',
    }
  }

  return {
    ...DEFAULT_APPEARANCE,
    ...appearance,
  }
}

/**
 * Merge foundation variables with site overrides
 *
 * Splits variables into two groups based on their type:
 * - flat: context-independent vars (text, select, untyped) → foundationVars
 * - colorVars: context-aware vars (color, gradient) → stored per light/dark context
 *
 * @param {Object} foundationVars - Variables from foundation vars.js (with enriched schema)
 * @param {Object} siteVars - Site-level variable overrides
 * @returns {{ flat: Object, colorVars: Object }} Split variables
 */
function mergeFoundationVars(foundationVars = {}, siteVars = {}) {
  const flat = {}
  const colorVars = {}

  // Start with foundation defaults, split by type
  for (const [name, config] of Object.entries(foundationVars)) {
    const cfg = typeof config === 'object' ? { ...config } : { default: config }
    const isContextAware = CONTEXT_AWARE_TYPES.has(cfg.type)

    if (isContextAware) {
      // Default value applies to all contexts
      const defaultVal = cfg.default || ''
      colorVars[name] = { light: defaultVal, dark: defaultVal }
    } else {
      flat[name] = cfg
    }
  }

  // Apply site overrides
  for (const [name, value] of Object.entries(siteVars)) {
    // Look up type from foundation schema
    const schemaCfg = foundationVars[name]
    const type = typeof schemaCfg === 'object' ? schemaCfg?.type : undefined
    const isContextAware = CONTEXT_AWARE_TYPES.has(type)

    if (isContextAware) {
      if (typeof value === 'object' && value !== null && (value.light || value.dark)) {
        // Per-context override: { light: '#fff', dark: '#000' }
        colorVars[name] = { ...(colorVars[name] || {}), ...value }
      } else {
        // Scalar override: apply same value to all contexts
        const strVal = String(value)
        colorVars[name] = { light: strVal, dark: strVal }
      }
    } else {
      if (flat[name]) {
        // Override the default value
        flat[name].default = value
      } else {
        // New variable from site
        flat[name] = { default: value }
      }
    }
  }

  return { flat, colorVars }
}

/**
 * Process raw theme configuration into a complete, validated config
 *
 * @param {Object} rawConfig - Raw theme.yml content
 * @param {Object} options - Processing options
 * @param {Object} options.foundationVars - Foundation variables from vars.js
 * @param {boolean} options.strict - Throw on validation errors (default: false)
 * @returns {{ config: Object, errors: string[], warnings: string[] }}
 */
export function processTheme(rawConfig = {}, options = {}) {
  const { foundationVars = {}, strict = false } = options
  const errors = []
  const warnings = []

  // Validate raw config
  const validation = validateThemeConfig(rawConfig)
  if (!validation.valid) {
    errors.push(...validation.errors)
    if (strict) {
      throw new Error(`Theme configuration errors:\n${errors.join('\n')}`)
    }
  }

  // Process colors
  const defaultColors = getDefaultColors()
  const rawColors = { ...(rawConfig.colors || {}) }

  // Resolve named neutral presets to hex values
  if (typeof rawColors.neutral === 'string' && NEUTRAL_PRESETS[rawColors.neutral]) {
    rawColors.neutral = NEUTRAL_PRESETS[rawColors.neutral]
  }

  // Filter to only valid colors (skip invalid ones in non-strict mode)
  const validColors = {}
  for (const [name, value] of Object.entries({ ...defaultColors, ...rawColors })) {
    // Skip objects (pre-defined palettes) or invalid color strings
    if (typeof value === 'object' && value !== null) {
      validColors[name] = value
    } else if (isValidColor(value)) {
      validColors[name] = value
    }
    // Invalid colors are skipped (error already recorded during validation)
  }

  const colors = validColors

  // Generate color palettes (shades 50-950 for each color)
  // This is used by the Theme class for runtime color access
  const palettes = generatePalettes(colors)

  // Warn if required colors are missing
  if (!rawConfig.colors?.primary) {
    warnings.push('No primary color specified, using default blue (#3b82f6)')
  }
  if (!rawConfig.colors?.neutral) {
    warnings.push('No neutral color specified, using default stone (#78716c)')
  }

  // Process contexts (resolve bare palette refs like "primary-500" to var())
  const defaultContexts = getDefaultContextTokens()
  const rawContexts = rawConfig.contexts || {}
  const contexts = {}

  for (const name of ['light', 'medium', 'dark']) {
    const overrides = rawContexts[name] || {}
    const normalized = {}

    for (const [token, value] of Object.entries(overrides)) {
      normalized[token] = normalizeTokenValue(value)
    }

    contexts[name] = { ...defaultContexts[name], ...normalized }
  }

  // Fonts: `mono` is the deprecated name for the `code` role — accept it as an
  // alias so existing sites keep working, with a one-line nudge. The full
  // resolution into the font-role namespace happens after foundation vars are
  // merged (below), so a foundation's font vars can redefine/extend the roles.
  const rawFonts = { ...(rawConfig.fonts || {}) }
  if (rawFonts.mono !== undefined && rawFonts.code === undefined) {
    warnings.push('theme.yml `fonts.mono` is deprecated — rename it to `fonts.code` (the code/monospace role).')
    rawFonts.code = rawFonts.mono
  }
  delete rawFonts.mono

  // Normalize and process appearance
  const appearance = normalizeAppearance(rawConfig.appearance)

  // Merge foundation variables with site overrides
  // Splits into context-independent (flat) and context-aware (colorVars)
  const { flat: mergedFoundationVars, colorVars } = mergeFoundationVars(
    foundationVars,
    rawConfig.vars || rawConfig.foundationVars || {}
  )

  // Validate merged foundation vars
  const foundationValidation = validateFoundationVars(mergedFoundationVars)
  if (!foundationValidation.valid) {
    warnings.push(...foundationValidation.errors)
  }

  // Resolve the font-role namespace. The three roles are framework *defaults*;
  // a foundation `type: 'font'` var can redefine a role (retarget applyTo /
  // change the default) or add a new role; the site sets any role's value in
  // `fonts:` (or `vars:`). Everything lands in one map so each --font-<name> is
  // emitted once, site-value-wins. Font vars are split OUT of foundationVars so
  // they aren't also emitted by the generic foundation-var path (which would
  // double-write --font-<name>, the later foundation default clobbering the site).
  const fontRoles = {}
  for (const [name, applyTo] of Object.entries(DEFAULT_FONT_ROLES)) {
    fontRoles[name] = {
      value: DEFAULT_FONTS[name],
      applyTo: [...applyTo],
      foundationOwned: false,
      userSet: false,
    }
  }

  const nonFontVars = {}
  for (const [rawName, cfg] of Object.entries(mergedFoundationVars)) {
    if (!isFontVar(rawName, cfg)) {
      nonFontVars[rawName] = cfg
      continue
    }
    const name = normalizeFontRoleName(rawName)
    const cfgObj = typeof cfg === 'object' ? cfg : { default: cfg }
    const existing = fontRoles[name]
    fontRoles[name] = {
      value: cfgObj.default ?? existing?.value,
      applyTo:
        cfgObj.applyTo !== undefined
          ? normalizeApplyTo(cfgObj.applyTo)
          : existing?.applyTo ?? null,
      foundationOwned: true,
      userSet: false,
    }
  }

  const FONT_LOADING_KEYS = new Set(['import', 'faces'])
  for (const [rawName, value] of Object.entries(rawFonts)) {
    if (FONT_LOADING_KEYS.has(rawName)) continue
    const name = normalizeFontRoleName(rawName)
    const existing = fontRoles[name]
    fontRoles[name] = {
      value,
      applyTo: existing?.applyTo ?? null,
      foundationOwned: existing?.foundationOwned ?? false,
      userSet: true,
    }
  }

  // Per-role application + loading flags. apply: emit the font-family rule when
  // the role has selectors AND is "intended" (site-set or foundation-owned) —
  // a bare framework default is never forced onto a foundation's own typography.
  // load: pull the family through the @font-face / import filter.
  for (const role of Object.values(fontRoles)) {
    const intended = role.foundationOwned || role.userSet
    role.apply = intended && Array.isArray(role.applyTo) && role.applyTo.length > 0
    role.load = intended
  }

  // config.fonts: name→value (for the Theme API) plus import/faces (loading).
  const fonts = {}
  if (rawFonts.import !== undefined) fonts.import = rawFonts.import
  if (rawFonts.faces !== undefined) fonts.faces = rawFonts.faces
  for (const [name, role] of Object.entries(fontRoles)) {
    fonts[name] = role.value
  }

  // Process code block theme
  // These values are stored for runtime injection by kit's Code component
  // (not converted to CSS here - enables tree-shaking when code blocks aren't used)
  const code = {
    ...DEFAULT_CODE_THEME,
    ...(rawConfig.code || {}),
  }

  // Site background (pass through as CSS value)
  const background = rawConfig.background || null

  // Inline text styles (semantic names → CSS declarations)
  // Merge framework defaults with user overrides (user values win)
  const inline = { ...DEFAULT_INLINE, ...(rawConfig.inline || {}) }

  const config = {
    colors,      // Raw colors for CSS generator
    palettes,    // Generated palettes for Theme class
    contexts,
    fonts,       // name→value (+ import/faces) for the Theme API and loading
    fontRoles,   // resolved font-role map (value/applyTo/apply/load) for CSS gen
    appearance,
    foundationVars: nonFontVars, // NON-font vars only (font vars live in fontRoles)
    colorVars,   // Context-aware vars: { light: {...}, dark: {...} }
    code,        // Code block theme for runtime injection
    background,  // Site-level background CSS value
    inline,      // Inline text style definitions
  }

  return { config, errors, warnings }
}

/**
 * Load foundation variables from vars.js export
 *
 * @param {Object} varsModule - Imported vars.js module
 * @returns {Object} Foundation variables
 */
export function extractFoundationVars(varsModule) {
  if (!varsModule) {
    return {}
  }

  // Handle default export
  const module = varsModule.default || varsModule

  // Extract vars property or use whole object
  return module.vars || module
}

/**
 * Check if a foundation has theme variables
 *
 * @param {Object} foundationSchema - Foundation schema.json content
 * @returns {boolean}
 */
export function foundationHasVars(foundationSchema) {
  // Check _self.vars (new), _self.themeVars (legacy), root themeVars (backwards compat)
  return (
    foundationSchema?._self?.vars != null ||
    foundationSchema?._self?.themeVars != null ||
    foundationSchema?.themeVars != null
  )
}

/**
 * Get foundation variables from schema
 * Supports both new 'vars' and legacy 'themeVars' naming
 *
 * @param {Object} foundationSchema - Foundation schema.json content
 * @returns {Object} Foundation variables
 */
export function getFoundationVars(foundationSchema) {
  return (
    foundationSchema?._self?.vars ||
    foundationSchema?._self?.themeVars ||
    foundationSchema?.themeVars ||
    {}
  )
}

export default {
  validateThemeConfig,
  processTheme,
  extractFoundationVars,
  foundationHasVars,
  getFoundationVars,
}
