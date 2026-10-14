/**
 * What a theme value may be, before it is written into CSS or into a `<link>`.
 *
 * A theme is content — `theme.yml`, a section's `theme:` and its variables, and
 * whatever an editor lets an author change of them. Its values are written into
 * the stylesheet a prerendered page carries in its `<head>`, and its font URLs
 * into `<link>` tags there. So a value has to stay a value: it may not end its
 * declaration (`;`), open or close a rule (`{` `}`), end the element it sits in
 * (`<` `>`), escape (`\`) or open a comment, and a URL is one a page may load. A
 * value that is not is left out, with a warning naming it — never repaired,
 * which would be a guess at what was meant.
 *
 * ⛔ Until 2026-10-14 every value was written as given, so a theme value holding
 * `</style><script>…` ran as script on a prerendered page, and a font URL holding
 * a `"` opened an attribute on its `<link>`.
 *
 * @module @uniweb/theming/values
 */

const CONTROL = /[\u0000-\u001f\u007f]/
const ENDS_A_VALUE = /[;{}<>\\]|\/\*|\*\//
const RUNS = /expression\s*\(|javascript:|vbscript:|@import|behavior\s*:|-moz-binding/i
const URL_IN_A_VALUE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi

/**
 * Whether a URL is one a page may load: relative, or `http:` / `https:`. It may
 * hold no space, quote, parenthesis, angle bracket or backslash, so it cannot
 * leave the `url(…)` or the attribute it is written into.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isLoadableUrl(url) {
  if (typeof url !== 'string' || !url || CONTROL.test(url) || /[\s"'()<>\\]/.test(url)) return false
  const scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  return !scheme || /^https?$/i.test(scheme[1])
}

/**
 * Whether a value may be written as a CSS value: a finite number, or a string
 * that cannot end its declaration, its rule or its element, and whose every
 * `url(…)` is loadable.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isCssValue(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  if (CONTROL.test(value) || ENDS_A_VALUE.test(value) || RUNS.test(value)) return false
  for (const [, , url] of value.matchAll(URL_IN_A_VALUE)) {
    if (!isLoadableUrl(url)) return false
  }
  return true
}

/**
 * Whether a name may be written where CSS expects one of ours — a custom
 * property after `--`, a style name in `span[…]`, a font role: a letter or `_`,
 * then letters, digits, `_` and `-`.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isCssName(name) {
  return typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)
}

/**
 * Whether a name may be written as a CSS property — `color`, `font-weight`,
 * `-webkit-text-stroke`.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isCssProperty(name) {
  return typeof name === 'string' && /^-?[a-z][a-z0-9-]*$/.test(name)
}

/**
 * Escape a string for a double-quoted HTML attribute value.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The last line: a stylesheet leaves here with no `<` in it, so whatever got
 * past the checks above cannot end the `<style>` element it is written into.
 * Valid CSS has no `<` outside a string, and inside one `\3c ` is the same
 * character.
 *
 * @param {string} css
 * @returns {string}
 */
export function closeToMarkup(css) {
  return typeof css === 'string' ? css.replace(/</g, '\\3c ') : css
}

/**
 * Keep the entries of a name → value map that may be written, and say what was
 * left out.
 *
 * @param {Object} map
 * @param {string} where - what the map is, for a warning (`contexts.light`)
 * @param {string[]} warnings - where a warning is added
 * @param {(name: string) => boolean} [isName]
 * @returns {Object} the entries that may be written
 */
export function keepWritable(map, where, warnings, isName = isCssName) {
  const kept = {}
  for (const [name, value] of Object.entries(map || {})) {
    if (!isName(name)) {
      warnings.push(`theme: ${where}: \`${name}\` is not a name a stylesheet can hold — left out`)
    } else if (value !== null && value !== undefined && value !== '' && !isCssValue(value)) {
      warnings.push(`theme: ${where}.${name}: ${JSON.stringify(value)} is not a CSS value — left out`)
    } else {
      kept[name] = value
    }
  }
  return kept
}
