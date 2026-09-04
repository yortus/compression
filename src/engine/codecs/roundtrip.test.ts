import { describe, it, expect } from 'vitest'
import {
  encodePairs, decodePairs, countRuns, pairRLE,
  encodeEscape, decodeEscape, escapeRLE, MAX_RUN, ESCAPE_THRESHOLD,
} from './rle'
import { palettise, paletteToImageData, indexBits } from './palette'
import { splitPlanes, joinPlanes, interleavedBytes, planeToImageData, correlation } from './planes'
import { roundTrips } from './types'
import { compareImages } from '../compare'
import { buildHuffman, countSymbols, encodeSymbols, decodeBits, payloadBits } from './huffman'
import {
  SIGNAL_PRESETS, SIGNAL_LENGTH, dct1d, idct1d, partialReconstruct, rmse, energyRank,
} from '../signal'
import { sampleBlockIndices } from '../jpeg/pipeline'
import {
  encodeRle8, decodeRle8, rleWouldExpand, rowStride, uncompressedSize,
} from '../formats/bmp'
import { imageToYcbcr } from '../jpeg/colorspace'

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

describe('huffman over arbitrary symbols', () => {
  const MESSAGES = [
    'aaaaaaaaaaaaaaaabbbbbbbbccccddee',
    'the sooner the better',
    'abcdefghabcdefgh',
    'x',
    'zzzzzzzz',
  ]

  it.each(MESSAGES)('decodes its own bitstream back exactly: %s', text => {
    const symbols = [...text]
    const build = buildHuffman(countSymbols(symbols))
    const bits = encodeSymbols(symbols, build.codes)
    expect(decodeBits(build.tree!, bits).join('')).toBe(text)
  })

  it('is a prefix code — no code starts with another', () => {
    const build = buildHuffman(countSymbols([...'the sooner the better']))
    const codes = [...build.codes.values()]
    for (const a of codes) {
      for (const b of codes) {
        if (a !== b) expect(b.startsWith(a)).toBe(false)
      }
    }
  })

  it('gives the more frequent symbol a code no longer than the rarer one', () => {
    const build = buildHuffman(countSymbols([...'aaaaaaaaaaaaaaaabbbbbbbbccccddee']))
    expect(build.codes.get('a')!.length).toBeLessThanOrEqual(build.codes.get('e')!.length)
  })

  it('counts payload bits without building the bitstring', () => {
    const symbols = [...'aaaaaaaaaaaaaaaabbbbbbbbccccddee']
    const counts = countSymbols(symbols)
    const build = buildHuffman(counts)
    expect(payloadBits(counts, build.codes)).toBe(encodeSymbols(symbols, build.codes).length)
  })

  it('records one merge per symbol beyond the first', () => {
    const build = buildHuffman(countSymbols([...'abcdefghabcdefgh']))
    expect(build.steps.length).toBe(build.leaves.length - 1)
    // The last step leaves exactly one tree on the table.
    expect(build.steps[build.steps.length - 1].pool.length).toBe(1)
  })

  it('handles a single distinct symbol without producing an empty code', () => {
    const build = buildHuffman(countSymbols([...'zzzz']))
    expect(build.codes.get('z')).toBe('0')
  })
})

describe('1-D cosine transform', () => {
  const SIGNALS = SIGNAL_PRESETS.map(p => p.samples)

  it.each(SIGNAL_PRESETS.map(p => p.name))('inverts exactly for the %s preset', name => {
    const x = SIGNAL_PRESETS.find(p => p.name === name)!.samples
    const back = idct1d(dct1d(x))
    for (let i = 0; i < x.length; i++) expect(back[i]).toBeCloseTo(x[i], 10)
  })

  it('conserves energy — the transform is a rotation, not a reduction', () => {
    for (const x of SIGNALS) {
      const energy = (v: readonly number[]) => v.reduce((s, n) => s + n * n, 0)
      expect(energy(dct1d(x))).toBeCloseTo(energy(x), 8)
    }
  })

  it('puts a constant signal entirely in the first coefficient', () => {
    const flat = new Array<number>(SIGNAL_LENGTH).fill(0.5)
    const coeffs = dct1d(flat)
    expect(Math.abs(coeffs[0])).toBeGreaterThan(1)
    for (let k = 1; k < coeffs.length; k++) expect(coeffs[k]).toBeCloseTo(0, 10)
  })

  it('keeping every coefficient reconstructs exactly', () => {
    for (const x of SIGNALS) {
      expect(rmse(x, partialReconstruct(dct1d(x), SIGNAL_LENGTH))).toBeCloseTo(0, 10)
    }
  })

  it('needs far fewer coefficients for a smooth signal than for noise', () => {
    const smooth = SIGNAL_PRESETS.find(p => p.name === 'Smooth')!.samples
    const noise = SIGNAL_PRESETS.find(p => p.name === 'Noise')!.samples
    expect(energyRank(dct1d(smooth), 0.99)).toBeLessThan(energyRank(dct1d(noise), 0.99))
  })
})

