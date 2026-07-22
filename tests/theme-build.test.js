import { describe, it, expect } from 'vitest'
import { buildTheme, extractUsedFamilies } from '../src/index.js'

describe('Theme Build Pipeline', () => {
  describe('buildTheme', () => {
    it('builds theme with default config', () => {
      const result = buildTheme({})

      expect(result).toHaveProperty('css')
      expect(result).toHaveProperty('links')
      expect(result).toHaveProperty('config')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(result.errors).toHaveLength(0)
    })

    it('generates CSS with all palette shades', () => {
      const result = buildTheme({
        colors: {
          primary: '#3b82f6',
        },
      })

      // Check all shade levels are present
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      for (const shade of shades) {
        expect(result.css).toContain(`--primary-${shade}:`)
      }
    })

    it('generates OKLCH color values', () => {
      const result = buildTheme({
        colors: { primary: '#3b82f6' },
      })

      expect(result.css).toContain('oklch(')
    })

    it('includes context classes in CSS', () => {
      const result = buildTheme({})

      expect(result.css).toContain('.context-light')
      expect(result.css).toContain('.context-medium')
      expect(result.css).toContain('.context-dark')
    })

    it('includes semantic tokens in contexts', () => {
      const result = buildTheme({})

      // Each context should have semantic tokens
      expect(result.css).toMatch(/\.context-light[^}]+--section:/)
      expect(result.css).toMatch(/\.context-light[^}]+--body:/)
      expect(result.css).toMatch(/\.context-dark[^}]+--section:/)
    })

    it('applies custom context token overrides', () => {
      const result = buildTheme({
        contexts: {
          light: {
            'custom-token': '#ff0000',
          },
        },
      })

      expect(result.css).toContain('--custom-token: #ff0000')
    })

    it('includes font configuration', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          heading: 'Poppins, sans-serif',
        },
      })

      expect(result.css).toContain('--font-body: Inter, sans-serif')
      expect(result.css).toContain('--font-heading: Poppins, sans-serif')
    })

    it('applies site-set font slots to elements (not just :root vars)', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          heading: 'Poppins, sans-serif',
          code: 'Fira Code, monospace',
        },
      })

      // Vars alone are orphaned — there must be an application rule per slot.
      expect(result.css).toContain('body { font-family: var(--font-body); }')
      expect(result.css).toContain('h1, h2, h3 { font-family: var(--font-heading); }')
      expect(result.css).toContain('code, pre, kbd, samp { font-family: var(--font-code); }')
    })

    it('does not apply font rules for slots the site did not set', () => {
      // Only heading is site-set; body/code fall back to foundation defaults
      // and must NOT get a forced application rule.
      const result = buildTheme({
        fonts: {
          heading: 'Poppins, sans-serif',
        },
      })

      expect(result.css).toContain('h1, h2, h3 { font-family: var(--font-heading); }')
      expect(result.css).not.toContain('body { font-family: var(--font-body); }')
      expect(result.css).not.toContain('code, pre, kbd, samp { font-family: var(--font-code); }')
    })

    it('emits --font-code (not --font-mono) for the code role', () => {
      const result = buildTheme({ fonts: { code: 'Fira Code, monospace' } })
      expect(result.css).toContain('--font-code: Fira Code, monospace')
      // Clean cut: the framework never writes --font-mono anymore.
      expect(result.css).not.toContain('--font-mono')
    })

    it('does not alias `fonts.mono` to code — it sets a plain `mono` role and warns', () => {
      const result = buildTheme({ fonts: { mono: 'Fira Code, monospace' } })
      // `mono` is an ordinary role now: it emits --font-mono, not the code role,
      // and is not painted onto code elements.
      expect(result.css).toContain('--font-mono: Fira Code, monospace')
      expect(result.css).not.toContain('code, pre, kbd, samp { font-family: var(--font-code); }')
      expect(result.warnings.some((w) => /`fonts\.mono` is not a built-in font role/.test(w))).toBe(true)
    })

    it('treats `code` and `mono` as independent roles (no aliasing)', () => {
      const result = buildTheme({
        fonts: { code: 'JetBrains Mono, monospace', mono: 'Fira Code, monospace' },
      })
      expect(result.css).toContain('--font-code: JetBrains Mono, monospace')
      expect(result.css).toContain('--font-mono: Fira Code, monospace')
    })

    it('generates link tags for Google Fonts imports (not @import)', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Inter' },
          ],
        },
      })

      // Should NOT use @import in CSS
      expect(result.css).not.toContain('@import')
      // Should produce <link> tags
      expect(result.links).toContain('fonts.googleapis.com')
      expect(result.links).toContain('preconnect')
      expect(result.links).toContain('fonts.gstatic.com')
    })

    it('emits canonical css2 URLs (literal axis separators, not percent-encoded)', () => {
      const result = buildTheme({
        fonts: {
          body: 'Amatic SC, cursive',
          heading: 'DM Serif Display, serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital,wght@0,400;1,400&display=swap' },
            { url: 'https://fonts.googleapis.com/css2?family=Amatic%20SC:wght@400;700&display=swap' },
          ],
        },
      })

      const styleHref = result.links.match(/rel="stylesheet" href="([^"]+)"/)[1]
      // css2 axis chars ( : , @ ; ) must stay literal — Google's canonical form.
      // URLSearchParams.toString() would percent-encode them (%3A/%2C/%40/%3B).
      expect(styleHref).not.toMatch(/%3A|%2C|%40|%3B/i)
      expect(styleHref).toContain('family=DM+Serif+Display:ital,wght@0,400;1,400')
      expect(styleHref).toContain('family=Amatic+SC:wght@400;700')
    })

    it('includes foundation vars in CSS', () => {
      const result = buildTheme({}, {
        foundationVars: {
          'header-height': { type: 'length', default: '64px' },
          'sidebar-width': '280px',
        },
      })

      expect(result.css).toContain('--header-height: 64px')
      expect(result.css).toContain('--sidebar-width: 280px')
    })

    it('allows site to override foundation vars', () => {
      const result = buildTheme(
        {
          vars: {
            'header-height': '80px',
          },
        },
        {
          foundationVars: {
            'header-height': { type: 'length', default: '64px' },
          },
        }
      )

      expect(result.css).toContain('--header-height: 80px')
      expect(result.css).not.toContain('--header-height: 64px')
    })

    it('includes dark scheme CSS when toggle enabled', () => {
      const result = buildTheme({
        appearance: {
          allowToggle: true,
        },
      })

      expect(result.css).toContain('.scheme-dark')
    })

    it('does not include dark scheme CSS by default', () => {
      const result = buildTheme({})

      expect(result.css).not.toContain('.scheme-dark')
    })

    it('returns processed config object', () => {
      const result = buildTheme({
        colors: { primary: '#ff0000' },
      })

      expect(result.config).toHaveProperty('colors')
      expect(result.config.colors.primary).toBe('#ff0000')
      expect(result.config).toHaveProperty('contexts')
      expect(result.config).toHaveProperty('fonts')
      expect(result.config).toHaveProperty('appearance')
    })

    it('generates warnings for missing primary color', () => {
      const result = buildTheme({})

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('primary'))).toBe(true)
    })

    it('generates errors for invalid colors', () => {
      const result = buildTheme({
        colors: {
          invalid: 'not-a-color',
        },
      })

      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('handles pre-defined shade objects', () => {
      const result = buildTheme({
        colors: {
          custom: {
            50: '#fef2f2',
            500: '#ef4444',
            950: '#450a0a',
          },
        },
      })

      expect(result.css).toContain('--custom-50: #fef2f2')
      expect(result.css).toContain('--custom-500: #ef4444')
      expect(result.css).toContain('--custom-950: #450a0a')
    })
  })

  describe('CSS Output Quality', () => {
    it('generates valid CSS syntax (balanced braces)', () => {
      const result = buildTheme({
        colors: { primary: '#3b82f6', secondary: '#64748b' },
        contexts: { light: { custom: 'value' } },
        fonts: { body: 'Inter' },
      })

      const openBraces = (result.css.match(/{/g) || []).length
      const closeBraces = (result.css.match(/}/g) || []).length
      expect(openBraces).toBe(closeBraces)
    })

    it('does not contain undefined or NaN values', () => {
      const result = buildTheme({
        colors: { primary: '#3b82f6' },
      })

      expect(result.css).not.toContain('undefined')
      expect(result.css).not.toContain('NaN')
    })

    it('includes section comments for readability', () => {
      const result = buildTheme({})

      expect(result.css).toContain('/* Color Palettes */')
      expect(result.css).toContain('/* Color Contexts */')
    })

    it('has properly formatted :root blocks', () => {
      const result = buildTheme({})

      expect(result.css).toMatch(/:root\s*\{/)
    })
  })

  describe('Full Integration', () => {
    it('processes complete theme configuration', () => {
      const themeConfig = {
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
          accent: '#8b5cf6',
          neutral: '#737373',
        },
        contexts: {
          light: {
            section: 'white',
            body: 'var(--neutral-900)',
          },
          medium: {
            section: 'var(--neutral-100)',
          },
          dark: {
            section: 'var(--neutral-900)',
            body: 'white',
          },
        },
        fonts: {
          body: 'Inter, sans-serif',
          heading: 'Poppins, sans-serif',
          code: 'Fira Code, monospace',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Inter' },
            { url: 'https://fonts.googleapis.com/css2?family=Poppins' },
          ],
        },
        appearance: {
          default: 'light',
          allowToggle: true,
          respectSystemPreference: true,
          schemes: ['light', 'dark'],
        },
      }

      const foundationVars = {
        'header-height': { default: '4rem', description: 'Header height' },
        'max-content-width': { default: '80rem' },
      }

      const result = buildTheme(themeConfig, { foundationVars })

      // Verify all colors generated
      expect(result.css).toContain('--primary-500:')
      expect(result.css).toContain('--secondary-500:')
      expect(result.css).toContain('--accent-500:')
      expect(result.css).toContain('--neutral-500:')

      // Verify contexts
      expect(result.css).toContain('.context-light')
      expect(result.css).toContain('.context-medium')
      expect(result.css).toContain('.context-dark')

      // Verify fonts
      expect(result.css).toContain('--font-body: Inter, sans-serif')
      expect(result.css).toContain('--font-heading: Poppins, sans-serif')
      // Font imports should be in links, not CSS
      expect(result.css).not.toContain('@import')
      expect(result.links).toContain('fonts.googleapis.com')

      // Verify foundation vars
      expect(result.css).toContain('--header-height: 4rem')
      expect(result.css).toContain('--max-content-width: 80rem')

      // Verify dark scheme support
      expect(result.css).toContain('.scheme-dark')

      // No errors
      expect(result.errors).toHaveLength(0)
    })

    it('handles minimal theme configuration', () => {
      const result = buildTheme({
        colors: {
          primary: '#3b82f6',
        },
      })

      expect(result.errors).toHaveLength(0)
      expect(result.css).toContain('--primary-500:')
      // Should still have defaults for other required items
      expect(result.css).toContain('.context-light')
    })

    it('handles empty theme configuration', () => {
      const result = buildTheme()

      expect(result.errors).toHaveLength(0)
      expect(result.css.length).toBeGreaterThan(0)
      // Should have all default content
      expect(result.css).toContain(':root')
      expect(result.css).toContain('.context-light')
    })
  })

  describe('Status Tokens', () => {
    it('includes status tokens in generated CSS', () => {
      const result = buildTheme({})

      expect(result.css).toContain('--success:')
      expect(result.css).toContain('--success-subtle:')
      expect(result.css).toContain('--warning:')
      expect(result.css).toContain('--error:')
      expect(result.css).toContain('--info:')
      expect(result.css).toContain('--info-subtle:')
    })

    it('has different status shades for dark context', () => {
      const result = buildTheme({})

      // Dark context uses lighter shades (e.g., green-400 instead of green-600)
      expect(result.css).toMatch(/\.context-dark[^}]+--success:\s*#4ade80/)
      expect(result.css).toMatch(/\.context-light[^}]+--success:\s*#16a34a/)
    })
  })

  describe('Neutral Presets', () => {
    it('accepts named neutral presets', () => {
      const result = buildTheme({
        colors: { neutral: 'stone' },
      })

      expect(result.errors).toHaveLength(0)
      expect(result.css).toContain('--neutral-500:')
    })

    it('uses stone as default neutral', () => {
      const result = buildTheme({})

      expect(result.config.colors.neutral).toBe('#78716c')
    })
  })

  describe('Inline Defaults', () => {
    it('includes default inline styles in output', () => {
      const result = buildTheme({})

      expect(result.css).toContain('span[accent]')
      expect(result.css).toContain('var(--link)')
      expect(result.css).toContain('span[muted]')
      expect(result.css).toContain('var(--subtle)')
    })
  })

  describe('Font Faces', () => {
    it('generates @font-face rules from faces array', () => {
      const result = buildTheme({
        fonts: {
          body: 'montserrat, sans-serif',
          faces: [
            { family: 'montserrat', src: '/fonts/montserrat/normal-normal.woff', weight: 400, style: 'normal', format: 'woff' },
            { family: 'montserrat', src: '/fonts/montserrat/bold-normal.woff', weight: 700, style: 'normal', format: 'woff' },
          ],
        },
      })

      expect(result.css).toContain('@font-face')
      expect(result.css).toContain("font-family: montserrat")
      expect(result.css).toContain("font-weight: 400")
      expect(result.css).toContain("font-weight: 700")
      expect(result.css).toContain("font-display: swap")
      expect(result.css).toContain("/fonts/montserrat/normal-normal.woff")
    })

    it('filters out faces for unused font families', () => {
      const result = buildTheme({
        fonts: {
          body: 'montserrat, sans-serif',
          faces: [
            { family: 'montserrat', src: '/fonts/montserrat/normal-normal.woff', weight: 400, style: 'normal' },
            { family: 'roboto', src: '/fonts/roboto/normal-normal.woff', weight: 400, style: 'normal' },
          ],
        },
      })

      expect(result.css).toContain('font-family: montserrat')
      expect(result.css).not.toContain('font-family: roboto')
    })

    it('includes faces used by heading slot', () => {
      const result = buildTheme({
        fonts: {
          heading: 'Kenia, cursive',
          faces: [
            { family: 'Kenia', src: '/fonts/kenia/normal-normal.woff', weight: 400, style: 'normal' },
          ],
        },
      })

      expect(result.css).toContain('font-family: Kenia')
    })

    it('skips all faces when no font slots are set', () => {
      const result = buildTheme({
        fonts: {
          faces: [
            { family: 'montserrat', src: '/fonts/montserrat/normal-normal.woff', weight: 400, style: 'normal' },
          ],
        },
      })

      // No body/heading/mono set → usedFamilies is empty → no faces emitted
      expect(result.css).not.toContain('@font-face')
    })
  })

  // Regression: a subdirectory deployment (GitHub Pages project site, /docs/,
  // ...) moves the served root, but the @font-face rules ship in an inline
  // <style>, so a root-relative src silently 404s and the site falls back to
  // system fonts. The base has to be baked into the emitted URL.
  describe('Font Faces under a base path', () => {
    const theme = {
      fonts: {
        body: 'Fraunces, serif',
        faces: [{ family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400, format: 'woff2' }],
      },
    }

    it('prefixes root-relative face srcs with the base', () => {
      const result = buildTheme(theme, { base: '/my-repo/' })

      expect(result.css).toContain("src: url('/my-repo/fonts/fraunces.woff2')")
      expect(result.css).not.toContain("url('/fonts/fraunces.woff2')")
      expect(result.links).toContain('/my-repo/fonts/fraunces.woff2')
    })

    it('leaves srcs untouched at the root base', () => {
      for (const base of ['/', undefined]) {
        const result = buildTheme(theme, { base })
        expect(result.css).toContain("src: url('/fonts/fraunces.woff2')")
      }
    })

    it('does not double-prefix an already-based src', () => {
      const result = buildTheme(
        { fonts: { body: 'Fraunces, serif', faces: [{ family: 'Fraunces', src: '/my-repo/fonts/fraunces.woff2' }] } },
        { base: '/my-repo/' }
      )

      expect(result.css).toContain("src: url('/my-repo/fonts/fraunces.woff2')")
      expect(result.css).not.toContain('/my-repo/my-repo/')
    })

    it('leaves absolute and protocol-relative srcs alone', () => {
      const result = buildTheme(
        {
          fonts: {
            body: 'Fraunces, serif',
            heading: 'Anton, sans-serif',
            faces: [
              { family: 'Fraunces', src: 'https://cdn.example.com/fraunces.woff2' },
              { family: 'Anton', src: '//cdn.example.com/anton.woff2' },
            ],
          },
        },
        { base: '/my-repo/' }
      )

      expect(result.css).toContain("url('https://cdn.example.com/fraunces.woff2')")
      expect(result.css).toContain("url('//cdn.example.com/anton.woff2')")
      expect(result.css).not.toContain('/my-repo/https')
      expect(result.css).not.toContain('/my-repo//cdn')
    })
  })

  describe('Foundation font vars (typefaces beyond the 3 roles)', () => {
    it('keeps a @font-face whose family is referenced only by a foundation font-* var', () => {
      const result = buildTheme(
        {
          fonts: {
            body: 'Inter, sans-serif',
            faces: [{ family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400 }],
          },
        },
        { foundationVars: { 'font-serif': { default: 'Fraunces, Georgia, serif' } } }
      )

      // Without foundation-var awareness the Fraunces face would be filtered
      // out — no body/heading/mono slot references it.
      expect(result.css).toContain('@font-face')
      expect(result.css).toContain('font-family: Fraunces')
      // And the var is emitted so `font-serif` utilities resolve to it.
      expect(result.css).toContain('--font-serif: Fraunces')
    })

    it('keeps a Google import family referenced only by a foundation font-* var', () => {
      const result = buildTheme(
        {
          fonts: {
            body: 'Inter, sans-serif',
            import: [{ url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&display=swap' }],
          },
        },
        { foundationVars: { 'font-display': { default: 'Fraunces, serif' } } }
      )

      expect(result.links).toContain('Fraunces')
    })

    it('loads the site-overridden family, not the foundation default', () => {
      const result = buildTheme(
        {
          fonts: {
            body: 'Inter, sans-serif',
            faces: [{ family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400 }],
          },
          // Site retunes the foundation's editorial face default (Georgia) to Fraunces.
          vars: { 'font-serif': 'Fraunces, Georgia, serif' },
        },
        { foundationVars: { 'font-serif': { default: "Georgia, 'Times New Roman', serif" } } }
      )

      expect(result.css).toContain('font-family: Fraunces')
      expect(result.css).toContain('--font-serif: Fraunces')
    })

    it('does not treat non-family font vars (weight/size) as typefaces', () => {
      const result = buildTheme(
        { fonts: { faces: [{ family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400 }] } },
        {
          foundationVars: {
            'font-weight': { default: '700' },
            'font-size': { default: '18px' },
            'font-serif': { type: 'font', default: 'Fraunces, serif' },
          },
        }
      )
      // The serif typeface loads; weight/size stay ordinary vars, not families.
      expect(result.css).toContain('font-family: Fraunces')
      expect(result.css).toContain('--font-weight: 700')
      expect(result.css).toContain('--font-size: 18px')
      expect(result.css).not.toContain('font-family: 700')
    })

    it('loads families from foundation font vars in both shapes', () => {
      const result = buildTheme(
        {
          fonts: {
            faces: [
              { family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400 },
              { family: 'Anton', src: '/fonts/anton.woff2', weight: 400 },
            ],
          },
        },
        {
          foundationVars: {
            'font-serif': { type: 'font', default: 'Fraunces, serif' },
            'font-display': 'Anton, sans-serif',
          },
        }
      )
      expect(result.css).toContain('font-family: Fraunces')
      expect(result.css).toContain('font-family: Anton')
    })

    it('classifies a typeface by type:font even without a font- prefix', () => {
      const result = buildTheme(
        { fonts: { faces: [{ family: 'Anton', src: '/fonts/anton.woff2', weight: 400 }] } },
        { foundationVars: { display: { type: 'font', default: 'Anton, sans-serif' } } }
      )
      // Loads the family and emits it under the normalized --font-display.
      expect(result.css).toContain('font-family: Anton')
      expect(result.css).toContain('--font-display: Anton, sans-serif')
    })

    it('emits an application rule for a font var that declares applyTo', () => {
      const result = buildTheme(
        {},
        {
          foundationVars: {
            'font-serif': { type: 'font', default: 'Fraunces, serif', applyTo: ['blockquote', '.tagline'] },
          },
        }
      )
      expect(result.css).toContain('blockquote, .tagline { font-family: var(--font-serif); }')
      // The var itself is still emitted for utility / manual var() use.
      expect(result.css).toContain('--font-serif: Fraunces, serif')
    })

    it('does not emit an application rule for a font var without applyTo', () => {
      const result = buildTheme(
        {},
        { foundationVars: { 'font-serif': { type: 'font', default: 'Fraunces, serif' } } }
      )
      expect(result.css).not.toContain('font-family: var(--font-serif)')
      expect(result.css).toContain('--font-serif: Fraunces, serif')
    })

    it('applies a site-overridden family to the foundation var applyTo selectors', () => {
      const result = buildTheme(
        { vars: { 'font-serif': 'Playfair Display, serif' } },
        {
          foundationVars: {
            'font-serif': { type: 'font', default: 'Fraunces, serif', applyTo: ['blockquote'] },
          },
        }
      )
      expect(result.css).toContain('blockquote { font-family: var(--font-serif); }')
      // Site override wins on the value; the wiring (applyTo) is unchanged.
      expect(result.css).toContain('--font-serif: Playfair Display, serif')
    })
  })

  describe('Font role redefinition + unified surface (increment 2)', () => {
    it('lets a foundation redefine a built-in role applyTo (heading → +h4)', () => {
      const result = buildTheme(
        {},
        { foundationVars: { heading: { type: 'font', applyTo: ['h1', 'h2', 'h3', 'h4'] } } }
      )
      // A foundation-owned role applies always, with its own selectors.
      expect(result.css).toContain('h1, h2, h3, h4 { font-family: var(--font-heading); }')
    })

    it('emits --font-heading once; site value wins over a foundation redefinition', () => {
      const result = buildTheme(
        { fonts: { heading: 'Poppins, sans-serif' } },
        {
          foundationVars: {
            heading: { type: 'font', default: 'Georgia, serif', applyTo: ['h1', 'h2', 'h3', 'h4'] },
          },
        }
      )
      const occurrences = (result.css.match(/--font-heading:/g) || []).length
      expect(occurrences).toBe(1)
      expect(result.css).toContain('--font-heading: Poppins, sans-serif')
      expect(result.css).not.toContain('--font-heading: Georgia, serif')
      // The foundation's applyTo (h1–h4) still governs application.
      expect(result.css).toContain('h1, h2, h3, h4 { font-family: var(--font-heading); }')
    })

    it('sets a foundation-added role via the unified fonts: surface', () => {
      const result = buildTheme(
        {
          fonts: {
            serif: 'Fraunces, Georgia, serif',
            faces: [{ family: 'Fraunces', src: '/fonts/fraunces.woff2', weight: 400 }],
          },
        },
        {
          foundationVars: {
            'font-serif': { type: 'font', default: 'ui-serif, serif', applyTo: ['blockquote'] },
          },
        }
      )
      // Site value (fonts.serif) wins; foundation applyTo applies it; family loads.
      expect(result.css).toContain('--font-serif: Fraunces, Georgia, serif')
      expect(result.css).toContain('blockquote { font-family: var(--font-serif); }')
      expect(result.css).toContain('font-family: Fraunces')
    })

    it('does not double-emit --font-serif via the generic foundation-var path', () => {
      const result = buildTheme(
        {},
        { foundationVars: { 'font-serif': { type: 'font', default: 'Fraunces, serif' } } }
      )
      const occurrences = (result.css.match(/--font-serif:/g) || []).length
      expect(occurrences).toBe(1)
    })
  })

  describe('Font Links', () => {
    it('merges multiple Google Fonts URLs into one link', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          heading: 'Poppins, sans-serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Inter&display=swap' },
            { url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&display=swap' },
          ],
        },
      })

      // Should have exactly one stylesheet link (merged)
      const stylesheetLinks = result.links.match(/<link rel="stylesheet"/g)
      expect(stylesheetLinks).toHaveLength(1)
      expect(result.links).toContain('family=Inter')
      expect(result.links).toContain('family=Poppins')
    })

    it('includes preconnect for Google Fonts', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Inter&display=swap' },
          ],
        },
      })

      expect(result.links).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">')
      expect(result.links).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    })

    it('filters out unused families from Google Fonts URL', () => {
      const result = buildTheme({
        fonts: {
          body: 'Inter, sans-serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Inter&family=Roboto&display=swap' },
          ],
        },
      })

      expect(result.links).toContain('family=Inter')
      expect(result.links).not.toContain('family=Roboto')
    })

    it('skips Google Fonts URL entirely when no families match', () => {
      const result = buildTheme({
        fonts: {
          body: 'system-ui, sans-serif',
          import: [
            { url: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap' },
          ],
        },
      })

      expect(result.links).toBe('')
    })

    it('keeps non-Google external URLs as-is', () => {
      const result = buildTheme({
        fonts: {
          body: 'CustomFont, sans-serif',
          import: [
            { url: 'https://example.com/fonts/custom.css' },
          ],
        },
      })

      expect(result.links).toContain('<link rel="stylesheet" href="https://example.com/fonts/custom.css">')
    })
  })

  describe('extractUsedFamilies', () => {
    it('extracts family names from loaded roles', () => {
      const result = extractUsedFamilies({
        body: { value: 'Montserrat, system-ui, sans-serif', load: true },
        heading: { value: '"Playfair Display", Georgia, serif', load: true },
      })

      expect(result.has('montserrat')).toBe(true)
      expect(result.has('playfair display')).toBe(true)
      // Generic families should be excluded
      expect(result.has('system-ui')).toBe(false)
      expect(result.has('sans-serif')).toBe(false)
      expect(result.has('serif')).toBe(false)
      expect(result.has('georgia')).toBe(true)
    })

    it('ignores roles not flagged to load (bare framework defaults)', () => {
      const result = extractUsedFamilies({
        body: { value: 'Montserrat, sans-serif', load: false },
      })
      expect(result.size).toBe(0)
    })

    it('returns empty set when no roles defined', () => {
      const result = extractUsedFamilies({})
      expect(result.size).toBe(0)
    })

    it('handles single-quoted family names', () => {
      const result = extractUsedFamilies({
        body: { value: "'Open Sans', sans-serif", load: true },
      })

      expect(result.has('open sans')).toBe(true)
    })
  })

  describe('Appearance Settings', () => {
    it('respects system appearance when configured', () => {
      const result = buildTheme({
        appearance: 'system',
      })

      expect(result.config.appearance.default).toBe('system')
      expect(result.config.appearance.respectSystemPreference).toBe(true)
    })

    it('handles simple appearance string', () => {
      const result = buildTheme({
        appearance: 'dark',
      })

      expect(result.config.appearance.default).toBe('dark')
    })

    it('merges appearance object with defaults', () => {
      const result = buildTheme({
        appearance: {
          allowToggle: true,
        },
      })

      expect(result.config.appearance.allowToggle).toBe(true)
      expect(result.config.appearance.default).toBe('light')
    })
  })
})
