/**
 * Lossless compression at the level of meaning: a shared codebook of phrases.
 *
 * This is the Huffman story told one layer up. Both sides agree in advance that
 * `24015KT` means "wind from 240 degrees at 15 knots", and the message shrinks by a factor
 * of ten with nothing lost — but only because the codebook was agreed first, and only
 * inside the domain it was written for. Point an aviation codebook at a novel and it does
 * nothing at all.
 *
 * Real domains do exactly this and have for centuries: METAR and TAF for weather, Q-codes
 * for radio traffic, algebraic notation for chess, SI symbols, medical prescription
 * abbreviations. Every one is a primer that has to be learned before a single message can
 * be read, which is the cost the slide counts.
 *
 * Matching is longest-phrase-first, so a codebook containing both "wind from 240 degrees"
 * and "wind" behaves the way a reader would.
 */

export interface Abbreviation {
  phrase: string
  code: string
}

export interface AbbreviationHit {
  /** Character range in the source that this phrase covered. */
  start: number
  end: number
  code: string
}

export interface AbbreviateResult {
  text: string
  hits: AbbreviationHit[]
}

function byLengthDesc(a: Abbreviation, b: Abbreviation) {
  return b.phrase.length - a.phrase.length
}

export function abbreviate(text: string, dictionary: readonly Abbreviation[]): AbbreviateResult {
  const sorted = [...dictionary].sort(byLengthDesc)
  const hits: AbbreviationHit[] = []
  let out = ''
  let i = 0

  while (i < text.length) {
    let matched: Abbreviation | null = null
    for (const entry of sorted) {
      if (entry.phrase.length && text.startsWith(entry.phrase, i)) { matched = entry; break }
    }
    if (matched) {
      hits.push({ start: i, end: i + matched.phrase.length, code: matched.code })
      out += matched.code
      i += matched.phrase.length
    } else {
      out += text[i]
      i++
    }
  }
  return { text: out, hits }
}

/**
 * The inverse. Longest code first for the same reason, so a codebook with both `QRU` and
 * `QRU?` expands the longer one rather than leaving a stray question mark behind.
 */
export function expand(text: string, dictionary: readonly Abbreviation[]): string {
  const sorted = [...dictionary].sort((a, b) => b.code.length - a.code.length)
  let out = ''
  let i = 0
  while (i < text.length) {
    let matched: Abbreviation | null = null
    for (const entry of sorted) {
      if (entry.code.length && text.startsWith(entry.code, i)) { matched = entry; break }
    }
    if (matched) {
      out += matched.phrase
      i += matched.code.length
    } else {
      out += text[i]
      i++
    }
  }
  return out
}

/**
 * What the codebook costs to ship, in bits.
 *
 * The decoder cannot read one abbreviated message without it, so it is overhead in exactly
 * the sense a Huffman code table is. The difference — and it is the whole reason
 * abbreviation systems are worth having — is that this primer is paid once per *reader*,
 * not once per message. A pilot learns METAR once and then reads a lifetime of forecasts.
 */
export function dictionaryBits(dictionary: readonly Abbreviation[]): number {
  const encoder = new TextEncoder()
  let bits = 0
  for (const { phrase, code } of dictionary) {
    bits += (encoder.encode(phrase).length + encoder.encode(code).length + 2) * 8
  }
  return bits
}

/**
 * Which source words survive into a summary, matched greedily in order.
 *
 * Used only to highlight what a lossy summary kept, and computed rather than annotated by
 * hand — the slide should not be asserting which words made it when it can check.
 */
export function survivingTokens(source: readonly string[], summary: readonly string[]): boolean[] {
  const kept = new Array<boolean>(source.length).fill(false)
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  let si = 0
  for (const word of summary) {
    const target = norm(word)
    if (!target) continue
    for (let i = si; i < source.length; i++) {
      if (norm(source[i]) === target) {
        kept[i] = true
        si = i + 1
        break
      }
    }
  }
  return kept
}
