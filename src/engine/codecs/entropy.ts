/**
 * Shannon entropy — the floor every lossless scheme in this deck is measured against.
 *
 * Entropy answers "how many bits per symbol does this data *actually* contain?", which
 * is a property of the data rather than of any encoder. It is what makes the opening
 * act more than a list of tricks: RLE, Huffman and the rest are all attempts to get
 * close to a number that was fixed before anyone chose a technique.
 */

export interface SymbolStat {
  symbol: number
  count: number
  probability: number
  /** Ideal code length for this symbol, in bits: -log2(p). */
  idealBits: number
}

export function symbolCounts(symbols: ArrayLike<number>): Map<number, number> {
  const counts = new Map<number, number>()
  for (let i = 0; i < symbols.length; i++) {
    counts.set(symbols[i], (counts.get(symbols[i]) ?? 0) + 1)
  }
  return counts
}

/** Shannon entropy in bits per symbol. Zero for data with only one distinct symbol. */
export function entropyBits(symbols: ArrayLike<number>): number {
  if (symbols.length === 0) return 0
  let h = 0
  for (const count of symbolCounts(symbols).values()) {
    const p = count / symbols.length
    h -= p * Math.log2(p)
  }
  return h
}

/** The smallest a lossless coder could get this data, ignoring the cost of the model. */
export function idealBits(symbols: ArrayLike<number>): number {
  return entropyBits(symbols) * symbols.length
}

/** Per-symbol breakdown, most frequent first — the bars on the info-theory slide. */
export function symbolStats(symbols: ArrayLike<number>): SymbolStat[] {
  const total = symbols.length
  return [...symbolCounts(symbols)]
    .map(([symbol, count]) => {
      const probability = count / total
      return { symbol, count, probability, idealBits: -Math.log2(probability) }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Bits per symbol if every symbol got the same fixed-width code — what you pay for
 * storing the data without modelling it at all.
 */
export function flatBits(symbols: ArrayLike<number>): number {
  const distinct = symbolCounts(symbols).size
  return distinct <= 1 ? (distinct === 0 ? 0 : 1) : Math.ceil(Math.log2(distinct))
}
