/**
 * Comparing a reconstruction against its original.
 *
 * The deck labels every result lossy or lossless, and that label should be measured
 * rather than assumed. "JPEG is lossy" is true of the format in general but not of every
 * run of it: at maximum quality with no chroma subsampling, a flat or synthetic image can
 * come back bit-identical, and a badge that says otherwise is simply wrong on that slide.
 */

export interface ImageDiff {
  /** True only if every RGB byte matches. */
  identical: boolean
  changedPixels: number
  /** Largest single-channel error, 0-255. */
  maxChannelError: number
  /** Root-mean-square error across all channels, for a sense of scale. */
  rmse: number
}

export function compareImages(a: ImageData, b: ImageData): ImageDiff {
  if (a.width !== b.width || a.height !== b.height) {
    return { identical: false, changedPixels: a.width * a.height, maxChannelError: 255, rmse: 255 }
  }

  let changedPixels = 0
  let maxChannelError = 0
  let squaredError = 0

  for (let i = 0; i < a.data.length; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i])
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1])
    const db = Math.abs(a.data[i + 2] - b.data[i + 2])
    if (dr | dg | db) changedPixels++
    if (dr > maxChannelError) maxChannelError = dr
    if (dg > maxChannelError) maxChannelError = dg
    if (db > maxChannelError) maxChannelError = db
    squaredError += dr * dr + dg * dg + db * db
  }

  const samples = (a.data.length / 4) * 3
  return {
    identical: changedPixels === 0,
    changedPixels,
    maxChannelError,
    rmse: Math.sqrt(squaredError / samples),
  }
}
