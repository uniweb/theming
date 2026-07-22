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

// Font-role classification (isFontVar, NON_FAMILY_FONT_VARS) and the default
// role selectors now live in processor.js, which resolves the whole font-role
// namespace (built-in roles + foundation redefinitions/additions) into config.

/**
 * Extract the font family names to load, from a resolved font-role map.
 *
 * A role contributes its family only when the processor flagged it `load`
 * (site-set or foundation-declared — not a bare framework default like
 * `system-ui`). Generic keywords and numeric tokens are skipped, so a role's
 * fallback stack never triggers an unnecessary fetch.
 *
 * @param {Object} fontRoles - Resolved roles: name → { value, applyTo, apply, load }
 * @returns {Set<string>} Lowercase family names to load (@font-face / import filter)
 */
function extractUsedFamilies(fontRoles = {}) {
  const used = new Set()

  const addFamiliesFrom = (value) => {
    if (typeof value !== 'string') return
    for (const segment of value.split(',')) {
      const name = segment.trim().replace(/^["']|["']$/g, '').toLowerCase()
      // Skip generics, empties, and numeric/length tokens.
      if (!name || GENERIC_FAMILIES.has(name) || /^\d/.test(name)) continue
      used.add(name)
    }
  }

  for (const role of Object.values(fontRoles)) {
    if (role && role.load) addFamiliesFrom(role.value)
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
 * Prefix a root-relative asset URL with the site's base path.
 *
 * Self-hosted font `src` values are authored root-relative (`/fonts/x.woff2`)
 * because that is what they are relative to the site. Under a subdirectory
 * deployment (GitHub Pages project sites, `/docs/`, ...) the served root moves,
 * so the emitted URL has to carry the base. A relative URL is not an option:
 * the rules live in an inline `<style>`, so they would resolve against the
 * *document* URL, which differs per route.
 *
 * Left untouched: absolute URLs (http:, //, data:), already-based URLs, and
 * document-relative ones (`./`, `../`) whose author clearly meant them.
 */
function withBase(url, base) {
  if (!url || !base || base === '/') return url
  if (!url.startsWith('/') || url.startsWith('//')) return url
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base
  if (url === prefix || url.startsWith(prefix + '/')) return url // already based
  return prefix + url
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
 * @param {Object} fontRoles - Resolved font roles (name → { value, applyTo, apply, load })
 * @param {Object} fonts - Font loading config (import[] / faces[])
 * @param {string} [base='/'] - Site base path, prefixed onto root-relative face srcs
 * @returns {{ css: string, links: string }} css for <style>, links for <head>
 */
function generateFontCSS(fontRoles = {}, fonts = {}, base = '/') {
  const cssLines = []
  const linkTags = []

  const usedFamilies = extractUsedFamilies(fontRoles)

  // --- @font-face rules from faces[] (filtered to used families) ---
  // Also generate <link rel="preload"> hints so browsers fetch fonts early
  const PRELOAD_TYPE = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' }

  if (fonts.faces && Array.isArray(fonts.faces)) {
    for (const face of fonts.faces) {
      if (!face.family || !face.src) continue
      if (!usedFamilies.has(face.family.toLowerCase())) continue

      const format = face.format || (face.src.endsWith('.woff2') ? 'woff2' : 'woff')
      const src = withBase(face.src, base)
      cssLines.push(
        `@font-face {`,
        `  font-family: ${face.family};`,
        `  src: url('${src}') format('${format}');`,
        `  font-weight: ${face.weight || 400};`,
        `  font-style: ${face.style || 'normal'};`,
        `  font-display: swap;`,
        `}`,
      )

      const mimeType = PRELOAD_TYPE[format]
      if (mimeType) {
        linkTags.push(`<link rel="preload" href="${src}" as="font" type="${mimeType}" crossorigin>`)
      }
    }
    if (cssLines.length > 0) {
      cssLines.push('') // blank line after @font-face block
    }
  }

  // --- External imports → <link> tags (filtered to used families) ---
  const googleUrls = []
  const otherOrigins = new Set()

  if (fonts.import && Array.isArray(fonts.import)) {
    for (const entry of fonts.import) {
      if (!entry.url) continue

      if (isGoogleFontsUrl(entry.url)) {
        const filtered = filterGoogleFontsUrl(entry.url, usedFamilies)
        if (filtered) googleUrls.push(filtered)
      } else {
        linkTags.push(`<link rel="stylesheet" href="${entry.url}">`)
        try {
          otherOrigins.add(new URL(entry.url).origin)
        } catch {
          // relative or malformed — no origin to preconnect to
        }
      }
    }
  }

  // Preconnect to non-Google font hosts so the DNS/TLS handshake overlaps the
  // stylesheet request instead of following it. Google's own preconnects are
  // emitted below, alongside the merged css2 link. Emitting every font <link>
  // from one place keeps consumers from having to re-derive any of them.
  for (const origin of otherOrigins) {
    linkTags.unshift(`<link rel="preconnect" href="${origin}">`)
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
      // Build the css2 URL by hand. Google's css2 axis syntax uses ':' ',' ';'
      // '@' as LITERAL separators and '+' for spaces. URLSearchParams.toString()
      // percent-encodes all of them (%3A/%2C/%3B/%40), producing a URL that
      // parses but is non-canonical — it only loads because Google's server
      // decodes it leniently. A strict Google Fonts mirror/proxy or a future API
      // change could reject it. Emit the canonical literal form instead.
      // (getAll() already decoded '+'/'%20' to spaces, so restore spaces to '+'.)
      const familyQuery = allFamilies
        .map((f) => `family=${f.trim().replace(/\s+/g, '+')}`)
        .join('&')
      const href = `https://fonts.googleapis.com/css2?${familyQuery}&display=${display}`

      linkTags.unshift(
        `<link rel="preconnect" href="https://fonts.googleapis.com">`,
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
        `<link rel="stylesheet" href="${href}">`,
      )
    }
  }

  // --- :root font variables (one --font-<name> per role, emitted once) ---
  const fontVars = []
  for (const [name, role] of Object.entries(fontRoles)) {
    if (role.value) {
      fontVars.push(`  --font-${name}: ${role.value};`)
    }
  }

  if (fontVars.length > 0) {
    cssLines.push(':root {')
    cssLines.push(...fontVars)
    cssLines.push('}')
  }

  // --- Apply font families to elements ---
  // Defining --font-* on :root is not enough — something must set `font-family`
  // on rendered elements, the same way colors get an application rule
  // ([id^="section-"] { background-color: var(--section) }). The processor has
  // already resolved which roles apply (`role.apply`): a built-in role applies
  // only when the site set it (don't stomp a foundation's own typography with
  // system-ui); a foundation-owned/redefined role applies always via its
  // `applyTo` selectors.
  const applyRules = []
  for (const [name, role] of Object.entries(fontRoles)) {
    if (!role.apply || !role.applyTo?.length) continue
    const selector = role.applyTo.join(', ')
    applyRules.push(`${selector} { font-family: var(--font-${name}); }`)
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
 * @param {Object} [options] - Generation options
 * @param {string} [options.base='/'] - Site base path for subdirectory deployments
 * @returns {{ css: string, links: string }} CSS string and font link tags
 */
export function generateThemeCSS(config = {}, options = {}) {
  const { base = '/' } = options
  const {
    colors = DEFAULT_COLORS,
    contexts = {},
    fonts = {},
    fontRoles = {},
    appearance = {},
    foundationVars = {},
    colorVars = {},
  } = config

  const sections = []

  // 1. Font face rules and variables (links returned separately). Font roles are
  //    resolved by the processor; `fonts` carries only import[] / faces[] here.
  //    Font-typed vars are already split out of `foundationVars`, so the generic
  //    foundation-var emission below never double-writes a --font-<name>.
  const fontResult = generateFontCSS(fontRoles, fonts, base)
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
