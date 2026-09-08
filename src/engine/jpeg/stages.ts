import type { PipelineCache } from './pipeline'
import { estimateEncodedBits, sampleBlockIndices } from './pipeline'
import { zigzagScan } from './zigzag'
import { encodeRLE } from './rle'
import { idealBits, entropyBits } from '../codecs/entropy'
import { packSymbol, encodeBlock } from './huffman'
import { acEncodedBits } from './acCoding'
import type { Block, AllBlocks, ChannelBlocks } from './types'

/**
 * The whole JPEG chain, measured stage by stage.
 *
 * The finale slide claims each step contributes something; this is where that claim is
 * checked rather than drawn. Every intermediate stage is priced the same way — the size
 * an order-0 entropy coder would reach on that representation — so consecutive rows are
 * comparable and a stage that costs bits shows up as costing bits.
 *
 * Two rows are priced differently and say so. The first is the literal 24 bits a pixel
 * the deck quotes everywhere else, so the cascade starts from the real number rather than
 * from an idealised one; the second row is that same data entropy-priced, which isolates
 * what plain entropy coding buys before any of the pipeline has run. The last row is the
 * real thing: per-block Huffman over the RLE pairs, the same `estimateEncodedBits` that
 * `jpeg-result` and the benchmark report, so the finale ends on the number the audience
 * has been watching all along.
 *
 * An expectation worth abandoning: the DCT row usually comes out *smaller*, not larger.
 * A rotation cannot destroy information, but order-0 entropy is not preserved by one —
 * decorrelating the samples is precisely what makes a memoryless coder do better, and
 * that is the whole reason transform coding exists.
 */


export interface StageRow {
  stage: string
  /** Cumulative size of the representation at this point, in bits. */
  bits: number
  /** Change from the previous stage as a fraction: negative means it shrank. */
  delta: number
  /** What this stage actually does, in one line. */
  note: string
  /** True if this stage is where information is destroyed. */
  lossy: boolean
  /** How the number was arrived at — most rows are entropy-priced, two are not. */
  measure: 'entropy' | 'fixed' | 'huffman'
}

/** Blocks sampled per channel when a per-block measure would otherwise be O(image). */
const BLOCK_SAMPLE = 64

function roundedInts(data: Float64Array): Int32Array {
  const out = new Int32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = Math.round(data[i])
  return out
}

function channelCoefficients(channel: ChannelBlocks): Int32Array {
  const out = new Int32Array(channel.blocks.length * 64)
  let w = 0
  for (const block of channel.blocks) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) out[w++] = Math.round(block[r][c])
    }
  }
  return out
}

function allCoefficientBits(blocks: AllBlocks): number {
  return (
    idealBits(channelCoefficients(blocks.y)) +
    idealBits(channelCoefficients(blocks.cb)) +
    idealBits(channelCoefficients(blocks.cr))
  )
}

/** Averages a per-block measure over a spread of blocks and scales it to the channel. */
function scaleOverBlocks(channel: ChannelBlocks, measure: (b: Block) => number): number {
  const n = channel.blocks.length
  if (n === 0) return 0
  const indices = sampleBlockIndices(n, BLOCK_SAMPLE)
  let total = 0
  for (const i of indices) total += measure(channel.blocks[i])
  return (total / indices.length) * n
}

function overAllChannels(blocks: AllBlocks, measure: (b: Block) => number): number {
  return (
    scaleOverBlocks(blocks.y, measure) +
    scaleOverBlocks(blocks.cb, measure) +
    scaleOverBlocks(blocks.cr, measure)
  )
}

/**
 * The stages that do not depend on quality, memoised on the DCT blocks.
 *
 * Dragging the quality slider takes the `requantize` fast path, which reuses the same
 * `dctBlocks` object — so anything above quantisation is already known and re-measuring
 * it on every frame would put three full entropy passes in the drag path.
 */
const preQuantCache = new WeakMap<AllBlocks, number[]>()

