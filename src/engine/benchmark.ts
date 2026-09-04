import { loadImageData, SAMPLES } from './loadImage'
import { interleavedBytes, splitPlanes } from './codecs/planes'
import { countRuns } from './codecs/rle'
import { palettise, indexBits, paletteBits } from './codecs/palette'
import { runFullPipeline, estimateEncodedBits } from './jpeg/pipeline'

/**
 * Runs every technique in the deck over every sample image, so the conclusions can show
 * brittleness as a *shape* rather than a claim: how far a technique's ratio moves when
 * the data changes is the interesting number, not its best case.
 *
 * This is the only place that measures more than the currently selected image, so it
 * loads the samples itself and caches the answer for the session.
 */

export interface TechniqueRow {
  technique: string
  /** Compression ratio per sample, in BENCHMARK_SAMPLES order. Below 1 means it grew. */
  ratios: number[]
  lossy: boolean
  /** Best case over worst case — how much the technique cares what it is fed. */
  spread: number
  /**
   * The ratio it is guaranteed to beat whatever the input. This, not low variance, is
   * what makes a technique dependable: RLE over interleaved RGB barely varies either,
   * but it is consistently useless.
   */
  worst: number
}

const PALETTE_SIZE = 16
const JPEG_QUALITY = 50

/**
 * A deliberate subset, not every sample: three bars per technique stays readable, and
 * these three span the range that matters — noisy detail, flat colour, smooth tone.
 * Measuring all eleven would also mean eleven full JPEG pipeline runs on slide entry.
 */
const BENCHMARK_SAMPLE_NAMES = ['Photo', 'Graphic', 'Gradient'] as const

export const BENCHMARK_SAMPLES = BENCHMARK_SAMPLE_NAMES.map(
  name => SAMPLES.find(s => s.name === name)!,
)

let cached: Promise<TechniqueRow[]> | null = null

export function measureAllSamples(): Promise<TechniqueRow[]> {
  cached ??= measure()
  return cached
}

async function measure(): Promise<TechniqueRow[]> {
  const images = await Promise.all(BENCHMARK_SAMPLES.map(s => loadImageData(s.url)))

  const rows: TechniqueRow[] = [
    { technique: 'RLE, interleaved RGB', lossy: false, ratios: images.map(rleInterleaved), spread: 0, worst: 0 },
    { technique: 'RLE, colour planes', lossy: false, ratios: images.map(rlePlanes), spread: 0, worst: 0 },
    { technique: `Palette ${PALETTE_SIZE} + RLE`, lossy: true, ratios: images.map(palettePlusRle), spread: 0, worst: 0 },
    { technique: `JPEG pipeline (Q${JPEG_QUALITY})`, lossy: true, ratios: images.map(jpeg), spread: 0, worst: 0 },
  ]

  for (const row of rows) {
    row.worst = Math.min(...row.ratios)
    row.spread = Math.max(...row.ratios) / row.worst
  }
  return rows
}

function rawBits(img: ImageData) {
  return img.width * img.height * 3 * 8
}

function rleInterleaved(img: ImageData): number {
  return rawBits(img) / (countRuns(interleavedBytes(img)) * 16)
}

function rlePlanes(img: ImageData): number {
  const { r, g, b } = splitPlanes(img)
  const runs = countRuns(r) + countRuns(g) + countRuns(b)
  return rawBits(img) / (runs * 16)
}

function palettePlusRle(img: ImageData): number {
  const result = palettise(img, PALETTE_SIZE)
  const bits = countRuns(result.indices) * (8 + indexBits(result.palette.length))
  return rawBits(img) / (bits + paletteBits(result.palette.length))
}

function jpeg(img: ImageData): number {
  const cache = runFullPipeline(img, JPEG_QUALITY, '4:2:0')
  return rawBits(img) / estimateEncodedBits(cache)
}
