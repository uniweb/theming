import { describe, it, expect } from 'vitest'
import { buildSectionOverrides } from '../src/section-overrides.js'

// Helper: minimal block-like object
const makeBlock = (overrides = {}) => ({
  id: '1',
  stableId: null,
  themeName: '',
  standardOptions: {},
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

    it('skips blocks with no standardOptions', () => {
      const blocks = [makeBlock()]
      expect(buildSectionOverrides(blocks)).toBe('')
    })

    it('skips blocks with empty colors and no foundationStyles', () => {
      const blocks = [makeBlock({ standardOptions: { colors: {} } })]
      expect(buildSectionOverrides(blocks)).toBe('')
    })
  })

  describe('section ID', () => {
    it('uses stableId when available', () => {
      const blocks = [
        makeBlock({
          id: '99',
          stableId: 'hero',
          standardOptions: { foundationStyles: { gap: '2rem' } },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).toContain('#section-hero')
      expect(css).not.toContain('#section-99')
    })

    it('falls back to id when stableId is null', () => {
      const blocks = [
        makeBlock({
          id: '42',
          standardOptions: { foundationStyles: { gap: '2rem' } },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).toContain('#section-42')
    })
  })

  describe('foundation styles', () => {
    it('emits foundation style vars', () => {
      const blocks = [
        makeBlock({
          id: '1',
          standardOptions: {
            foundationStyles: {
              'border-radius': '0.5rem',
              gap: '2rem',
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).toContain('--border-radius: 0.5rem;')
      expect(css).toContain('--gap: 2rem;')
    })

    it('skips empty string values', () => {
      const blocks = [
        makeBlock({
          id: '1',
          standardOptions: {
            foundationStyles: { gap: '', padding: '1rem' },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).not.toContain('--gap')
      expect(css).toContain('--padding: 1rem;')
    })
  })

  describe('element token overrides', () => {
    it('normalizes rgba DB format to color-mix', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'light',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'rgba(var(--primary-900) / 0.50)' },
              },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).toContain(
        '--heading: color-mix(in srgb, var(--primary-900) 50%, transparent);'
      )
    })

    it('normalizes bare palette refs to var()', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'dark',
          standardOptions: {
            colors: {
              elements: {
                dark: { heading: 'neutral-100', accent: 'primary-500' },
              },
            },
          },
        }),
      ]
      // With toggle enabled, pinned sections use their context key
      const css = buildSectionOverrides(blocks, { allowToggle: true })
      expect(css).toContain('--heading: var(--neutral-100);')
      expect(css).toContain('--accent: var(--primary-500);')
    })

    it('strips rgba wrapper for full opacity', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'light',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'rgba(var(--primary-900) / 1.00)' },
              },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).toContain('--heading: var(--primary-900);')
    })
  })

  describe('base palette overrides', () => {
    it('generates palette shades from base colors', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'light',
          standardOptions: {
            colors: {
              colors: { light: { primary: '#3b82f6' } },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      // Should contain generated palette shades
      expect(css).toContain('--primary-500:')
      expect(css).toContain('--primary-50:')
      expect(css).toContain('--primary-900:')
    })
  })

  describe('pinned section (single context)', () => {
    it('uses pinned context for element tokens when toggle is on', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'dark',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'var(--primary-900)' },
                dark: { heading: 'var(--primary-100)' },
              },
            },
          },
        }),
      ]
      // With toggle enabled, pinned sections use their context key
      const css = buildSectionOverrides(blocks, { allowToggle: true })
      // Should use dark context
      expect(css).toContain('--heading: var(--primary-100);')
      // Should NOT contain light context tokens
      expect(css).not.toContain('--heading: var(--primary-900);')
    })

    it('uses light bucket for pinned sections when toggle is off', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'dark',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'var(--primary-900)' },
                dark: { heading: 'var(--primary-100)' },
              },
            },
          },
        }),
      ]
      // Without toggle, always use 'light' bucket regardless of themeName
      const css = buildSectionOverrides(blocks)
      expect(css).toContain('--heading: var(--primary-900);')
      expect(css).not.toContain('--heading: var(--primary-100);')
    })

    it('emits single rule for pinned section', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'dark',
          standardOptions: {
            colors: {
              elements: { dark: { heading: 'var(--primary-100)' } },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
      expect(css).not.toContain('.scheme-dark')
    })
  })

  describe('Auto section without toggle', () => {
    it('uses site default appearance for element tokens', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: '',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'var(--primary-900)' },
              },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks, { default: 'light' })
      expect(css).toContain('--heading: var(--primary-900);')
      expect(css).not.toContain('.scheme-dark')
    })
  })

  describe('Auto section with toggle (dual rules)', () => {
    it('scopes light elements to :root:not(.scheme-dark) and dark to .scheme-dark', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: '',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'var(--primary-900)' },
                dark: { heading: 'var(--primary-100)' },
              },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks, { allowToggle: true })

      // Light elements scoped so they don't leak into dark
      expect(css).toContain(':root:not(.scheme-dark) #section-1 {\n')
      expect(css).toContain('--heading: var(--primary-900);')

      // Dark override rule
      expect(css).toContain('.scheme-dark #section-1 {\n')
      expect(css).toContain('--heading: var(--primary-100);')
    })

    it('puts palette and foundation in shared rule, not in scoped rules', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: '',
          standardOptions: {
            colors: {
              colors: { light: { primary: '#3b82f6' } },
              elements: {
                light: { heading: 'var(--primary-900)' },
                dark: { heading: 'var(--primary-100)' },
              },
            },
            foundationStyles: { gap: '2rem' },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks, { allowToggle: true })

      // Shared rule has palette + foundation (context-independent)
      expect(css).toContain('#section-1 {\n')
      expect(css).toContain('--primary-500:')
      expect(css).toContain('--gap: 2rem;')

      // Dark rule should not have palette or foundation
      const darkRule = css.split('.scheme-dark #section-1')[1] || ''
      expect(darkRule).not.toContain('--primary-500')
      expect(darkRule).not.toContain('--gap')
    })

    it('skips dark rule when no dark elements exist', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: '',
          standardOptions: {
            colors: {
              elements: {
                light: { heading: 'var(--primary-900)' },
              },
            },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks, { allowToggle: true })
      // No `.scheme-dark #section-1` rule (no dark elements)
      expect(css).not.toContain('.scheme-dark #section-1 {')
      // Light elements still scoped
      expect(css).toContain(':root:not(.scheme-dark) #section-1')
    })
  })

  describe('multiple blocks', () => {
    it('generates rules for all blocks with overrides', () => {
      const blocks = [
        makeBlock({
          id: '1',
          themeName: 'light',
          standardOptions: {
            colors: {
              elements: { light: { heading: 'var(--primary-900)' } },
            },
          },
        }),
        makeBlock({ id: '2', standardOptions: {} }), // no overrides — skipped
        makeBlock({
          id: '3',
          stableId: 'cta',
          themeName: 'dark',
          standardOptions: {
            foundationStyles: { padding: '3rem' },
          },
        }),
      ]
      const css = buildSectionOverrides(blocks)
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

  it('comes after the older editor envelope, so the section’s theme wins', () => {
    const css = buildSectionOverrides([
      themed('dark', { tokens: { heading: 'var(--new)' } }, { standardOptions: { colors: { elements: { light: { heading: 'var(--old)' } } } } }),
    ])
    expect(css.indexOf('var(--old)')).toBeLessThan(css.indexOf('var(--new)'))
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
