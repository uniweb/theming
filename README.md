# @uniweb/theming

Theming engine for [Uniweb](https://github.com/uniweb) — generates color palettes, semantic CSS tokens, and context classes from a declarative `theme.yml` configuration.

## Overview

Uniweb sites separate theming from components. Content authors set `theme: light|medium|dark` per section in frontmatter; the runtime applies context classes; components use semantic CSS tokens (`var(--heading)`, `var(--link)`, `var(--section)`) that resolve automatically. This package is the engine behind that system.

It handles three concerns:

1. **Shade generation** — Expand a single hex color into 11 perceptually uniform shades (50–950) using the OKLCH color space
2. **Theme processing** — Validate and merge `theme.yml` configuration with foundation defaults
3. **CSS generation** — Produce complete CSS with palette variables, context classes, font imports, and foundation-specific custom properties

## Installation

```bash
npm install @uniweb/theming
```

## Quick Start

```javascript
import { buildTheme } from '@uniweb/theming'

// Process theme.yml and generate CSS in one step
const { css, config, errors, warnings } = buildTheme({
  colors: {
    primary: '#3b82f6',
    neutral: 'stone',      // Named preset (warm gray)
  },
  fonts: {
    heading: '"Inter", sans-serif',
  },
})

// css → complete stylesheet with palettes, contexts, fonts
// config → processed configuration for runtime use
```

## Shade Generation

Generate Tailwind-compatible shade scales from any CSS color. Uses OKLCH for perceptually uniform lightness steps with automatic sRGB gamut mapping.

```javascript
import { generateShades } from '@uniweb/theming'

// Default: shade 500 = exact input color, others redistributed proportionally
const shades = generateShades('#3b82f6')
// { 50: 'oklch(...)', 100: '...', ..., 500: 'oklch(...)', ..., 950: '...' }

// Hex output
generateShades('#3b82f6', { format: 'hex' })
// { 50: '#eff6ff', ..., 500: '#3b82f6', ..., 950: '#172554' }

// Fixed lightness scale (shade 500 may differ from input)
generateShades('#3b82f6', { exactMatch: false })

// Generation modes
generateShades('#e35d25', { mode: 'natural' })  // Temperature-aware hue shifts
generateShades('#e35d25', { mode: 'vivid' })    // Higher saturation
generateShades('#e35d25', { mode: 'fixed' })    // Default — constant hue
```

### Multiple Palettes

```javascript
import { generatePalettes } from '@uniweb/theming'

const palettes = generatePalettes({
  primary: '#3b82f6',
  secondary: '#64748b',
  accent: { base: '#8b5cf6', mode: 'vivid' },  // Per-color options
})
// { primary: { 50: ..., 950: ... }, secondary: { ... }, accent: { ... } }
```

### Color Parsing

Accepts hex, RGB, HSL, and OKLCH formats:

```javascript
import { parseColor, isValidColor } from '@uniweb/theming'

parseColor('#3b82f6')                 // { l: 0.623, c: 0.214, h: 259.8 }
parseColor('rgb(59, 130, 246)')       // Same result
parseColor('hsl(217, 91%, 60%)')      // Same result
parseColor('oklch(62.3% 0.214 259.8)') // Same result

isValidColor('#3b82f6')  // true
isValidColor('not-a-color')  // false
```

### Utility Exports

```javascript
import { formatOklch, formatHex, getShadeLevels } from '@uniweb/theming'

formatOklch(0.55, 0.2, 250)   // 'oklch(55.0% 0.2000 250.0)'
formatHex(59, 130, 246)       // '#3b82f6'
getShadeLevels()              // [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
```

## Theme Processing

Validate and process raw `theme.yml` into a complete configuration, merging with defaults and resolving named presets.

```javascript
import { processTheme } from '@uniweb/theming'

const { config, errors, warnings } = processTheme({
  colors: {
    primary: '#e35d25',
    neutral: 'stone',        // Resolves to #78716c
  },
  contexts: {
    dark: {
      primary: 'primary-400',  // Bare palette ref → var(--primary-400)
      link: '#60a5fa',          // Hex passes through
    },
  },
  fonts: {
    body: '"Inter", sans-serif',
    import: [{ url: 'https://fonts.googleapis.com/css2?family=Inter' }],
  },
  appearance: 'light',          // or { default: 'dark', allowToggle: true }
  vars: {
    'header-height': '5rem',    // Override foundation variable
  },
}, {
  foundationVars: {             // Declared by foundation
    'header-height': { default: '4rem' },
    'sidebar-width': { default: '280px' },
  },
})
```

### Named Neutral Presets

The `neutral` color accepts preset names that map to Tailwind gray families:

| Preset | Hex | Character |
|---|---|---|
| `stone` | `#78716c` | Warm (default) |
| `zinc` | `#71717a` | Cool blue-gray |
| `gray` | `#6b7280` | True gray |
| `slate` | `#64748b` | Cool with blue tint |
| `neutral` | `#737373` | Pure gray |

### Context Token Resolution

Content authors write bare palette references in `theme.yml` contexts:

```yaml
contexts:
  dark:
    primary: primary-400
    link: primary-300
```

The processor resolves `primary-400` to `var(--primary-400)`. Plain CSS values (hex, `var()`, named colors) pass through unchanged.

### Validation

```javascript
import { validateThemeConfig } from '@uniweb/theming'

const { valid, errors } = validateThemeConfig({
  colors: { primary: 'not-a-color' },
})
// valid: false
// errors: ['Color "primary" has invalid value: not-a-color']
```

## CSS Generation

Generate complete CSS from a processed theme configuration.

```javascript
import { generateThemeCSS } from '@uniweb/theming'

const css = generateThemeCSS(config)
```

The output includes (in order):

1. **Typography** — `@import` rules and `--font-body`, `--font-heading`, `--font-mono` variables
2. **Color palettes** — `--primary-50` through `--primary-950` (and secondary, accent, neutral) on `:root`
3. **Default semantic tokens** — `--heading`, `--body`, `--link`, `--border`, etc. on `:root`
4. **Context classes** — `.context-light`, `.context-medium`, `.context-dark` with full token sets
5. **Foundation variables** — Custom `--var-name` properties from foundation defaults + site overrides
6. **Dark scheme** — `.scheme-dark` class and optional `prefers-color-scheme` media query
7. **Site background** — `body { background: ... }` if specified
8. **Inline text styles** — `span[accent]`, `span[muted]` for markdown inline styling

### Semantic Tokens

Each context class sets these CSS custom properties:

| Token | Purpose |
|---|---|
| `--section` | Section background |
| `--card` | Card/surface background |
| `--muted` | Muted/disabled background |
| `--body` | Body text |
| `--heading` | Heading text |
| `--subtle` | Secondary/muted text |
| `--border` | Borders |
| `--link` / `--link-hover` | Link colors |
| `--primary` / `--primary-foreground` / `--primary-hover` / `--primary-border` | Primary button |
| `--secondary` / `--secondary-foreground` / `--secondary-hover` / `--secondary-border` | Secondary button |
| `--success` / `--warning` / `--error` / `--info` | Status colors |
| `--ring` | Focus ring |

### Inspecting Defaults

```javascript
import { getDefaultContextTokens, getDefaultColors } from '@uniweb/theming'

getDefaultColors()
// { primary: '#3b82f6', secondary: '#64748b', accent: '#8b5cf6', neutral: '#78716c' }

getDefaultContextTokens()
// { light: { section: 'var(--neutral-50)', ... }, medium: { ... }, dark: { ... } }
```

## Foundation Integration

Foundations declare customizable variables; sites set values in `theme.yml`. This package handles the merge.

```javascript
import { extractFoundationVars, foundationHasVars } from '@uniweb/theming'

// Check if a foundation declares theme variables
foundationHasVars(schemaJson)  // true/false

// Extract vars from a foundation module
const vars = extractFoundationVars(await import('./foundation/vars.js'))
```

## How It Fits in Uniweb

```
theme.yml → processTheme() → generateThemeCSS() → CSS injected at build time
                                                      ↓
                                          :root { --primary-500: ...; --heading: ...; }
                                          .context-light { --section: var(--neutral-50); ... }
                                          .context-dark  { --section: var(--neutral-900); ... }
                                                      ↓
                                          Runtime applies .context-{theme} per section
                                                      ↓
                                          Components use var(--heading), var(--link), etc.
```

The site controls the theme. The foundation declares what's customizable. Components use semantic tokens and adapt to any context automatically.

## License

Apache-2.0
