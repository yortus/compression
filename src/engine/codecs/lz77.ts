/**
 * LZ77: redundancy that is *distant* rather than adjacent.
 *
 * Run-length encoding can only collapse repeats that touch. Huffman can only exploit how
 * often a symbol appears, not where. LZ77 is the third answer to "what counts as
 * redundant": anything you have already seen within a window can be referred to instead of
 * repeated, as a back-reference saying *go back d symbols and copy l of them*.
 *
 * It is also half of gzip. DEFLATE is this, followed by Huffman over the token stream, and
 * the Codes-act slide runs exactly that pairing using `codecs/huffman.ts` unchanged.
 *
 * Two deliberate simplifications, both stated on the slide:
 *
 * - **Greedy matching.** Real encoders do lazy matching — they check whether starting the
 *   match one symbol later would pay better — which typically buys a few percent. Greedy is
 *   what you can watch happen.
 * - **A flat cost model.** `tokenBits` prices a literal at a tag bit plus a byte, and a
 *   match at a tag bit plus fixed-width distance and length fields. Real DEFLATE Huffman-codes
 *   all three, which is what the slide's final phase then demonstrates.
 */

export interface Lz77Options {
  /** How far back a match may reach. The slide makes this a knob; DEFLATE uses 32768. */
  window: number
  /** Shorter matches cost more to encode than they save. DEFLATE's floor is 3. */
  minMatch: number
  /** DEFLATE's ceiling is 258. */
  maxMatch: number
}

export const DEFLATE_OPTIONS: Lz77Options = { window: 32768, minMatch: 3, maxMatch: 258 }

export interface Lz77Literal {
  kind: 'literal'
  value: string
  /** Index into the source symbols. */
  at: number
}

export interface Lz77Match {
  kind: 'match'
  distance: number
  length: number
  at: number
}

export type Lz77Token = Lz77Literal | Lz77Match

export function encodeLz77(symbols: readonly string[], opts: Lz77Options): Lz77Token[] {
  const tokens: Lz77Token[] = []
  const n = symbols.length
  let i = 0

  while (i < n) {
    let bestLength = 0
    let bestDistance = 0
    const from = Math.max(0, i - opts.window)

    for (let start = from; start < i; start++) {
      let length = 0
      // Matches may overlap the cursor — copying forwards as it goes is how a decoder
      // expands a run, and it is what lets LZ77 subsume run-length encoding entirely.
      while (
        length < opts.maxMatch &&
        i + length < n &&
        symbols[start + length] === symbols[i + length]
      ) length++
      if (length > bestLength) {
        bestLength = length
        bestDistance = i - start
      }
    }

    if (bestLength >= opts.minMatch) {
      tokens.push({ kind: 'match', distance: bestDistance, length: bestLength, at: i })
      i += bestLength
    } else {
      tokens.push({ kind: 'literal', value: symbols[i], at: i })
      i++
    }
  }
  return tokens
}

export function decodeLz77(tokens: readonly Lz77Token[]): string[] {
  const out: string[] = []
  for (const t of tokens) {
    if (t.kind === 'literal') {
      out.push(t.value)
    } else {
      const start = out.length - t.distance
      // One symbol at a time, so an overlapping match keeps reading what it has just
      // written. Slicing the array up front would silently truncate those.
      for (let k = 0; k < t.length; k++) out.push(out[start + k])
    }
  }
  return out
}

export interface Lz77Cost {
  literalBits: number
  matchBits: number
}

/**
 * What a token costs before any entropy coding.
 *
 * Distance and length get fixed-width fields sized to the options, which is why widening
 * the window is not free: every match in the stream pays for the reach, whether it uses it
 * or not. That trade is the reason the window is a knob on the slide.
 */
export function tokenCost(opts: Lz77Options): Lz77Cost {
  const distBits = Math.max(1, Math.ceil(Math.log2(opts.window)))
  const lenBits = Math.max(1, Math.ceil(Math.log2(opts.maxMatch - opts.minMatch + 1)))
  return { literalBits: 1 + 8, matchBits: 1 + distBits + lenBits }
}

export function lz77Bits(tokens: readonly Lz77Token[], opts: Lz77Options): number {
  const { literalBits, matchBits } = tokenCost(opts)
  let bits = 0
  for (const t of tokens) bits += t.kind === 'literal' ? literalBits : matchBits
  return bits
}

/**
 * A token as a symbol an entropy coder can count.
 *
 * DEFLATE codes literals and match lengths in one Huffman alphabet and distances in a
 * second; this collapses both into a single alphabet, which is simpler to show and slightly
 * pessimistic. The slide says so.
 */
export function tokenSymbol(t: Lz77Token): string {
  return t.kind === 'literal' ? `L${t.value}` : `M${t.distance},${t.length}`
}
