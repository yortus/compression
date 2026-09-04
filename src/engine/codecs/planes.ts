/**
 * Interleaved RGB versus separate colour planes.
 *
 * Nothing is thrown away and no clever coding is added — the bytes are simply visited
 * in a different order. That it compresses better afterwards is the reframing argument
 * in its purest form, which is why this slide sits at the end of the RLE act.
 */

export interface Planes {
  r: Uint8Array
  g: Uint8Array
  b: Uint8Array
  width: number
  height: number
}

/** The pixel stream as a codec would actually see it: RGB triples, no alpha. */
export function interleavedBytes(img: ImageData): Uint8Array {
  const out = new Uint8Array(img.width * img.height * 3)
  const { data } = img
  for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
    out[o] = data[i]
    out[o + 1] = data[i + 1]
    out[o + 2] = data[i + 2]
  }
  return out
}

export function splitPlanes(img: ImageData): Planes {
  const n = img.width * img.height
  const r = new Uint8Array(n)
  const g = new Uint8Array(n)
  const b = new Uint8Array(n)
  const { data } = img
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    r[p] = data[i]
    g[p] = data[i + 1]
    b[p] = data[i + 2]
  }
  return { r, g, b, width: img.width, height: img.height }
}

export function joinPlanes(planes: Planes): ImageData {
  const { r, g, b, width, height } = planes
  const out = new ImageData(width, height)
  for (let p = 0, i = 0; p < r.length; p++, i += 4) {
    out.data[i] = r[p]
    out.data[i + 1] = g[p]
    out.data[i + 2] = b[p]
    out.data[i + 3] = 255
  }
  return out
}

export type PlaneChannel = 'r' | 'g' | 'b'

const CHANNEL_OFFSET: Record<PlaneChannel, number> = { r: 0, g: 1, b: 2 }

/**
 * Render one plane for display. Greyscale is the literal reading — a plane is just
 * intensities — while tinting into its own channel makes it obvious at a glance which
 * plane is which, and shows what that channel actually contributes to the picture.
 */
export function planeToImageData(
  plane: Uint8Array,
  width: number,
  height: number,
  channel?: PlaneChannel,
): ImageData {
  const out = new ImageData(width, height)
  const offset = channel ? CHANNEL_OFFSET[channel] : -1
  for (let p = 0; p < plane.length; p++) {
    const i = p * 4
    if (offset < 0) {
      out.data[i] = out.data[i + 1] = out.data[i + 2] = plane[p]
    } else {
      out.data[i + offset] = plane[p]
    }
    out.data[i + 3] = 255
  }
  return out
}

/**
 * Pearson correlation between two planes, -1 to 1.
 *
 * This is the number that explains the whole colour act. Split an image into R, G and B
 * and all three planes look like the picture — bright where the picture is bright — so
 * they are strongly correlated, typically 0.9 or above. That correlation is pure
 * redundancy: the same information stored three times, and no amount of run-length
 * cleverness touches it, because it is a relationship *between* planes rather than along
 * one of them.
 *
 * Rotating to YCbCr is the fix, and it is worth showing rather than asserting: the same
 * measurement on Y, Cb and Cr collapses towards zero. Nothing was discarded to achieve
 * that — the transform is invertible — which is why it is the purest example in the deck
 * of a reframe doing the work.
 */
export function correlation(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0

  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i] }
  const meanA = sumA / n
  const meanB = sumB / n

  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }

  const denom = Math.sqrt(varA * varB)
  // A perfectly flat plane has no variance and no meaningful correlation with anything.
  return denom === 0 ? 0 : cov / denom
}
