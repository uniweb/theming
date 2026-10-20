/**
 * What `theme.yml`'s `code:` may say, and what of it reaches the renderer.
 *
 * The check is for what a site author can fix — a key kit does not read, a theme
 * named with anything but a name, a colour that is not one — and it must say
 * nothing about the forms kit reads. ⛔ Until 2026-10-19 it read every value as
 * a palette colour: a pair of names and `theme:` were "invalid colours", and a
 * pair whose sides were maps was left out by the safety filter, so kit drew the
 * default theme.
 */

import { describe, it, expect } from 'vitest'
import { validateCodeTheme, keepWritableCode, isCodeColor, CODE_COLOR_KEYS } from '../src/code-theme.js'
import { processTheme } from '../src/processor.js'

const errorsOf = (code) => validateCodeTheme(code).errors

describe('the forms kit reads raise nothing', () => {
  it.each([
    ['nothing', undefined],
    ['a theme, by name', 'dracula'],
    ['a pair of names', { light: 'github-light', dark: 'github-dark' }],
    ['a pair, each side adjusted', { light: { theme: 'github-light', background: '#FFFDF9' }, dark: { theme: 'github-dark', background: '#0D0D0D' } }],
    ['one side of a pair', { dark: 'github-dark' }],
    ['a theme, adjusted', { theme: 'github-dark', background: '#0D0D0D', foreground: '#C0C0C0', keyword: '#E8814F' }],
    ['colours on the default', { background: '#1c1917', foreground: '#e7e5e4', comment: '#78716c' }],
    ['every colour key', Object.fromEntries(CODE_COLOR_KEYS.map((key) => [key, '#123456']))],
  ])('%s', (_label, code) => {
    expect(errorsOf(code)).toEqual([])
  })

  it('a colour in any form CSS has — not only one a palette can be shaded from', () => {
    for (const value of ['#fff', '#24292e80', 'rgb(1 2 3 / 50%)', 'hsl(210 50% 40%)', 'oklch(0.7 0.1 250)', 'transparent', 'rebeccapurple', 'currentColor', 'var(--surface)', 'color-mix(in oklch, red, blue)']) {
      expect(isCodeColor(value), value).toBe(true)
      expect(errorsOf({ background: value }), value).toEqual([])
    }
  })
})

describe('what an author can fix is named', () => {
  it('a key kit does not read', () => {
    expect(errorsOf({ keywrod: '#f00' })).toEqual([expect.stringMatching(/^code\.keywrod is not a code colour — the colours are background, foreground, comment/)])
    expect(errorsOf({ light: { theme: 'github-light', lineNumber: '#888' } })).toEqual([expect.stringMatching(/^code\.light\.lineNumber is not a code colour/)])
  })

  it('a theme named with anything but a name — kit refuses it, so the site would get the default', () => {
    expect(errorsOf('Github Dark')).toEqual([expect.stringMatching(/^code: "Github Dark" is not a theme name — name one of Shiki's themes/)])
    expect(errorsOf({ theme: '../x' })).toEqual([expect.stringMatching(/^code\.theme: "\.\.\/x" is not a theme name/)])
    expect(errorsOf({ light: 'github light', dark: 'github-dark' })).toEqual([expect.stringMatching(/^code\.light: "github light" is not a theme name/)])
  })

  it('a colour that is not one', () => {
    expect(errorsOf({ background: '#12' })).toEqual(['code.background has invalid color value: #12'])
    expect(errorsOf({ background: 12 })).toEqual(['code.background must be a colour, got number'])
  })

  it('a colour beside a pair, which kit never reads', () => {
    expect(errorsOf({ light: 'github-light', dark: 'github-dark', background: '#000' })).toEqual([
      'code.background beside light and dark does nothing — set it on a side, as code.light.background',
    ])
  })

  it('a shape kit cannot read', () => {
    expect(errorsOf(['github-dark'])).toEqual(['code must be a theme name, a light/dark pair, or a map of colours, got a list'])
    expect(errorsOf({ light: { dark: 'x' } })).toEqual(['code.light.dark: a side of a pair cannot hold another pair'])
    expect(errorsOf({ light: 3 })).toEqual(['code.light must be a theme name or a map of colours, got number'])
  })
})

describe('what travels', () => {
  it('⭐ a pair whose sides are maps reaches the renderer, side by side', () => {
    const declared = { light: { theme: 'github-light', background: '#FFFDF9' }, dark: { theme: 'github-dark', background: '#0D0D0D' } }
    const { config, errors, warnings } = processTheme({ code: declared })
    expect(config.code).toEqual(declared)
    expect(errors).toEqual([])
    expect(warnings.filter((w) => /\bcode\b/.test(w))).toEqual([])
  })

  it('a value a stylesheet could not hold is left out of its side, with a warning naming it', () => {
    const warnings = []
    const kept = keepWritableCode({ light: { theme: 'github-light', background: '#fff; color: red' }, dark: 'github-dark' }, warnings)
    expect(kept).toEqual({ light: { theme: 'github-light' }, dark: 'github-dark' })
    expect(warnings).toEqual(['theme: code.light.background: "#fff; color: red" is not a CSS value — left out'])
  })

  it('a name travels as written, and nothing declared is nothing', () => {
    expect(keepWritableCode('dracula', [])).toBe('dracula')
    expect(keepWritableCode(undefined, [])).toBeNull()
  })

  it('the three forms through processTheme: no errors', () => {
    for (const code of ['dracula', { light: 'github-light', dark: 'github-dark' }, { theme: 'github-dark', background: '#0D0D0D' }]) {
      expect(processTheme({ code }).errors, JSON.stringify(code)).toEqual([])
    }
  })
})
