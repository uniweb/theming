import { describe, it, expect } from 'vitest'
import { normalizeTokenValue } from '../src/normalize.js'

describe('normalizeTokenValue', () => {
  describe('bare palette references', () => {
    it('resolves palette ref to var()', () => {
      expect(normalizeTokenValue('neutral-500')).toBe('var(--neutral-500)')
      expect(normalizeTokenValue('primary-600')).toBe('var(--primary-600)')
      expect(normalizeTokenValue('accent-50')).toBe('var(--accent-50)')
      expect(normalizeTokenValue('secondary-950')).toBe('var(--secondary-950)')
    })

    it('handles leading dashes', () => {
      expect(normalizeTokenValue('--primary-500')).toBe('var(--primary-500)')
    })

    it('ignores invalid shade numbers', () => {
      expect(normalizeTokenValue('primary-123')).toBe('primary-123')
      expect(normalizeTokenValue('primary-999')).toBe('primary-999')
    })

    it('ignores non-palette strings', () => {
      expect(normalizeTokenValue('white')).toBe('white')
      expect(normalizeTokenValue('transparent')).toBe('transparent')
      expect(normalizeTokenValue('inherit')).toBe('inherit')
    })
  })

  describe('palette references with opacity (/N)', () => {
    it('converts to color-mix for partial opacity', () => {
      expect(normalizeTokenValue('neutral-500/20')).toBe(
        'color-mix(in srgb, var(--neutral-500) 20%, transparent)'
      )
      expect(normalizeTokenValue('primary-600/50')).toBe(
        'color-mix(in srgb, var(--primary-600) 50%, transparent)'
      )
    })

    it('converts to plain var() for 100% opacity', () => {
      expect(normalizeTokenValue('neutral-500/100')).toBe('var(--neutral-500)')
    })

    it('handles 0% opacity', () => {
      expect(normalizeTokenValue('primary-500/0')).toBe(
        'color-mix(in srgb, var(--primary-500) 0%, transparent)'
      )
    })

    it('ignores invalid shade in opacity format', () => {
      expect(normalizeTokenValue('primary-123/50')).toBe('primary-123/50')
    })
  })

  describe('rgba(var(--X) / Y) — DB storage format', () => {
    it('strips wrapper for full opacity', () => {
      expect(normalizeTokenValue('rgba(var(--primary-900) / 1.00)')).toBe('var(--primary-900)')
      expect(normalizeTokenValue('rgba(var(--neutral-50) / 1)')).toBe('var(--neutral-50)')
      expect(normalizeTokenValue('rgba(var(--accent-600) / 0.999)')).toBe('var(--accent-600)')
    })

    it('converts to color-mix for partial opacity', () => {
      expect(normalizeTokenValue('rgba(var(--primary-900) / 0.50)')).toBe(
        'color-mix(in srgb, var(--primary-900) 50%, transparent)'
      )
      expect(normalizeTokenValue('rgba(var(--neutral-200) / 0.75)')).toBe(
        'color-mix(in srgb, var(--neutral-200) 75%, transparent)'
      )
      expect(normalizeTokenValue('rgba(var(--primary-500) / 0.1)')).toBe(
        'color-mix(in srgb, var(--primary-500) 10%, transparent)'
      )
    })
  })

  describe('pass-through values', () => {
    it('passes through var() references', () => {
      expect(normalizeTokenValue('var(--neutral-500)')).toBe('var(--neutral-500)')
      expect(normalizeTokenValue('var(--custom-token)')).toBe('var(--custom-token)')
    })

    it('passes through hex colors', () => {
      expect(normalizeTokenValue('#ff0000')).toBe('#ff0000')
      expect(normalizeTokenValue('#3b82f6')).toBe('#3b82f6')
    })

    it('passes through color-mix values', () => {
      const cm = 'color-mix(in srgb, var(--primary-500) 50%, transparent)'
      expect(normalizeTokenValue(cm)).toBe(cm)
    })

    it('passes through other CSS functions', () => {
      expect(normalizeTokenValue('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
      expect(normalizeTokenValue('oklch(55% 0.2 260)')).toBe('oklch(55% 0.2 260)')
    })

    it('handles non-string values', () => {
      expect(normalizeTokenValue(null)).toBe(null)
      expect(normalizeTokenValue(undefined)).toBe(undefined)
      expect(normalizeTokenValue(42)).toBe(42)
    })
  })
})
