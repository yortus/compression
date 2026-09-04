import { describe, it, expect } from 'vitest'
import {
  encodePairs, decodePairs, countRuns, pairRLE,
  encodeEscape, decodeEscape, escapeRLE, MAX_RUN, ESCAPE_THRESHOLD,
} from './rle'
import { palettise, paletteToImageData, indexBits } from './palette'
import { splitPlanes, joinPlanes, interleavedBytes, planeToImageData } from './planes'
import { roundTrips } from './types'
import { compareImages } from '../compare'

/**
 * These tests exist for one reason: the deck stands in front of a room and claims every
 * one of these transforms is invertible. A silent regression here turns a slide into a
 * false statement, so each codec is checked by decoding its own output and comparing.
 */

// The palette and plane helpers construct ImageData, which Node does not provide.
class NodeImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  constructor(a: number | Uint8ClampedArray, b: number, c?: number) {
    if (typeof a === 'number') {
      this.width = a
      this.height = b
      this.data = new Uint8ClampedArray(a * b * 4)
    } else {
      this.data = a
      this.width = b
      this.height = c!
    }
  }
}
globalThis.ImageData ??= NodeImageData as unknown as typeof ImageData

function bytesOf(text: string): number[] {
  return [...text].map(c => c.charCodeAt(0))
}

function imageOf(pixels: [number, number, number][], width: number): ImageData {
  const height = pixels.length / width
  const img = new ImageData(width, height)
  pixels.forEach(([r, g, b], i) => {
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  })
  return img
}

const SAMPLES: Record<string, number[]> = {
  empty: [],
  single: [42],
  allSame: new Array(50).fill(7),
  runs: bytesOf('AAAAAAAAAAAABBBBBBBBCCCCDDDD'),
  noRuns: bytesOf('compression is a two-way transform'),
  alternating: Array.from({ length: 64 }, (_, i) => i % 2),
  // Longer than a single count byte can express, so the encoder has to split it.
  overlongRun: new Array(MAX_RUN + 45).fill(3),
}

describe('pair RLE', () => {
  for (const [name, input] of Object.entries(SAMPLES)) {
    it(`round trips: ${name}`, () => {
      expect(decodePairs(encodePairs(input))).toEqual(input)
    })
  }

  it('caps runs at one byte and stitches them back together', () => {
    const pairs = encodePairs(SAMPLES.overlongRun)
    expect(pairs).toHaveLength(2)
    expect(pairs[0].count).toBe(MAX_RUN)
    expect(pairs[1].count).toBe(45)
    expect(decodePairs(pairs)).toEqual(SAMPLES.overlongRun)
  })

  it('expands data that has no runs — this is not a bug, it is the slide', () => {
    const input = SAMPLES.noRuns
    const encoded = pairRLE.encode(input)
    expect(encoded.payloadBits).toBeGreaterThan(pairRLE.rawBits(input))
  })

  it('countRuns agrees with the real encoder', () => {
    // The image-scale slides report countRuns() rather than building the pairs,
    // so the two must not be allowed to drift apart.
    for (const input of Object.values(SAMPLES)) {
      expect(countRuns(input)).toBe(encodePairs(input).length)
    }
  })

  it('satisfies the Codec contract', () => {
    const equal = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
    expect(roundTrips(pairRLE, SAMPLES.runs, equal)).toBe(true)
  })
})

describe('escape RLE', () => {
  const ESC = '#'.charCodeAt(0)

  for (const [name, input] of Object.entries(SAMPLES)) {
    it(`round trips: ${name}`, () => {
      expect(decodeEscape(encodeEscape(input, ESC), ESC)).toEqual(input)
    })
  }

  it('round trips data that contains the escape byte itself', () => {
    const input = bytesOf('aaaaaaaa #### hash # marks ##### everywhere #')
    expect(decodeEscape(encodeEscape(input, ESC), ESC)).toEqual(input)
  })

  it('round trips when the escape byte is also the repeated value', () => {
    const input = new Array(20).fill(ESC)
    expect(decodeEscape(encodeEscape(input, ESC), ESC)).toEqual(input)
  })

  it('leaves runs below the threshold as literals', () => {
    const input = new Array(ESCAPE_THRESHOLD - 1).fill(65)
    expect(encodeEscape(input, ESC)).toEqual(input)
  })

  it('counts the escape byte as primer, not payload', () => {
    const encoded = escapeRLE(ESC).encode(SAMPLES.runs)
    expect(encoded.primerBits).toBe(8)
    expect(escapeRLE(ESC).decode(encoded)).toEqual(SAMPLES.runs)
  })
})

