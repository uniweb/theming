import { describe, it, expect } from 'vitest'
import { buildSectionOverrides } from '../src/section-overrides.js'

// Helper: minimal block-like object
const makeBlock = (overrides = {}) => ({
  id: '1',
  stableId: null,
  themeName: '',
  ...overrides,
})

describe('buildSectionOverrides', () => {
  describe('no overrides', () => {
    it('returns empty string for empty blocks array', () => {
      expect(buildSectionOverrides([], {})).toBe('')
    })

    it('returns empty string for null/undefined blocks', () => {
      expect(buildSectionOverrides(null)).toBe('')
      expect(buildSectionOverrides(undefined)).toBe('')
    })

    it('skips a block with no theme and no component variables', () => {
      expect(buildSectionOverrides([makeBlock()])).toBe('')
      expect(buildSectionOverrides([makeBlock({ themeOverrides: { colors: {}, contexts: {}, vars: {}, tokens: {} } })])).toBe('')
    })

    // ⛔ An editor's older envelope — `{ colors, foundationStyles }` — is no longer read
    // (2026-09-28): an editor writes the section's `theme`, and @uniweb/core no longer sets
    // `block.standardOptions`. Until then these rules came from it.
    it('reads no older editor envelope', () => {
      const legacy = { colors: { colors: { light: { primary: '#3b82f6' } }, elements: { light: { heading: 'var(--old)' } } }, foundationStyles: { gap: '2rem' } }
      expect(buildSectionOverrides([makeBlock({ standardOptions: legacy })], { allowToggle: true })).toBe('')
    })
  })

  describe('section ID', () => {
    it('uses stableId when available', () => {
      const css = buildSectionOverrides([makeBlock({ id: '99', stableId: 'hero', themeOverrides: { vars: { gap: '2rem' } } })])
      expect(css).toContain('#section-hero')
      expect(css).not.toContain('#section-99')
    })

    it('falls back to id when stableId is null', () => {
      const css = buildSectionOverrides([makeBlock({ id: '42', themeOverrides: { vars: { gap: '2rem' } } })])
      expect(css).toContain('#section-42')
    })
  })

  describe('variables', () => {
    it('emits the section’s `vars` and the component’s variables', () => {
      const css = buildSectionOverrides([
        makeBlock({ themeOverrides: { vars: { 'border-radius': '0.5rem' } }, componentVars: { gap: '2rem' } }),
      ])
      expect(css).toContain('--border-radius: 0.5rem;')
      expect(css).toContain('--gap: 2rem;')
    })

    it('skips empty string values', () => {
      const css = buildSectionOverrides([makeBlock({ themeOverrides: { vars: { gap: '', padding: '1rem' } } })])
      expect(css).not.toContain('--gap')
      expect(css).toContain('--padding: 1rem;')
    })
  })

  describe('token values', () => {
    const tokenCss = (value) => buildSectionOverrides([makeBlock({ themeName: 'light', themeOverrides: { tokens: { heading: value } } })])

    it('normalizes rgba DB format to color-mix', () => {
      expect(tokenCss('rgba(var(--primary-900) / 0.50)')).toContain('--heading: color-mix(in srgb, var(--primary-900) 50%, transparent);')
    })

    it('normalizes bare palette refs to var()', () => {
      const css = buildSectionOverrides([
        makeBlock({ themeName: 'dark', themeOverrides: { contexts: { dark: { heading: 'neutral-100', accent: 'primary-500' } } } }),
      ])
      expect(css).toContain('--heading: var(--neutral-100);')
      expect(css).toContain('--accent: var(--primary-500);')
    })

    it('strips rgba wrapper for full opacity', () => {
      expect(tokenCss('rgba(var(--primary-900) / 1.00)')).toContain('--heading: var(--primary-900);')
    })
  })

  describe('palette', () => {
    it('generates palette shades from base colors', () => {
      const css = buildSectionOverrides([makeBlock({ themeName: 'light', themeOverrides: { colors: { primary: '#3b82f6' } } })])
      expect(css).toContain('--primary-500:')
      expect(css).toContain('--primary-50:')
      expect(css).toContain('--primary-900:')
    })
  })

  describe('multiple blocks', () => {
    it('generates rules for all blocks with overrides', () => {
      const css = buildSectionOverrides([
        makeBlock({ id: '1', themeName: 'light', themeOverrides: { tokens: { heading: 'var(--primary-900)' } } }),
        makeBlock({ id: '2' }), // no overrides — skipped
        makeBlock({ id: '3', stableId: 'cta', themeName: 'dark', componentVars: { padding: '3rem' } }),
      ])
      expect(css).toContain('#section-1')
      expect(css).not.toContain('#section-2')
      expect(css).toContain('#section-cta')
    })
  })
})

