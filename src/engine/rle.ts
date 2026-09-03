import type { RLEPair } from './types'

export function encodeRLE(zigzagged: number[]): RLEPair[] {
  const pairs: RLEPair[] = []
  let zeroCount = 0

  // First element (DC) is always emitted directly
  pairs.push({ runLength: 0, value: zigzagged[0] })

  for (let i = 1; i < 64; i++) {
    if (zigzagged[i] === 0) {
      zeroCount++
    } else {
      // JPEG limits run length to 15; emit (15,0) for longer runs
      while (zeroCount > 15) {
        pairs.push({ runLength: 15, value: 0 })
        zeroCount -= 16
      }
      pairs.push({ runLength: zeroCount, value: zigzagged[i] })
      zeroCount = 0
    }
  }

  // End-of-block: all remaining are zeros
  if (zeroCount > 0) {
    pairs.push({ runLength: 0, value: 0 })
  }

  return pairs
}

export function decodeRLE(pairs: RLEPair[]): number[] {
  const result = new Array<number>(64).fill(0)
  let pos = 0

  for (const pair of pairs) {
    if (pair.runLength === 0 && pair.value === 0 && pos > 0) {
      break // EOB
    }
    pos += pair.runLength
    if (pos < 64) {
      result[pos] = pair.value
      pos++
    }
  }

  return result
}
