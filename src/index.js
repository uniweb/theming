/**
 * Theme Module
 *
 * Exports all theme-related utilities for the build process.
 *
 * @module @uniweb/theming
 */

// Shade generation
export {
  parseColor,
  formatOklch,
  formatHex,
  generateShades,
  generatePalettes,
  isValidColor,
  getShadeLevels,
} from './shade-generator.js'

// CSS generation
export {
  generateThemeCSS,
  generateContextCSS,
  generatePaletteVars,
  generateFoundationVars,
  getDefaultContextTokens,
  getDefaultColors,
  extractUsedFamilies,
  FONT_LINKS_MARKER,
} from './css-generator.js'

// Theme processing
export {
  validateThemeConfig,
  processTheme,
  extractFoundationVars,
  foundationHasVars,
  isFontVar,
} from './processor.js'

// Value normalization
export { normalizeTokenValue } from './normalize.js'

// Section override CSS
export { buildSectionOverrides } from './section-overrides.js'

// Default export for convenience
import { processTheme } from './processor.js'
import { generateThemeCSS } from './css-generator.js'

/**
 * Process theme configuration and generate CSS in one step
 *
 * @param {Object} themeYml - Raw theme.yml content
 * @param {Object} options - Processing options
 * @param {Object} options.foundationVars - Foundation variables
 * @param {string} [options.base='/'] - Site base path, prefixed onto root-relative
 *   font `src` URLs so self-hosted fonts resolve under subdirectory deployments
 * @returns {{ css: string, links: string, config: Object, errors: string[], warnings: string[] }}
 */
export function buildTheme(themeYml = {}, options = {}) {
  const { config, errors, warnings } = processTheme(themeYml, options)
  const { css, links } = generateThemeCSS(config, { base: options.base })

  return {
    css,
    links,
    config,
    errors,
    warnings,
  }
}

export default {
  buildTheme,
  processTheme,
  generateThemeCSS,
}
