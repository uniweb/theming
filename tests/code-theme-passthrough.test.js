/**
 * `theme.yml`'s `code:` travels exactly as declared.
 *
 * This module used to merge a full default palette into it, so a site naming a
 * bundled theme and overriding one colour arrived downstream carrying fifteen —
 * and the theme it named was overridden in full by values it never asked for.
 * The symptom was a listing declared as github-dark rendering Catppuccin greens.
 *
 * The default belongs to whoever renders code; this layer only carries the
 * site's words.
 */

import { describe, it, expect } from 'vitest'
import { processTheme } from '../src/processor.js'

const codeOf = (yml) => processTheme(yml).config.code

describe('code: pass-through', () => {
  it('is null when a site declares nothing', () => {
    expect(codeOf({})).toBeNull()
  })

  it('carries a bare theme name', () => {
    expect(codeOf({ code: 'dracula' })).toBe('dracula')
  })

  it('carries a light/dark pair untouched', () => {
    expect(codeOf({ code: { light: 'github-light', dark: 'github-dark' } }))
      .toEqual({ light: 'github-light', dark: 'github-dark' })
  })

  it('carries a sparse override without inventing the rest', () => {
    // The regression: fifteen keys used to arrive where the site wrote two.
    const code = codeOf({ code: { theme: 'github-dark', background: '#0D0D0D' } })

    expect(code).toEqual({ theme: 'github-dark', background: '#0D0D0D' })
    expect(Object.keys(code)).toHaveLength(2)
  })

  it('carries a full hand-picked palette when that is what was written', () => {
    const declared = { background: '#111', foreground: '#eee', keyword: '#f0f' }
    expect(codeOf({ code: declared })).toEqual(declared)
  })
})
