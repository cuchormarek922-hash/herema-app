import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeName, levenshtein, NameResolver } from '../nameResolver'

// ── normalizeName ────────────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('lowercases', () => {
    expect(normalizeName('Varga')).toBe('varga')
  })
  it('strips diacritics', () => {
    expect(normalizeName('Kovác')).toBe('kovac')
    expect(normalizeName('Apostol')).toBe('apostol')
    expect(normalizeName('Magyar')).toBe('magyar')
  })
  it('replaces punctuation with space', () => {
    expect(normalizeName('Varga,Jozef')).toBe('varga jozef')
    expect(normalizeName('Varga-Jozef')).toBe('varga jozef')
  })
  it('collapses multiple spaces', () => {
    expect(normalizeName('Varga  Jozef')).toBe('varga jozef')
  })
  it('trims', () => {
    expect(normalizeName('  varga  ')).toBe('varga')
  })
})

// ── levenshtein ──────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('identical strings → 0', () => {
    expect(levenshtein('varga', 'varga')).toBe(0)
  })
  it('single insertion → 1', () => {
    expect(levenshtein('varga', 'vargaa')).toBe(1)
  })
  it('single deletion → 1', () => {
    expect(levenshtein('varga', 'vrga')).toBe(1)
  })
  it('single substitution → 1', () => {
    expect(levenshtein('apostol', 'apostoel')).toBe(1)
  })
  it('two edits → 2', () => {
    expect(levenshtein('turbatu', 'turbata')).toBe(1) // 1 sub
    expect(levenshtein('kovac', 'kavoc')).toBe(2)
  })
  it('empty string edge cases', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
  })
})

// ── NameResolver ─────────────────────────────────────────────────────────────

const ALIASES = [
  { surname_alias: 'varga', employee_id: 'uuid-varga' },
  { surname_alias: 'kovac', employee_id: 'uuid-kovac' },
  { surname_alias: 'apostol', employee_id: 'uuid-apostol' },
  { surname_alias: 'apostol i', employee_id: 'uuid-apostol' },
  { surname_alias: 'magyar', employee_id: 'uuid-magyar' },
]

function mockSupabase() {
  return {
    from: () => ({
      select: async () => ({ data: ALIASES, error: null }),
    }),
  }
}

describe('NameResolver', () => {
  let resolver: NameResolver

  beforeEach(async () => {
    resolver = new NameResolver()
    await resolver.load(mockSupabase())
  })

  it('loads correct alias count', () => {
    expect(resolver.size).toBe(ALIASES.length)
  })

  describe('Layer 1 — exact match', () => {
    it('matches exact lowercase', () => {
      const r = resolver.resolve('varga')
      expect(r?.employeeId).toBe('uuid-varga')
      expect(r?.method).toBe('exact')
    })
    it('matches with diacritics stripped', () => {
      const r = resolver.resolve('Kovác')
      expect(r?.employeeId).toBe('uuid-kovac')
      expect(r?.method).toBe('exact')
    })
    it('matches uppercase input', () => {
      const r = resolver.resolve('VARGA')
      expect(r?.employeeId).toBe('uuid-varga')
      expect(r?.method).toBe('exact')
    })
  })

  describe('Layer 2 — word match', () => {
    it('extracts surname from "Apostol Ion" → apostol', () => {
      const r = resolver.resolve('Apostol Ion')
      expect(r?.employeeId).toBe('uuid-apostol')
      expect(r?.method).toBe('word')
    })
    it('ignores short words (<3 chars)', () => {
      // "Ko" alone should not match
      const r = resolver.resolve('Ko')
      expect(r).toBeNull()
    })
  })

  describe('Layer 3 — fuzzy match', () => {
    it('catches 1-char typo: Apostoel → apostol', () => {
      const r = resolver.resolve('Apostoel')
      expect(r?.employeeId).toBe('uuid-apostol')
      expect(r?.method).toBe('fuzzy')
      expect(r?.distance).toBe(1)
    })
    it('returns null when distance > threshold', () => {
      // Completely unrelated name
      const r = resolver.resolve('Zzzzzzzzz')
      expect(r).toBeNull()
    })
  })

  describe('resolveAll', () => {
    it('batch resolves multiple names', () => {
      const results = resolver.resolveAll(['Varga', 'Kovác', 'Unknown'])
      expect(results.get('Varga')?.employeeId).toBe('uuid-varga')
      expect(results.get('Kovác')?.employeeId).toBe('uuid-kovac')
      expect(results.get('Unknown')).toBeNull()
    })
  })

  describe('load idempotency', () => {
    it('calling load twice does not duplicate aliases', async () => {
      await resolver.load(mockSupabase())
      expect(resolver.size).toBe(ALIASES.length)
    })
  })
})
