/**
 * The page behind the sections.
 *
 * Sections paint themselves — `[id^="section-"] { background-color: var(--section) }`
 * — and on a page whose sections run the full width, that covers the viewport.
 * It does not cover a layout with columns. A documentation shell paints its two
 * rails and its article and leaves the space between them unpainted, which fell
 * through to the browser's white in *both* schemes: a dark site showed a white
 * page around dark panels.
 *
 * So the page gets a background by default, and it is the same token the
 * sections use, which already flips with the visitor's scheme.
 */

import { describe, it, expect } from 'vitest'
import { buildTheme } from '../src/index.js'

const cssFor = (yml) => buildTheme(yml).css

describe('site background', () => {
  it('defaults to the section token, so the page matches what sits on it', () => {
    expect(cssFor({})).toMatch(/body\s*{\s*background:\s*var\(--section\);?\s*}/)
  })

  it('follows the scheme, because the token does', () => {
    // Not asserting a colour — asserting that the page reads the same variable
    // the context classes redefine, which is what makes dark mode work.
    const css = cssFor({ colors: { primary: '#E35D25' }, appearance: { schemes: ['light', 'dark'] } })

    expect(css).toContain('background: var(--section)')
    expect(css).toMatch(/--section:/)
  })

  it('is replaced by an explicit background:', () => {
    const css = cssFor({ background: '#123456' })

    expect(css).toContain('background: #123456')
    expect(css).not.toContain('background: var(--section)')
  })

  it('accepts a non-colour background, which is why this stays the shorthand', () => {
    const css = cssFor({ background: 'linear-gradient(180deg, #fff, #eee)' })

    expect(css).toContain('background: linear-gradient(180deg, #fff, #eee)')
  })

  it('still paints sections — the page does not replace that', () => {
    const css = cssFor({})

    expect(css).toContain('[id^="section-"]')
    expect(css).toContain('background-color: var(--section)')
  })
})
