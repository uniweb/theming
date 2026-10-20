/**
 * `theme.yml`'s `code:` — what it may say, and what of it travels.
 *
 * A site says how its code blocks look in one of three forms, which kit's
 * <Code> reads (`parseCodeConfig` in kit's Code renderer):
 *
 *   code: dracula                                a theme, by name
 *   code: { light: github-light, dark: … }       a theme per scheme — each side
 *                                                a name, or a map of the next form
 *   code: { theme?: github-dark, <colour>: … }   a theme, with colours overridden
 *
 * This layer carries the declaration as written — the default belongs to
 * whoever renders code — and says what is wrong with it: a key kit does not
 * read, a theme named with anything but a name, a colour that is not one. Kit
 * would ignore each of them, or refuse it, without a word. ⛔ Until 2026-10-19
 * the check read every value as a palette colour, so a pair of names, `theme:`,
 * `transparent` and `var(…)` were reported as invalid colours (and the build
 * printed none of the report), and the safety filter left out a pair whose
 * sides were maps — so kit drew the default theme.
 *
 * @module @uniweb/theming/code-theme
 */

import { keepWritable } from './values.js'

/**
 * The colours a `code:` block may set: the block's ground and text, and the
 * token scopes kit's <Code> maps. A cross-package test holds this list and
 * kit's together, so a key kit learns is a key this check accepts.
 */
export const CODE_COLOR_KEYS = Object.freeze([
  'background',
  'foreground',
  'comment',
  'string',
  'keyword',
  'operator',
  'function',
  'variable',
  'number',
  'constant',
  'type',
  'property',
  'tag',
  'attribute',
  'punctuation',
])

// A theme's name, as Shiki names every theme it ships: lowercase words joined by
// single hyphens. Kit refuses any other, since the name becomes part of a URL.
const THEME_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// A colour, in the forms CSS has — which is what a declared colour becomes, in
// the highlighter's inline styles. Not only the forms a palette can be shaded
// from: `transparent`, a named colour and `var(--x)` are colours here.
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(.+\)$/i
const COLOR_WORD = /^[a-z]+$/i

/**
 * Whether a string can name a code theme.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function isCodeThemeName(name) {
  return typeof name === 'string' && THEME_NAME.test(name)
}

/**
 * Whether a value is a colour a code block can be painted with.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isCodeColor(value) {
  return typeof value === 'string' && (HEX.test(value) || COLOR_FUNCTION.test(value) || COLOR_WORD.test(value))
}

const THEME_HINT = "name one of Shiki's themes, such as github-dark"
const describe = (value) => (Array.isArray(value) ? 'a list' : value === null ? 'null' : typeof value)

/** One side — the whole block, or `light` / `dark` of a pair: a theme name, or a map of `theme` and colours. */
function checkSide(side, where, errors) {
  if (typeof side === 'string') {
    if (!isCodeThemeName(side)) errors.push(`${where}: ${JSON.stringify(side)} is not a theme name — ${THEME_HINT}`)
    return
  }
  if (!side || typeof side !== 'object' || Array.isArray(side)) {
    errors.push(`${where} must be a theme name or a map of colours, got ${describe(side)}`)
    return
  }
  for (const [key, value] of Object.entries(side)) {
    if (key === 'theme') {
      if (!isCodeThemeName(value)) errors.push(`${where}.theme: ${JSON.stringify(value)} is not a theme name — ${THEME_HINT}`)
    } else if (key === 'light' || key === 'dark') {
      errors.push(`${where}.${key}: a side of a pair cannot hold another pair`)
    } else if (!CODE_COLOR_KEYS.includes(key)) {
      errors.push(`${where}.${key} is not a code colour — the colours are ${CODE_COLOR_KEYS.join(', ')}`)
    } else if (typeof value !== 'string') {
      errors.push(`${where}.${key} must be a colour, got ${describe(value)}`)
    } else if (!isCodeColor(value)) {
      errors.push(`${where}.${key} has invalid color value: ${value}`)
    }
  }
}

/**
 * What is wrong with a `code:` declaration, as messages for the build to print.
 *
 * @param {*} code - `theme.yml`'s `code:`
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCodeTheme(code) {
  const errors = []

  if (code === undefined || code === null) return { valid: true, errors } // the renderer's default
  if (typeof code === 'string') {
    checkSide(code, 'code', errors)
  } else if (typeof code !== 'object' || Array.isArray(code)) {
    errors.push(`code must be a theme name, a light/dark pair, or a map of colours, got ${describe(code)}`)
  } else if ('light' in code || 'dark' in code) {
    for (const [key, value] of Object.entries(code)) {
      if (key === 'light' || key === 'dark') checkSide(value, `code.${key}`, errors)
      else errors.push(`code.${key} beside light and dark does nothing — set it on a side, as code.light.${key}`)
    }
  } else {
    checkSide(code, 'code', errors)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * The declaration as it travels: as written, less any value a stylesheet could
 * not hold (`keepWritable`, which says what it left out). A side of a pair that
 * is a map is filtered the same way, value by value — not left out whole for
 * not being one value.
 *
 * @param {*} code - `theme.yml`'s `code:`
 * @param {string[]} warnings - where a warning is added
 * @returns {*} what travels to the renderer, or null for nothing declared
 */
export function keepWritableCode(code, warnings) {
  if (code === undefined || code === null) return null
  if (typeof code !== 'object' || Array.isArray(code)) return code

  const kept = {}
  for (const [key, value] of Object.entries(code)) {
    if ((key === 'light' || key === 'dark') && value && typeof value === 'object' && !Array.isArray(value)) {
      kept[key] = keepWritable(value, `code.${key}`, warnings)
    } else {
      Object.assign(kept, keepWritable({ [key]: value }, 'code', warnings))
    }
  }
  return kept
}
