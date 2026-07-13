/**
 * Theme CSS Generator
 *
 * Generates complete CSS for site theming including:
 * - Color palettes as CSS custom properties
 * - Context classes (light/medium/dark) with semantic tokens
 * - Foundation-specific variables
 * - Optional dark scheme support
 *
 * @module @uniweb/theming/css-generator
 */

import { generatePalettes, formatOklch } from './shade-generator.js'

// Default semantic tokens for each context
// These map abstract concepts to specific palette values
const DEFAULT_CONTEXT_TOKENS = {
  light: {
    'section': 'var(--neutral-50)',
    'card': 'var(--neutral-100)',
    'muted': 'var(--neutral-200)',
    'body': 'var(--neutral-950)',
    'heading': 'var(--neutral-900)',
    'subtle': 'var(--neutral-600)',
    'border': 'var(--neutral-200)',
    'ring': 'var(--primary-500)',
    'link': 'var(--primary-600)',
    'link-hover': 'var(--primary-700)',
    'accent': 'var(--accent-600)',
    'primary': 'var(--primary-600)',
    'primary-foreground': 'white',
    'primary-hover': 'var(--primary-700)',
    'primary-border': 'transparent',
    'secondary': 'white',
    'secondary-foreground': 'var(--neutral-900)',
    'secondary-hover': 'var(--neutral-100)',
    'secondary-border': 'var(--neutral-300)',
    'success': '#16a34a',
    'success-subtle': '#f0fdf4',
    'warning': '#d97706',
    'warning-subtle': '#fffbeb',
    'error': '#dc2626',
    'error-subtle': '#fef2f2',
    'info': '#2563eb',
    'info-subtle': '#eff6ff',
  },
  medium: {
    'section': 'var(--neutral-100)',
    'card': 'var(--neutral-200)',
    'muted': 'var(--neutral-300)',
    'body': 'var(--neutral-950)',
    'heading': 'var(--neutral-900)',
    'subtle': 'var(--neutral-700)',
    'border': 'var(--neutral-300)',
    'ring': 'var(--primary-500)',
    'link': 'var(--primary-600)',
    'link-hover': 'var(--primary-700)',
    'accent': 'var(--accent-600)',
    'primary': 'var(--primary-600)',
    'primary-foreground': 'white',
    'primary-hover': 'var(--primary-700)',
    'primary-border': 'transparent',
    'secondary': 'white',
    'secondary-foreground': 'var(--neutral-900)',
    'secondary-hover': 'var(--neutral-100)',
    'secondary-border': 'var(--neutral-300)',
    'success': '#16a34a',
    'success-subtle': '#f0fdf4',
    'warning': '#d97706',
    'warning-subtle': '#fffbeb',
    'error': '#dc2626',
    'error-subtle': '#fef2f2',
    'info': '#2563eb',
    'info-subtle': '#eff6ff',
  },
  dark: {
    'section': 'var(--neutral-950)',
    'card': 'var(--neutral-800)',
    'muted': 'var(--neutral-700)',
    'body': 'var(--neutral-50)',
    'heading': 'white',
    'subtle': 'var(--neutral-400)',
    'border': 'var(--neutral-700)',
    'ring': 'var(--primary-500)',
    'link': 'var(--primary-400)',
    'link-hover': 'var(--primary-300)',
    'accent': 'var(--accent-400)',
    'primary': 'var(--primary-500)',
    'primary-foreground': 'white',
    'primary-hover': 'var(--primary-400)',
    'primary-border': 'transparent',
    'secondary': 'var(--neutral-800)',
    'secondary-foreground': 'var(--neutral-100)',
    'secondary-hover': 'var(--neutral-700)',
    'secondary-border': 'var(--neutral-600)',
    'success': '#4ade80',
    'success-subtle': '#052e16',
    'warning': '#fbbf24',
    'warning-subtle': '#451a03',
    'error': '#f87171',
    'error-subtle': '#450a0a',
    'info': '#60a5fa',
    'info-subtle': '#172554',
  },
}

