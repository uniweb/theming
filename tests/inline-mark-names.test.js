import { describe, it, expect } from 'vitest'
import { processTheme } from '../src/processor.js'

/**
 * ⭐ `[x]{underline}`, `[2]{sup}` and `[2]{sub}` write marks of their own, drawn as <u>, <sup> and
 * <sub> (2026-11-17), so an inline style by one of those names would never apply: the theme leaves it
 * out and says what the name does instead.
 */
describe("a theme style named for a mark", () => {
  it('⭐ is left out, and the warning says what the name writes', () => {
    const { config, warnings } = processTheme({ inline: { sub: { 'font-size': '0.7em' }, Underline: { color: 'red' }, highlight: { 'background-color': 'yellow' } } })
    expect(config.inline).not.toHaveProperty('sub')
    expect(config.inline).not.toHaveProperty('Underline')
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('`sub` is subscript, a mark of its own — `[text]{sub}` is drawn as <sub>'),
        expect.stringContaining('`Underline` is underline, a mark of its own'),
      ]),
    )
  })

  it('CONTROL — any other name is a style, highlight included', () => {
    const { config, warnings } = processTheme({ inline: { highlight: { 'background-color': 'yellow' } } })
    expect(config.inline.highlight['background-color']).toBe('yellow')
    expect(warnings.filter((w) => w.includes('mark of its own'))).toEqual([])
  })
})