function preQuantBits(cache: PipelineCache, source: ImageData): number[] {
  const hit = preQuantCache.get(cache.dctBlocks)
  if (hit) return hit

  const rgb = new Uint8Array((source.data.length / 4) * 3)
  for (let i = 0, w = 0; i < source.data.length; i += 4) {
    rgb[w++] = source.data[i]
    rgb[w++] = source.data[i + 1]
    rgb[w++] = source.data[i + 2]
  }

  const rows = [
    idealBits(rgb),
    idealBits(roundedInts(cache.ycbcr.y)) +
      idealBits(roundedInts(cache.ycbcr.cb)) +
      idealBits(roundedInts(cache.ycbcr.cr)),
    idealBits(roundedInts(cache.subsampled.y)) +
      idealBits(roundedInts(cache.subsampled.cb)) +
      idealBits(roundedInts(cache.subsampled.cr)),
    allCoefficientBits(cache.dctBlocks),
  ]
  preQuantCache.set(cache.dctBlocks, rows)
  return rows
}

/**
 * Order-0 entropy of the (run, value) symbol stream, scaled to the whole image.
 *
 * Priced the same way as the coefficient rows above it so the two are comparable —
 * the fixed 16 bits a pair that a naive RLE would spend is not what any real coder pays.
 */
function rleSymbolBits(blocks: AllBlocks): number {
  let bits = 0
  for (const channel of [blocks.y, blocks.cb, blocks.cr]) {
    const n = channel.blocks.length
    if (n === 0) continue
    const indices = sampleBlockIndices(n, BLOCK_SAMPLE)
    const symbols: number[] = []
    for (const i of indices) {
      for (const pair of encodeRLE(zigzagScan(channel.blocks[i]))) {
        symbols.push(packSymbol(pair.runLength, pair.value))
      }
    }
    if (!symbols.length) continue
    bits += entropyBits(symbols) * (symbols.length / indices.length) * n
  }
  return bits
}

export function measureStages(cache: PipelineCache, source: ImageData, quality: number): StageRow[] {
  const [rgbBits, ycbcrBits, subBits, dctBits] = preQuantBits(cache, source)
  const quantBits = allCoefficientBits(cache.quantizedBlocks)
  const rleBits = rleSymbolBits(cache.quantizedBlocks)
  const huffBits = estimateEncodedBits(cache)
  const trueRawBits = source.width * source.height * 3 * 8

  const lossyChroma = cache.subsampled.mode !== '4:4:4'

  const raw: Omit<StageRow, 'delta'>[] = [
    {
      stage: 'Raw RGB',
      bits: trueRawBits,
      note: 'three bytes a pixel — the number every other slide starts from',
      lossy: false,
      measure: 'fixed',
    },
    {
      stage: 'Entropy floor',
      bits: rgbBits,
      note: 'the same pixels, perfectly symbol-coded with no model of the image at all',
      lossy: false,
      measure: 'entropy',
    },
    {
      stage: '→ YCbCr',
      bits: ycbcrBits,
      note: 'brightness split off from colour — the same samples on different axes',
      lossy: false,
      measure: 'entropy',
    },
    {
      stage: `→ Chroma ${cache.subsampled.mode}`,
      bits: subBits,
      note: lossyChroma
        ? 'colour resolution thrown away, where the eye has least of it'
        : 'no subsampling selected, so nothing is discarded here',
      lossy: lossyChroma,
      measure: 'entropy',
    },
    {
      stage: '→ 8×8 blocks + DCT',
      bits: dctBits,
      note: 'each block re-expressed as 64 frequencies — reversible, and far less scattered',
      lossy: false,
      measure: 'entropy',
    },
    {
      stage: `→ Quantise (Q${quality})`,
      bits: quantBits,
      note: 'divide and round — most high-frequency coefficients collapse to zero',
      lossy: true,
      measure: 'entropy',
    },
    {
      stage: '→ Zigzag + RLE',
      bits: rleBits,
      note: 'those zeros gathered into runs, and the runs priced as symbols',
      lossy: false,
      measure: 'entropy',
    },
    {
      stage: '→ Huffman, per block',
      bits: huffBits,
      note: 'real codes, built per block — the figure the rest of the deck reports',
      lossy: false,
      measure: 'huffman',
    },
  ]

  return raw.map((row, i) => ({
    ...row,
    delta: i === 0 ? 0 : (row.bits - raw[i - 1].bits) / raw[i - 1].bits,
  }))
}

// --- Raster versus zigzag ---------------------------------------------------