describe('whole-image block sampling', () => {
  // The samples are all 512px wide, so a channel is 64 blocks across. A fixed stride of
  // n/64 lands on the same column of every row and measures the left edge of the image.
  const BLOCKS_PER_ROW = 64

  it('does not land on a single column of a 64-wide block grid', () => {
    const columns = new Set(sampleBlockIndices(4096, 64).map(i => i % BLOCKS_PER_ROW))
    expect(columns.size).toBeGreaterThan(20)
  })

  it('spreads over the whole image, not just the start', () => {
    const idx = sampleBlockIndices(4096, 64)
    expect(Math.min(...idx)).toBeLessThan(200)
    expect(Math.max(...idx)).toBeGreaterThan(3800)
  })

  it('is deterministic, so the reported size does not flicker', () => {
    expect(sampleBlockIndices(4096, 64)).toEqual(sampleBlockIndices(4096, 64))
  })

  it('returns every block when there are fewer than asked for', () => {
    expect(sampleBlockIndices(9, 64)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('BMP BI_RLE8', () => {
  function roundTrip(indices: number[], width: number, height: number) {
    const src = Uint8Array.from(indices)
    const encoded = encodeRle8(src, width, height)
    return { encoded, decoded: decodeRle8(encoded, width, height) }
  }

  const CASES: [string, number[], number, number][] = [
    ['long runs', [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], 6, 2],
    ['no runs at all', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 6, 2],
    ['alternating', [1, 2, 1, 2, 1, 2, 1, 2], 4, 2],
    ['single colour', new Array(64).fill(7), 8, 8],
    ['odd literal count', [1, 2, 3, 9, 9, 9, 9, 4, 5], 9, 1],
    ['run longer than 255', new Array(600).fill(3), 600, 1],
    ['one pixel', [42], 1, 1],
  ]

  it.each(CASES)('decodes back exactly: %s', (_name, indices, width, height) => {
    const { decoded } = roundTrip(indices, width, height)
    expect([...decoded]).toEqual(indices)
  })

  it('always terminates with the end-of-bitmap marker', () => {
    const { encoded } = roundTrip([1, 1, 1, 2, 3], 5, 1)
    expect([encoded[encoded.length - 2], encoded[encoded.length - 1]]).toEqual([0, 1])
  })

  it('pads an odd-length absolute block to a word boundary', () => {
    // Three literals is the shortest absolute block, and needs one byte of padding.
    const { encoded } = roundTrip([1, 2, 3], 3, 1)
    expect([...encoded.slice(0, 6)]).toEqual([0, 3, 1, 2, 3, 0])
  })

  it('collapses a flat image far below its uncompressed size', () => {
    const flat = new Uint8Array(64 * 64).fill(5)
    const encoded = encodeRle8(flat, 64, 64)
    expect(encoded.length).toBeLessThan(uncompressedSize(64, 64, 8, 256) / 10)
  })

  // The failure mode the act is built on: RLE over data with no runs costs more than
  // it saves, which is why a real encoder checks before choosing BI_RLE8.
  it('notices when RLE would expand the file', () => {
    const noise = Uint8Array.from({ length: 64 * 64 }, (_, i) => (i * 37) % 251)
    expect(rleWouldExpand(64, 64, noise, 256)).toBe(true)
    const flat = new Uint8Array(64 * 64).fill(5)
    expect(rleWouldExpand(64, 64, flat, 256)).toBe(false)
  })

  it('pads rows to a four-byte boundary', () => {
    expect(rowStride(1, 24)).toBe(4)   // 3 bytes of pixel, one of padding
    expect(rowStride(2, 24)).toBe(8)   // 6 -> 8
    expect(rowStride(4, 24)).toBe(12)  // already aligned
    expect(rowStride(5, 8)).toBe(8)    // 5 -> 8
  })
})

describe('plane correlation', () => {
  it('is 1 for a plane against itself', () => {
    const a = Uint8Array.from([1, 5, 9, 20, 200, 4])
    expect(correlation(a, a)).toBeCloseTo(1, 10)
  })

  it('is -1 for a plane against its inverse', () => {
    const a = Uint8Array.from([0, 50, 100, 150, 200, 250])
    const b = Uint8Array.from([...a].map(v => 255 - v))
    expect(correlation(a, b)).toBeCloseTo(-1, 10)
  })

  it('is 0 for a flat plane, which correlates with nothing', () => {
    expect(correlation(new Uint8Array(8).fill(7), Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(0)
  })

  // The colour act's claim, checked on synthetic data: a grey-ish image has near-identical
  // RGB planes, and the YCbCr rotation is what breaks that redundancy up.
  it('finds RGB planes correlated and YCbCr planes much less so', () => {
    const n = 4096
    const img = new ImageData(64, 64)
    for (let i = 0; i < n; i++) {
      const base = (i * 7) % 200
      img.data[i * 4] = base + 20
      img.data[i * 4 + 1] = base + 10
      img.data[i * 4 + 2] = base
      img.data[i * 4 + 3] = 255
    }
    const { r, g, b } = splitPlanes(img)
    expect(Math.abs(correlation(r, g))).toBeGreaterThan(0.99)
    expect(Math.abs(correlation(g, b))).toBeGreaterThan(0.99)

    const ycbcr = imageToYcbcr(img)
    expect(Math.abs(correlation(ycbcr.y, ycbcr.cb))).toBeLessThan(0.5)
  })
})
