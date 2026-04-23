/**
 * Smart 3-layer name resolver:
 * 1. Exact alias lookup  (fastest, most accurate)
 * 2. Individual-word alias lookup (handles "Apostol I" → surname "Apostol")
 * 3. Levenshtein fuzzy match ≤2 edits  (catches typos: Apostoel→Apostol, Turbata→Turbatu)
 */

/** Normalize for comparison: lowercase, strip accents, commas → spaces */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[,.\-_]/g, ' ')           // punctuation → space
    .replace(/\s+/g, ' ')              // collapse spaces
    .trim()
}

/** Space-efficient Levenshtein distance (O(n) space) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev = curr
  }
  return prev[b.length]
}

export interface ResolveResult {
  employeeId: string
  method: 'exact' | 'word' | 'fuzzy'
  matchedAlias: string
  distance?: number
}

export class NameResolver {
  /** normalized alias → { employee_id, original } */
  private aliasMap = new Map<string, { id: string; original: string }>()
  private loaded = false

  /** Load all aliases from Supabase (call once per request/session) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async load(supabase: any): Promise<void> {
    if (this.loaded) return
    const { data, error } = await supabase
      .from('employee_aliases')
      .select('surname_alias, employee_id')
    if (error) throw error
    for (const { surname_alias, employee_id } of data ?? []) {
      this.aliasMap.set(normalizeName(surname_alias), {
        id: employee_id,
        original: surname_alias,
      })
    }
    this.loaded = true
  }

  /** How many aliases are loaded */
  get size(): number {
    return this.aliasMap.size
  }

  /**
   * Resolve a name string to an employee_id.
   * Returns null if no confident match found.
   */
  resolve(name: string): ResolveResult | null {
    const norm = normalizeName(name)

    // ── Layer 1: Exact normalized match ──────────────────────────────────
    const exact = this.aliasMap.get(norm)
    if (exact) {
      return { employeeId: exact.id, method: 'exact', matchedAlias: exact.original }
    }

    // ── Layer 2: Word-by-word lookup (longest words first → safer) ───────
    const words = norm
      .split(' ')
      .filter((w) => w.length >= 3)
      .sort((a, b) => b.length - a.length)

    for (const word of words) {
      const hit = this.aliasMap.get(word)
      if (hit) {
        return { employeeId: hit.id, method: 'word', matchedAlias: hit.original }
      }
    }

    // ── Layer 3: Levenshtein fuzzy on full name (≤2 edits) ───────────────
    // Threshold scales with name length: short names need tighter match
    const maxDist = norm.length <= 5 ? 1 : 2

    let bestId: string | null = null
    let bestAlias = ''
    let bestDist = maxDist + 1

    for (const [alias, { id, original }] of this.aliasMap) {
      const dist = levenshtein(norm, alias)
      if (dist < bestDist) {
        bestDist = dist
        bestId = id
        bestAlias = original
      }
    }

    if (bestId && bestDist <= maxDist) {
      return {
        employeeId: bestId,
        method: 'fuzzy',
        matchedAlias: bestAlias,
        distance: bestDist,
      }
    }

    // ── Layer 3b: Fuzzy on individual words vs single-word aliases ────────
    for (const word of words) {
      if (word.length < 5) continue // only longer words for fuzzy word match
      for (const [alias, { id, original }] of this.aliasMap) {
        if (alias.includes(' ')) continue // word vs word only
        const dist = levenshtein(word, alias)
        if (dist === 1) {
          return {
            employeeId: id,
            method: 'fuzzy',
            matchedAlias: original,
            distance: dist,
          }
        }
      }
    }

    return null
  }

  /** Batch resolve — returns Map<originalName, ResolveResult|null> */
  resolveAll(names: string[]): Map<string, ResolveResult | null> {
    const results = new Map<string, ResolveResult | null>()
    for (const name of names) {
      results.set(name, this.resolve(name))
    }
    return results
  }
}
