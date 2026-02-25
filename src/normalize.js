/**
 * Token Value Normalizer
 *
 * Converts stored token values into valid CSS. This is the single source
 * of truth for normalizing values from all origins:
 *
 * - theme.yml contexts: bare palette refs like `neutral-500`
 * - Section overrides (DB): `rgba(var(--primary-900) / 1.00)`
 * - Frontmatter overrides: bare palette refs like `neutral-900`
 *
 * Also supports the opacity shorthand: `neutral-500/20` → 20% opacity.
 *
 * @module @uniweb/theming/normalize
 */

const SHADE_LEVELS = new Set([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950])

// Matches bare palette reference: "primary-500", "neutral-900", "--accent-200"
const PALETTE_REF_RE = /^([a-z][a-z0-9]*)-(\d+)$/

// Matches bare palette reference with opacity: "neutral-500/20", "primary-600/50"
const PALETTE_REF_OPACITY_RE = /^([a-z][a-z0-9]*-\d+)\/(\d+)$/

// Matches rgba(var(--X) / Y) — the DB storage format for token values with opacity
const RGBA_VAR_RE = /^rgba\(\s*(var\(--[^)]+\))\s*\/\s*([\d.]+)\s*\)$/

/**
 * Normalize a token value to valid CSS.
 *
 * Handles all stored formats and produces CSS that works with any color format
 * (OKLCH, RGB, hex) by using var() references and color-mix() for opacity.
 *
 * @param {string} value - The stored token value
 * @returns {string} Valid CSS value
 *
 * @example
 * // Bare palette reference
 * normalizeTokenValue('neutral-500')     // → 'var(--neutral-500)'
 *
 * // Palette reference with opacity
 * normalizeTokenValue('neutral-500/20')  // → 'color-mix(in srgb, var(--neutral-500) 20%, transparent)'
 *
 * // DB format — full opacity (strip wrapper)
 * normalizeTokenValue('rgba(var(--primary-900) / 1.00)')  // → 'var(--primary-900)'
 *
 * // DB format — partial opacity (convert to color-mix)
 * normalizeTokenValue('rgba(var(--primary-900) / 0.50)')  // → 'color-mix(in srgb, var(--primary-900) 50%, transparent)'
 *
 * // Already valid CSS — pass through
 * normalizeTokenValue('var(--neutral-500)')  // → 'var(--neutral-500)'
 * normalizeTokenValue('white')               // → 'white'
 * normalizeTokenValue('#ff0000')             // → '#ff0000'
 */
export function normalizeTokenValue(value) {
  if (typeof value !== 'string') return value

  // 1. Check for rgba(var(--X) / Y) — DB storage format
  const rgbaMatch = value.match(RGBA_VAR_RE)
  if (rgbaMatch) {
    const varRef = rgbaMatch[1]
    const opacity = parseFloat(rgbaMatch[2])
    if (opacity >= 0.999) return varRef
    return `color-mix(in srgb, ${varRef} ${Math.round(opacity * 100)}%, transparent)`
  }

  // 2. Already a CSS function (var(), color-mix(), rgb(), etc.) — pass through
  if (value.includes('(')) return value

  // 3. Hex color — pass through
  if (value.startsWith('#')) return value

  // 4. Strip leading dashes (--primary-500 → primary-500)
  const bare = value.replace(/^-{0,2}/, '')

  // 5. Check for palette reference with opacity: "neutral-500/20"
  const opacityMatch = bare.match(PALETTE_REF_OPACITY_RE)
  if (opacityMatch) {
    const ref = opacityMatch[1]
    const pct = parseInt(opacityMatch[2], 10)
    const refMatch = ref.match(PALETTE_REF_RE)
    if (refMatch && SHADE_LEVELS.has(parseInt(refMatch[2], 10))) {
      if (pct >= 100) return `var(--${ref})`
      return `color-mix(in srgb, var(--${ref}) ${pct}%, transparent)`
    }
  }

  // 6. Check for bare palette reference: "neutral-500", "primary-600"
  const paletteMatch = bare.match(PALETTE_REF_RE)
  if (paletteMatch) {
    const shade = parseInt(paletteMatch[2], 10)
    if (SHADE_LEVELS.has(shade)) {
      return `var(--${bare})`
    }
  }

  // 7. Anything else — pass through (named colors like 'white', 'transparent', etc.)
  return value
}