describe('palette', () => {
  const FOUR_COLORS: [number, number, number][] = [
    [255, 0, 0], [255, 0, 0], [0, 255, 0], [0, 255, 0],
    [0, 0, 255], [0, 0, 255], [10, 10, 10], [10, 10, 10],
  ]

  it('is lossless when the image fits in the palette', () => {
    const img = imageOf(FOUR_COLORS, 4)
    const result = palettise(img, 8)
    expect(result.lossy).toBe(false)
    expect(result.sourceColors).toBe(4)
    // Round trip: rebuilding from indices must reproduce the original pixels exactly.
    expect([...paletteToImageData(result).data]).toEqual([...img.data])
  })

  it('is lossy when colours have to be merged', () => {
    const img = imageOf(FOUR_COLORS, 4)
    const result = palettise(img, 2)
    expect(result.lossy).toBe(true)
    expect(result.palette.length).toBeLessThanOrEqual(2)
  })

  it('keeps every index inside the palette', () => {
    const img = imageOf(FOUR_COLORS, 4)
    const result = palettise(img, 4)
    expect(result.indices).toHaveLength(img.width * img.height)
    for (const i of result.indices) expect(i).toBeLessThan(result.palette.length)
  })

  it('sizes indices by palette size', () => {
    expect(indexBits(2)).toBe(1)
    expect(indexBits(16)).toBe(4)
    expect(indexBits(256)).toBe(8)
  })
})

describe('colour planes', () => {
  const PIXELS: [number, number, number][] = [
    [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12],
    [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24],
  ]

  it('splits and rejoins without losing a byte', () => {
    const img = imageOf(PIXELS, 4)
    const rejoined = joinPlanes(splitPlanes(img))
    expect([...rejoined.data]).toEqual([...img.data])
  })

  it('renders a plane into its own channel when tinted, and all three when not', () => {
    const img = imageOf(PIXELS, 4)
    const { g } = splitPlanes(img)

    const tinted = planeToImageData(g, img.width, img.height, 'g')
    expect([...tinted.data.slice(0, 4)]).toEqual([0, g[0], 0, 255])

    const grey = planeToImageData(g, img.width, img.height)
    expect([...grey.data.slice(0, 4)]).toEqual([g[0], g[0], g[0], 255])
  })

  it('reorders exactly the same bytes as the interleaved stream', () => {
    // The claim on the slide is that nothing is added or removed — only the order
    // changes — so the two streams must be permutations of one another.
    const img = imageOf(PIXELS, 4)
    const { r, g, b } = splitPlanes(img)
    const planar = [...r, ...g, ...b].sort((x, y) => x - y)
    const interleaved = [...interleavedBytes(img)].sort((x, y) => x - y)
    expect(planar).toEqual(interleaved)
  })
})

describe('image comparison', () => {
  // The lossy/lossless badge is driven by this, so a wrong answer here mislabels a slide.
  const PIXELS: [number, number, number][] = [
    [10, 20, 30], [40, 50, 60], [70, 80, 90], [100, 110, 120],
  ]

  function withPixel(pixels: [number, number, number][], index: number, rgb: [number, number, number]) {
    const copy = pixels.map(p => [...p] as [number, number, number])
    copy[index] = rgb
    return copy
  }

  it('reports an identical copy as identical', () => {
    const a = imageOf(PIXELS, 2)
    const b = imageOf(PIXELS, 2)
    expect(compareImages(a, b)).toMatchObject({ identical: true, changedPixels: 0, maxChannelError: 0 })
  })

  it('notices a single byte of difference', () => {
    const a = imageOf(PIXELS, 2)
    const b = imageOf(withPixel(PIXELS, 2, [70, 80, 91]), 2)
    const diff = compareImages(a, b)
    expect(diff.identical).toBe(false)
    expect(diff.changedPixels).toBe(1)
    expect(diff.maxChannelError).toBe(1)
  })

  it('measures the largest single-channel error', () => {
    const a = imageOf(PIXELS, 2)
    const b = imageOf(withPixel(PIXELS, 0, [10, 20, 200]), 2)
    expect(compareImages(a, b).maxChannelError).toBe(170)
  })

  it('treats differently sized images as different', () => {
    expect(compareImages(imageOf(PIXELS, 2), imageOf(PIXELS.slice(0, 2), 2)).identical).toBe(false)
  })
})
