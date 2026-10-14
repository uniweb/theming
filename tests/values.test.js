/**
 * A theme value stays a value.
 *
 * A theme is content — theme.yml, a section's `theme:`, and what an editor lets
 * an author change of them — and a prerendered page carries its CSS in a
 * <style> and its font URLs in <link> tags. Until 2026-10-14 every value was
 * written as given: `</style><script>…` in a theme value ran as script, and a
 * quote in a font URL opened an attribute.
 */

import { describe, it, expect } from 'vitest'
import { buildTheme, buildSectionOverrides } from '../src/index.js'
import { processTheme } from '../src/processor.js'
import { isCssValue, isLoadableUrl, isCssName, escapeAttribute, closeToMarkup } from '../src/values.js'

const BREAKOUT = 'red;}</style><script>alert(1)</script><style>'

describe('what a value may be', () => {
  it.each([
    '#fff', 'rgb(1, 2, 3)', 'oklch(70% 0.1 200 / 50%)', 'var(--primary-500)', '1.5rem', 'calc(100% - 2rem)',
    '"Inter", system-ui, sans-serif', 'linear-gradient(to right, #fff 0%, rgba(0,0,0,.5) 100%)',
    'url(/images/bg.jpg) center / cover', 'url("https://cdn.test/a.png")', 400,
  ])('%j is a value', (v) => expect(isCssValue(v)).toBe(true))

  it.each([
    BREAKOUT, 'red; background: blue', 'a { b', 'a } b', 'x\\3c script', 'a /* b */', 'x\ny',
    'url(javascript:alert(1))', 'url("data:image/svg+xml,<svg onload=alert(1)>")', 'expression(alert(1))',
    '@import url(https://x.test/a.css)', null, {}, NaN,
  ])('%j is not', (v) => expect(isCssValue(v)).toBe(false))

  it('a URL a page may load is relative or http(s), and cannot leave its attribute', () => {
    for (const ok of ['/fonts/a.woff2', 'fonts/a.woff2', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap']) {
      expect(isLoadableUrl(ok)).toBe(true)
    }
    for (const bad of ['javascript:alert(1)', 'data:font/woff2;base64,AAAA', 'https://x.test/a"><script>', "https://x.test/a')", '/a b']) {
      expect(isLoadableUrl(bad)).toBe(false)
    }
  })

  it('a name is a CSS identifier of ours', () => {
    expect(isCssName('header-height')).toBe(true)
    expect(isCssName('my_style')).toBe(true)
    for (const bad of ['a:b', 'x{}', '1x', '', 'a b']) expect(isCssName(bad)).toBe(false)
  })

  it('no < leaves a stylesheet, and the character is kept in a string', () => {
    expect(closeToMarkup('a</style><script>')).not.toContain('<')
    expect(closeToMarkup('content: "<"')).toBe('content: "\\3c "')
    expect(escapeAttribute('a"b&c<d')).toBe('a&quot;b&amp;c&lt;d')
  })
})

describe('a theme', () => {
  const hostile = {
    background: BREAKOUT,
    contexts: { light: { section: BREAKOUT, 'x{}': '#fff', heading: '#111' } },
    vars: { 'header-height': BREAKOUT, 'bad name': '1rem', gap: '2rem' },
    inline: { accent: { color: BREAKOUT, 'font-weight': '600' }, 'x]{}': { color: 'red' } },
    fonts: {
      body: BREAKOUT,
      import: [{ url: 'https://x.test/a.css"><script>alert(2)</script>' }, { url: 'javascript:alert(3)' }],
      faces: [{ family: 'Mine', src: "/f.woff2') format('woff2'); } </style><script>alert(4)" }],
    },
    code: { background: BREAKOUT, light: 'github-light' },
  }

  it('leaves out each value a stylesheet cannot hold, and says so', () => {
    const { config, warnings } = processTheme(hostile)
    expect(config.background).toBeNull()
    expect(config.contexts.light.heading).toBe('#111')
    expect(config.contexts.light).not.toHaveProperty('x{}')
    expect(config.contexts.light.section).not.toBe(BREAKOUT)
    expect(config.foundationVars).toEqual({ gap: { default: '2rem' } })
    expect(config.inline.accent).toEqual({ 'font-weight': '600' })
    expect(config.inline).not.toHaveProperty('x]{}')
    expect(config.fonts.import).toEqual([])
    expect(config.fonts.faces).toEqual([])
    expect(config.code).toEqual({ light: 'github-light' })
    expect(warnings.filter((w) => w.startsWith('theme: ')).length).toBeGreaterThanOrEqual(10)
  })

  it('reaches no markup from them', () => {
    const { css, links } = buildTheme(hostile)
    expect(css).not.toMatch(/<|alert|script/)
    expect(links || '').not.toMatch(/script|alert|javascript/)
  })

  it('CONTROL — an ordinary theme is written as before', () => {
    const { css, links } = buildTheme({
      colors: { primary: '#3b82f6' },
      background: 'url(/bg.jpg) center / cover',
      vars: { 'header-height': '4rem' },
      inline: { accent: { color: 'var(--accent)' } },
      fonts: {
        body: '"Inter", sans-serif',
        import: [{ url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap' }],
      },
    }, { foundationVars: { 'header-height': { default: '3rem' } } })
    expect(css).toContain('background: url(/bg.jpg) center / cover;')
    expect(css).toContain('--header-height: 4rem;')
    expect(css).toContain('span[accent] {')
    expect(links).toContain('href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&amp;display=swap"')
  })
})

describe('a section’s overrides', () => {
  it('hold their names and values to the same rule, and an id selects only its section', () => {
    const css = buildSectionOverrides([
      {
        stableId: 'hero"]{}</style><script>alert(5)</script>',
        componentVars: { gap: '1rem', 'x{}': '1rem', pad: BREAKOUT },
        themeOverrides: { colors: { primary: BREAKOUT }, tokens: { heading: BREAKOUT, body: '#222' } },
      },
    ])
    // The id is kept, escaped into a CSS identifier: its letters stay, nothing opens.
    expect(css).not.toMatch(/<|alert\(|\]\{/)
    expect(css).toContain('#section-hero\\22 \\5d \\7b \\7d \\3c ')
    expect(css).toContain('--gap: 1rem;')
    expect(css).toContain('--body: #222;')
    expect(css).not.toContain('--pad')
    expect(css).not.toContain('--heading')
  })
})
