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
      expect(css).toContain('--foundation-border-radius: 0.5rem;')
      expect(css).toContain('--foundation-gap: 2rem;')
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
      expect(css).not.toContain('--foundation-gap')
      expect(css).toContain('--foundation-padding: 1rem;')
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
      expect(css).toContain('--foundation-gap: 2rem;')

      // Dark rule should not have palette or foundation
      const darkRule = css.split('.scheme-dark #section-1')[1] || ''
      expect(darkRule).not.toContain('--primary-500')
      expect(darkRule).not.toContain('--foundation-gap')
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
