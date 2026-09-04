import type { Codec } from './types'

/**
 * Run-length encoding, in the two forms the talk needs.
 *
 * `pairs` is the naive textbook form: every run becomes (count, value), including
 * runs of one. It is the honest starting point precisely because it *expands* data
 * that has no runs — which is the whole point of the RGB bitmap slide.
 *
 * `escape` is the practical form: literals pass through untouched and only runs long
 * enough to pay for themselves are collapsed, marked by an agreed escape byte. That
 * escape byte is the shared primer both sides must already know about, and the
 * awkward case — data that contains the escape byte itself — is the slide.
 */

export interface RunPair {
  count: number
  value: number
}

/** Counts and values are one byte each, so a run caps at 255. */
export const MAX_RUN = 255
const PAIR_BITS = 16

// --- Pair form ------------------------------------------------------------

export function encodePairs(symbols: ArrayLike<number>): RunPair[] {
  const pairs: RunPair[] = []
  let i = 0
  while (i < symbols.length) {
    const value = symbols[i]
    let count = 1
    while (i + count < symbols.length && symbols[i + count] === value && count < MAX_RUN) count++
    pairs.push({ count, value })
    i += count
  }
  return pairs
}

export function decodePairs(pairs: readonly RunPair[]): number[] {
  const out: number[] = []
  for (const { count, value } of pairs) {
    for (let i = 0; i < count; i++) out.push(value)
  }
  return out
}

/**
 * Run count without materialising the runs — the image-scale slides only need the
 * number, and 786 KB of pixels would otherwise become hundreds of thousands of objects.
 */
export function countRuns(data: ArrayLike<number>): number {
  if (data.length === 0) return 0
  let runs = 0
  let i = 0
  while (i < data.length) {
    const value = data[i]
    let count = 1
    while (i + count < data.length && data[i + count] === value && count < MAX_RUN) count++
    runs++
    i += count
  }
  return runs
}

/** Histogram of run lengths, for showing *why* a given reframing helps. */
export function runLengthHistogram(data: ArrayLike<number>, buckets = 8): number[] {
  const hist = new Array<number>(buckets).fill(0)
  let i = 0
  while (i < data.length) {
    const value = data[i]
    let count = 1
    while (i + count < data.length && data[i + count] === value && count < MAX_RUN) count++
    // Bucket by powers of two: 1, 2-3, 4-7, 8-15, ...
    const bucket = Math.min(buckets - 1, Math.floor(Math.log2(count)))
    hist[bucket]++
    i += count
  }
  return hist
}

export const pairRLE: Codec<number[], RunPair[]> = {
  name: 'RLE (count, value)',
  lossy: false,
  encode(input) {
    const data = encodePairs(input)
    return { data, payloadBits: data.length * PAIR_BITS, primerBits: 0 }
  },
  decode: encoded => decodePairs(encoded.data),
  rawBits: input => input.length * 8,
}

/** Bits a pair-RLE payload would take, without building it. */
export function pairBitsFor(data: ArrayLike<number>): number {
  return countRuns(data) * PAIR_BITS
}

// --- Escape form ----------------------------------------------------------

/** Runs shorter than this cost more to mark than they save. */
export const ESCAPE_THRESHOLD = 4

export function encodeEscape(bytes: ArrayLike<number>, esc: number): number[] {
  const out: number[] = []
  let i = 0
  while (i < bytes.length) {
    const value = bytes[i]
    let count = 1
    while (i + count < bytes.length && bytes[i + count] === value && count < MAX_RUN) count++

    if (count >= ESCAPE_THRESHOLD) {
      out.push(esc, count, value)
    } else {
      for (let k = 0; k < count; k++) {
        // A literal that happens to *be* the escape byte has to be marked too:
        // count 0 is reserved to mean "one literal escape byte".
        if (value === esc) out.push(esc, 0)
        else out.push(value)
      }
    }
    i += count
  }
  return out
}

export function decodeEscape(encoded: ArrayLike<number>, esc: number): number[] {
  const out: number[] = []
  let i = 0
  while (i < encoded.length) {
    if (encoded[i] !== esc) {
      out.push(encoded[i])
      i++
      continue
    }
    const count = encoded[i + 1]
    if (count === 0) {
      out.push(esc)
      i += 2
    } else {
      const value = encoded[i + 2]
      for (let k = 0; k < count; k++) out.push(value)
      i += 3
    }
  }
  return out
}

/** The escape byte itself is the primer: 8 bits both sides must agree on up front. */
export function escapeRLE(esc: number): Codec<number[], number[]> {
  return {
    name: `RLE (escape 0x${esc.toString(16).padStart(2, '0').toUpperCase()})`,
    lossy: false,
    encode(input) {
      const data = encodeEscape(input, esc)
      return { data, payloadBits: data.length * 8, primerBits: 8 }
    },
    decode: encoded => decodeEscape(encoded.data, esc),
    rawBits: input => input.length * 8,
  }
}