// ─── the section's `theme:` — theme.yml's keys, scoped to the section [2026-09-28] ────────────
describe('buildSectionOverrides — a section’s theme', () => {
  const themed = (themeName, themeOverrides, extra = {}) =>
    makeBlock({ stableId: 'hero', themeName, themeOverrides, ...extra })

  it('a pinned section: its palette, its own context’s tokens and vars, and its tokens — one rule', () => {
    const css = buildSectionOverrides([
      themed('dark', {
        colors: { primary: '#0a6' },
        contexts: { dark: { link: 'var(--accent-300)' }, light: { link: 'var(--accent-700)' } },
        vars: { 'header-height': '5rem', glow: { dark: 'red', light: 'blue' } },
        tokens: { heading: 'var(--primary-900)' },
      }),
    ])
    expect(css).toMatch(/^#section-hero \{/)
    expect(css).toContain('--primary-500:')
    expect(css).toContain('--link: var(--accent-300);')
    expect(css).not.toContain('var(--accent-700)')
    expect(css).toContain('--header-height: 5rem;')
    expect(css).toContain('--glow: red;')
    expect(css).not.toContain('--glow: blue;')
    expect(css).toContain('--heading: var(--primary-900);')
    expect(css).not.toContain('scheme-dark')
  })

  it('a context’s own token comes after one written beside `mode`, so it wins', () => {
    const css = buildSectionOverrides([
      themed('dark', { tokens: { heading: 'var(--any)' }, contexts: { dark: { heading: 'var(--dark-only)' } } }),
    ])
    expect(css.indexOf('var(--any)')).toBeLessThan(css.indexOf('var(--dark-only)'))
  })

  it('an Auto section: light tokens under a light scheme, dark under .scheme-dark', () => {
    const css = buildSectionOverrides([
      themed('', { contexts: { light: { link: 'var(--a)' }, dark: { link: 'var(--b)' } }, tokens: { heading: 'var(--h)' } }),
    ])
    expect(css).toContain('#section-hero {\n  --heading: var(--h);\n}')
    expect(css).toContain(':root:not(.scheme-dark) #section-hero {\n  --link: var(--a);\n}')
    expect(css).toContain('.scheme-dark #section-hero {\n  --link: var(--b);\n}')
  })

  it('needs no toggle to follow the site: the dark rule matches only when the site is dark', () => {
    const css = buildSectionOverrides([themed('', { contexts: { dark: { link: 'var(--b)' } } })], { allowToggle: false })
    expect(css).toContain('.scheme-dark #section-hero')
  })

  it('a section that overrides nothing gets no rule', () => {
    expect(buildSectionOverrides([themed('dark', null)])).toBe('')
  })

  it('is the only source of the section’s colors — an older editor envelope beside it is not read', () => {
    const css = buildSectionOverrides([
      themed('dark', { tokens: { heading: 'var(--new)' } }, { standardOptions: { colors: { elements: { light: { heading: 'var(--old)' } } } } }),
    ])
    expect(css).toContain('var(--new)')
    expect(css).not.toContain('var(--old)')
  })
})

describe('buildSectionOverrides — child sections', () => {
  it('get their own rules, at any depth', () => {
    const grandchild = makeBlock({ stableId: 'leaf', themeName: 'dark', themeOverrides: { tokens: { heading: 'var(--leaf)' } } })
    const child = makeBlock({ stableId: 'card', themeName: 'dark', themeOverrides: { tokens: { heading: 'var(--card)' } }, childBlocks: [grandchild] })
    const parent = makeBlock({ stableId: 'grid', childBlocks: [child] })
    const css = buildSectionOverrides([parent])
    expect(css).toContain('#section-card {')
    expect(css).toContain('#section-leaf {')
  })
})

describe('buildSectionOverrides — a site that follows the visitor’s system', () => {
  const auto = makeBlock({ stableId: 'hero', themeName: '', themeOverrides: { contexts: { light: { link: 'var(--a)' }, dark: { link: 'var(--b)' } } } })

  it('also applies an Auto section’s dark values under the system’s dark query, as the theme does', () => {
    const css = buildSectionOverrides([auto], { default: 'system' })
    expect(css).toContain('@media (prefers-color-scheme: dark) {\n:root:not(.scheme-light) #section-hero {\n  --link: var(--b);\n}\n}')
    // after the light rule, so it wins where both match
    expect(css.indexOf(':root:not(.scheme-dark) #section-hero')).toBeLessThan(css.indexOf('@media'))
  })

  it('adds no query for a site that does not follow the system, nor for a pinned section', () => {
    expect(buildSectionOverrides([auto], { default: 'light', allowToggle: true })).not.toContain('@media')
    const pinned = makeBlock({ stableId: 'p', themeName: 'dark', themeOverrides: { contexts: { dark: { link: 'var(--b)' } } } })
    expect(buildSectionOverrides([pinned], { default: 'system' })).not.toContain('@media')
  })
})