// Default color palette configuration
const DEFAULT_COLORS = {
  primary: '#3b82f6',   // Blue
  secondary: '#64748b', // Slate
  accent: '#8b5cf6',    // Purple
  neutral: '#78716c',   // Stone
}

// Shade levels for CSS variable generation
const SHADE_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/**
 * Generate CSS variable declarations from an object
 *
 * @param {Object} vars - Object with variable names as keys
 * @param {string} indent - Indentation string
 * @returns {string} CSS variable declarations
 */
function generateVarDeclarations(vars, indent = '  ') {
  return Object.entries(vars)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n')
}

/**
 * Generate color palette CSS variables
 *
 * @param {Object} palettes - Object with palette name → shades
 * @returns {string} CSS variable declarations for all palettes
 */
function generatePaletteVars(palettes) {
  const lines = []

  for (const [name, shades] of Object.entries(palettes)) {
    for (const level of SHADE_LEVELS) {
      if (shades[level]) {
        lines.push(`  --${name}-${level}: ${shades[level]};`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Generate context class CSS
 *
 * @param {string} context - Context name (light, medium, dark)
 * @param {Object} tokens - Token overrides
 * @param {Object} colorVars - Context-aware foundation color vars: { light: {...}, dark: {...} }
 * @returns {string} CSS for context class
 */
function generateContextCSS(context, tokens = {}, colorVars = {}) {
  const defaultTokens = DEFAULT_CONTEXT_TOKENS[context] || DEFAULT_CONTEXT_TOKENS.light
  const mergedTokens = { ...defaultTokens, ...tokens }

  // Merge context-aware color vars into the context class
  const contextColorVars = colorVars[context] || {}
  const allVars = { ...mergedTokens, ...contextColorVars }

  const vars = generateVarDeclarations(allVars)

  return `.context-${context} {\n${vars}\n}`
}

/**
 * Generate dark scheme CSS (for site-wide dark mode toggle)
 *
 * @param {Object} config - Appearance configuration
 * @param {Object} darkOverrides - Dark context token overrides
 * @param {Object} colorVars - Context-aware foundation color vars: { light: {...}, dark: {...} }
 * @returns {string} CSS for dark scheme support
 */
function generateDarkSchemeCSS(config = {}, darkOverrides = {}, colorVars = {}) {
  const respectSystemPreference = config.default === 'system'

  // Merge default dark tokens with user element overrides and dark color vars
  const darkColorVars = colorVars.dark || {}
  const darkTokens = { ...DEFAULT_CONTEXT_TOKENS.dark, ...darkOverrides, ...darkColorVars }

  const vars = generateVarDeclarations(darkTokens)

  let css = `/* Dark scheme (user preference) */\n`
  css += `.scheme-dark {\n${vars}\n}\n`

  if (respectSystemPreference) {
    css += `\n@media (prefers-color-scheme: dark) {\n`
    css += `  :root:not(.scheme-light) {\n`
    for (const [name, value] of Object.entries(darkTokens)) {
      css += `    --${name}: ${value};\n`
    }
    css += `  }\n`
    css += `}\n`
  }

  return css
}

// Generic CSS font families that should not trigger font loading
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-monospace', 'ui-serif', 'ui-sans-serif', 'ui-rounded',
  'math', 'emoji', 'fangsong',
  'inherit', 'initial', 'revert', 'unset',
])

/**
 * Extract font family names actually used by body/heading/mono slots.
 *
 * Only considers slots the user explicitly configured (tracked via _userSlots
 * from the processor). Default system font stacks are ignored so they don't
 * trigger unnecessary font loading.
 *
 * @param {Object} fonts - Font configuration
 * @returns {Set<string>} Lowercase family names referenced by user-set slots
 */
function extractUsedFamilies(fonts) {
  const used = new Set()
  const slots = fonts._userSlots || ['body', 'heading', 'mono']

  for (const slot of slots) {
    const value = fonts[slot]
    if (!value) continue

    for (const segment of value.split(',')) {
      const name = segment.trim().replace(/^["']|["']$/g, '').toLowerCase()
      if (name && !GENERIC_FAMILIES.has(name)) {
        used.add(name)
      }
    }
  }

  return used
}

/**
 * Filter a Google Fonts URL to only include families in the used set.
 *
 * @param {string} url - Google Fonts CSS URL
 * @param {Set<string>} usedFamilies - Lowercase family names to keep
 * @returns {string|null} Filtered URL, or null if no families remain
 */
function filterGoogleFontsUrl(url, usedFamilies) {
  try {
    const parsed = new URL(url)
    const familyParams = parsed.searchParams.getAll('family')
    if (familyParams.length === 0) return url

    const kept = familyParams.filter((param) => {
      // "Montserrat:wght@400;700" → "montserrat"
      const name = param.split(':')[0].trim().toLowerCase()
      return usedFamilies.has(name)
    })

    if (kept.length === 0) return null

    // Rebuild URL with only kept families
    parsed.searchParams.delete('family')
    for (const f of kept) {
      parsed.searchParams.append('family', f)
    }
    return parsed.toString()
  } catch {
    return url // malformed URL — keep as-is
  }
}

/**
 * Check whether a URL points to Google Fonts.
 */
function isGoogleFontsUrl(url) {
  try {
    return new URL(url).hostname === 'fonts.googleapis.com'
  } catch {
    return false
  }
}

/**
 * Generate font CSS and external link tags.
 *
 * @param {Object} fonts - Font configuration
 * @returns {{ css: string, links: string }} css for <style>, links for <head>
 */
function generateFontCSS(fonts = {}) {
  const cssLines = []
  const linkTags = []

  const usedFamilies = extractUsedFamilies(fonts)

  // --- @font-face rules from faces[] (filtered to used families) ---
  // Also generate <link rel="preload"> hints so browsers fetch fonts early
  const PRELOAD_TYPE = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' }

  if (fonts.faces && Array.isArray(fonts.faces)) {
    for (const face of fonts.faces) {
      if (!face.family || !face.src) continue
      if (!usedFamilies.has(face.family.toLowerCase())) continue

      const format = face.format || (face.src.endsWith('.woff2') ? 'woff2' : 'woff')
      cssLines.push(
        `@font-face {`,
        `  font-family: ${face.family};`,
        `  src: url('${face.src}') format('${format}');`,
        `  font-weight: ${face.weight || 400};`,
        `  font-style: ${face.style || 'normal'};`,
        `  font-display: swap;`,
        `}`,
      )

      const mimeType = PRELOAD_TYPE[format]
      if (mimeType) {
        linkTags.push(`<link rel="preload" href="${face.src}" as="font" type="${mimeType}" crossorigin>`)
      }
    }
    if (cssLines.length > 0) {
      cssLines.push('') // blank line after @font-face block
    }
  }

  // --- External imports → <link> tags (filtered to used families) ---
  const googleUrls = []

  if (fonts.import && Array.isArray(fonts.import)) {
    for (const entry of fonts.import) {
      if (!entry.url) continue

      if (isGoogleFontsUrl(entry.url)) {
        const filtered = filterGoogleFontsUrl(entry.url, usedFamilies)
        if (filtered) googleUrls.push(filtered)
      } else {
        linkTags.push(`<link rel="stylesheet" href="${entry.url}">`)
      }
    }
  }

  // Merge Google Fonts into a single <link> with preconnect
  if (googleUrls.length > 0) {
    // Collect all family params from all URLs into one
    const allFamilies = []
    let display = 'swap'
    for (const url of googleUrls) {
      try {
        const parsed = new URL(url)
        allFamilies.push(...parsed.searchParams.getAll('family'))
        if (parsed.searchParams.get('display')) {
          display = parsed.searchParams.get('display')
        }
      } catch {
        // skip malformed
      }
    }

    if (allFamilies.length > 0) {
      const merged = new URL('https://fonts.googleapis.com/css2')
      for (const f of allFamilies) {
        merged.searchParams.append('family', f)
      }
      merged.searchParams.set('display', display)

      linkTags.unshift(
        `<link rel="preconnect" href="https://fonts.googleapis.com">`,
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
        `<link rel="stylesheet" href="${merged.toString()}">`,
      )
    }
  }

  // --- :root font variables ---
  const fontVars = []
  if (fonts.body) {
    fontVars.push(`  --font-body: ${fonts.body};`)
  }
  if (fonts.heading) {
    fontVars.push(`  --font-heading: ${fonts.heading};`)
  }
  if (fonts.mono) {
    fontVars.push(`  --font-mono: ${fonts.mono};`)
  }

  if (fontVars.length > 0) {
    cssLines.push(':root {')
    cssLines.push(...fontVars)
    cssLines.push('}')
  }

  // --- Apply font families to elements ---
  // Defining --font-* on :root is not enough — something must actually set
  // `font-family` on rendered elements, the same way colors get an application
  // rule ([id^="section-"] { background-color: var(--section) }). Without this
  // the font vars are orphaned and text never picks them up, even though the
  // vars are set and the @import/@font-face load. Only apply slots the SITE
  // explicitly set (fonts._userSlots) so a foundation's own default typography
  // is left untouched when theme.yml doesn't override that slot.
  const userSlots = new Set(fonts._userSlots || [])
  const applyRules = []
  if (userSlots.has('body')) {
    applyRules.push('body { font-family: var(--font-body); }')
  }
  if (userSlots.has('heading')) {
    // Only the prominent headings — display/heading faces are drawn for large
    // sizes; h4–h6 usually render at or near body size where a display face
    // reads awkwardly, so they stay in the body font.
    applyRules.push('h1, h2, h3 { font-family: var(--font-heading); }')
  }
  if (userSlots.has('mono')) {
    applyRules.push('code, pre, kbd, samp { font-family: var(--font-mono); }')
  }
  if (applyRules.length > 0) {
    cssLines.push('')
    cssLines.push(...applyRules)
  }

  return {
    css: cssLines.join('\n'),
    links: linkTags.join('\n'),
  }
}

// Theme token names reserved by the theming engine — foundation vars must not use these
const RESERVED_VAR_NAMES = new Set([
  // Semantic color tokens
  'section', 'card', 'muted', 'body', 'heading', 'subtle',
  'border', 'ring', 'link', 'link-hover', 'accent',
  // Action tokens
  'primary', 'primary-foreground', 'primary-hover', 'primary-border',
  'secondary', 'secondary-foreground', 'secondary-hover', 'secondary-border',
  // Status tokens
  'success', 'success-subtle', 'warning', 'warning-subtle',
  'error', 'error-subtle', 'info', 'info-subtle',
])

// Palette shade pattern: primary-50, neutral-950, accent-300, etc.
const PALETTE_SHADE_RE = /^(primary|secondary|accent|neutral)-\d+$/

/**
 * Generate foundation-specific CSS variables
 *
 * @param {Object} vars - Foundation variables from vars.js
 * @returns {string} CSS variable declarations
 */
export function generateFoundationVars(vars = {}) {
  if (!vars || Object.keys(vars).length === 0) {
    return ''
  }

  const declarations = []

  for (const [name, config] of Object.entries(vars)) {
    if (RESERVED_VAR_NAMES.has(name) || PALETTE_SHADE_RE.test(name)) {
      console.warn(
        `Warning: Foundation var '${name}' collides with a theme token. ` +
        `Rename it to avoid unexpected behavior (e.g., '${name}-value' or '${name}-size').`
      )
    }
    const value = typeof config === 'object' ? config.default : config
    if (value !== undefined) {
      declarations.push(`  --${name}: ${value};`)
    }
  }

  if (declarations.length === 0) {
    return ''
  }

  return `:root {\n${declarations.join('\n')}\n}`
}

/**
 * Generate complete theme CSS
 *
 * @param {Object} config - Processed theme configuration
 * @param {Object} config.colors - Color palette configuration
 * @param {Object} config.contexts - Context token overrides
 * @param {Object} config.fonts - Font configuration
 * @param {Object} config.appearance - Appearance settings (dark mode, etc.)
 * @param {Object} config.foundationVars - Foundation-specific variables
 * @returns {{ css: string, links: string }} CSS string and font link tags
 */
export function generateThemeCSS(config = {}) {
  const {
    colors = DEFAULT_COLORS,
    contexts = {},
    fonts = {},
    appearance = {},
    foundationVars = {},
    colorVars = {},
  } = config

  const sections = []

  // 1. Font face rules and variables (links returned separately)
  const fontResult = generateFontCSS(fonts)
  if (fontResult.css) {
    sections.push('/* Typography */\n' + fontResult.css)
  }

  // 2. Color palettes
  const palettes = generatePalettes(colors)
  const paletteVars = generatePaletteVars(palettes)
  sections.push(`/* Color Palettes */\n:root {\n${paletteVars}\n}`)

  // 3. Default semantic tokens (applied to :root for global defaults)
  // Include light color vars in the :root defaults
  const lightColorVars = colorVars.light || {}
  const defaultTokens = { ...DEFAULT_CONTEXT_TOKENS.light, ...(contexts.light || {}), ...lightColorVars }
  const defaultVars = generateVarDeclarations(defaultTokens)
  sections.push(`/* Default Semantic Tokens */\n:root {\n${defaultVars}\n}\n\n/* Section backgrounds — applied once, resolves via context tokens */\n[id^="section-"] {\n  background-color: var(--section);\n}`)

  // 4. Context classes
  const contextCSS = [
    generateContextCSS('light', contexts.light, colorVars),
    generateContextCSS('medium', contexts.medium, colorVars),
    generateContextCSS('dark', contexts.dark, colorVars),
  ]
  sections.push('/* Color Contexts */\n' + contextCSS.join('\n\n'))

  // 5. Foundation variables
  const foundationCSS = generateFoundationVars(foundationVars)
  if (foundationCSS) {
    sections.push('/* Foundation Variables */\n' + foundationCSS)
  }

  // 6. Dark scheme support (if enabled, default is dark, or follows system preference)
  if (appearance.allowToggle || appearance.default === 'dark' || appearance.default === 'system' || appearance.schemes?.includes('dark')) {
    sections.push(generateDarkSchemeCSS(appearance, contexts.dark, colorVars))
  }

  // 7. Site background (if specified in theme.yml)
  if (config.background) {
    sections.push(`/* Site Background */\nbody {\n  background: ${config.background};\n}`)
  }

  // 8. Inline text styles (if specified in theme.yml)
  if (config.inline && typeof config.inline === 'object') {
    const rules = Object.entries(config.inline)
      .filter(([, styles]) => styles && typeof styles === 'object')
      .map(([name, styles]) => {
        const declarations = Object.entries(styles)
          .map(([prop, value]) => `  ${prop}: ${value};`)
          .join('\n')
        return `span[${name}] {\n${declarations}\n}`
      })
    if (rules.length > 0) {
      sections.push('/* Inline Text Styles */\n' + rules.join('\n\n'))
    }
  }

  return {
    css: sections.join('\n\n'),
    links: fontResult.links,
  }
}

/**
 * Generate CSS for a single context (useful for testing)
 */
export { generateContextCSS }

/**
 * Generate palette CSS variables (useful for testing)
 */
export { generatePaletteVars }

/**
 * Get default context tokens
 */
export function getDefaultContextTokens() {
  return JSON.parse(JSON.stringify(DEFAULT_CONTEXT_TOKENS))
}

/**
 * Get default colors
 */
export function getDefaultColors() {
  return { ...DEFAULT_COLORS }
}

/**
 * Extract used font families (useful for testing)
 */
export { extractUsedFamilies }

export default {
  generateThemeCSS,
  generateContextCSS,
  generatePaletteVars,
  getDefaultContextTokens,
  getDefaultColors,
  extractUsedFamilies,
}