export interface ScanComparison {
  /** RLE pairs the block produces when read row by row, and along the zigzag. */
  rasterPairs: number
  zigzagPairs: number
  /** Distinct (run, value) symbols each order needs — the size of its alphabet. */
  rasterSymbols: number
  zigzagSymbols: number
  /**
   * The zero-run before each surviving coefficient. This is the thing that actually
   * differs between the orders, so it is what the slide shows.
   */
  rasterRunLengths: number[]
  zigzagRunLengths: number[]
}

export function flattenRaster(block: Block): number[] {
  const out: number[] = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out.push(block[r][c])
  return out
}

function distinctSymbols(pairs: { runLength: number; value: number }[]): number {
  return new Set(pairs.map(p => packSymbol(p.runLength, p.value))).size
}

/**
 * The zigzag slide's argument, measured — and it is not the argument you would guess.
 *
 * The obvious metric, "how many RLE pairs?", is the same in both orders: a pair is
 * emitted per non-zero coefficient plus one end-of-block marker, and reordering does not
 * change how many non-zeros there are. What reordering changes is the *run lengths*
 * between them. Read row by row, consecutive non-zeros are separated by whatever the row
 * stride happens to leave — fives, sixes, thirteens — so the coder faces a wide, flat
 * alphabet. Read along the diagonals, the non-zeros are adjacent, so nearly every run
 * length is zero and the alphabet collapses onto one very common symbol. That is what the
 * entropy coder is paid in, so the comparison is drawn in Huffman bits.
 */
export function compareScanOrders(block: Block): ScanComparison {
  const rasterPairs = encodeRLE(flattenRaster(block))
  const zigzagPairs = encodeRLE(zigzagScan(block))
  return {
    rasterPairs: rasterPairs.length,
    zigzagPairs: zigzagPairs.length,
    rasterSymbols: distinctSymbols(rasterPairs),
    zigzagSymbols: distinctSymbols(zigzagPairs),
    // Drop the DC pair (always run 0) and the end-of-block marker: neither is a gap.
    rasterRunLengths: rasterPairs.slice(1, -1).map(p => p.runLength),
    zigzagRunLengths: zigzagPairs.slice(1, -1).map(p => p.runLength),
  }
}

/** The same comparison across the whole image, so one lucky block cannot carry it. */
export function compareScanOrdersWholeImage(cache: PipelineCache): {
  rasterBits: number
  zigzagBits: number
  rasterSymbolBits: number
  zigzagSymbolBits: number
} {
  const q = cache.quantizedBlocks
  return {
    rasterBits: overAllChannels(q, b => encodeBlock(encodeRLE(flattenRaster(b))).totalBits),
    zigzagBits: overAllChannels(q, b => encodeBlock(encodeRLE(zigzagScan(b))).totalBits),
    // Order-0 entropy of the symbol stream, which is what a real shared code table would
    // charge — the per-block figures above each get their own free tree, which flatters
    // both orders equally but hides how much narrower the zigzag alphabet is.
    rasterSymbolBits: orderSymbolBits(q, flattenRaster),
    zigzagSymbolBits: orderSymbolBits(q, zigzagScan),
  }
}

/**
 * Real baseline-JPEG AC bits over every block in both scan orders — the honest cost the
 * zigzag slide compares, from the standard luminance Huffman table.
 */
export function acBitsWholeImage(cache: PipelineCache): { rasterAcBits: number; zigzagAcBits: number } {
  const q = cache.quantizedBlocks
  let raster = 0
  let zigzag = 0
  for (const channel of [q.y, q.cb, q.cr]) {
    for (const b of channel.blocks) {
      raster += acEncodedBits(flattenRaster(b))
      zigzag += acEncodedBits(zigzagScan(b))
    }
  }
  return { rasterAcBits: raster, zigzagAcBits: zigzag }
}

function orderSymbolBits(blocks: AllBlocks, order: (b: Block) => number[]): number {
  let bits = 0
  for (const channel of [blocks.y, blocks.cb, blocks.cr]) {
    const n = channel.blocks.length
    if (n === 0) continue
    const indices = sampleBlockIndices(n, BLOCK_SAMPLE)
    const symbols: number[] = []
    for (const i of indices) {
      for (const pair of encodeRLE(order(channel.blocks[i]))) {
        symbols.push(packSymbol(pair.runLength, pair.value))
      }
    }
    if (!symbols.length) continue
    bits += entropyBits(symbols) * (symbols.length / indices.length) * n
  }
  return bits
}
