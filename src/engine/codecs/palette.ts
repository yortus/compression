/**
 * Palette (indexed colour) reduction by median cut.
 *
 * The pedagogical point is that palettising is a *reframe*: the pixels stop being
 * colours and become indices into a shared table. Two consequences the slides lean on:
 * the index stream has far longer runs than the RGB stream did, and the table has to be
 * transmitted too — it is the clearest example of a primer that costs real bits.
 *
 * Note it is only lossy when the image has more distinct colours than the palette can
 * hold. A flat graphic often palettises losslessly; a photo never does.
 */

export interface PaletteResult {
  indices: Uint8Array
  /** Palette entries as packed [r, g, b] triples. */
  palette: number[][]
  width: number
  height: number
  lossy: boolean
  /** Distinct colours in the source, before reduction. */
  sourceColors: number
}

interface ColorEntry {
  r: number
  g: number
  b: number
  count: number
}

function uniqueColors(rgb: ArrayLike<number>): ColorEntry[] {
  const counts = new Map<number, number>()
  for (let i = 0; i < rgb.length; i += 3) {
    const key = (rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const entries: ColorEntry[] = []
  for (const [key, count] of counts) {
    entries.push({ r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff, count })
  }
  return entries
}

function channelRange(bucket: ColorEntry[]): { channel: 'r' | 'g' | 'b'; range: number } {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0
  for (const c of bucket) {
    if (c.r < rMin) rMin = c.r
    if (c.r > rMax) rMax = c.r
    if (c.g < gMin) gMin = c.g
    if (c.g > gMax) gMax = c.g
    if (c.b < bMin) bMin = c.b
    if (c.b > bMax) bMax = c.b
  }
  const ranges = [
    { channel: 'r' as const, range: rMax - rMin },
    { channel: 'g' as const, range: gMax - gMin },
    { channel: 'b' as const, range: bMax - bMin },
  ]
  return ranges.reduce((a, b) => (b.range > a.range ? b : a))
}

/**
 * Median cut: repeatedly split the widest bucket at its median until there are enough
 * buckets, then average each one. Every source colour ends up in exactly one bucket, so
 * the colour → index mapping falls out directly and no nearest-neighbour search is needed.
 */
/**
 * The median cut itself, over three-bytes-per-pixel RGB.
 *
 * Split out from `palettise` so callers that have pixels but no `ImageData` can use it —
 * the run-length slide's artwork, and the test suite, which runs in node where the DOM
 * type does not exist.
 */
export interface RgbPaletteResult {
  indices: Uint8Array
  palette: number[][]
  lossy: boolean
  sourceColors: number
}

export function palettiseRgb(rgb: ArrayLike<number>, maxColors: number): RgbPaletteResult {
  const colors = uniqueColors(rgb)
  const target = Math.max(2, Math.min(256, maxColors))

  let buckets: ColorEntry[][] = [colors]
  while (buckets.length < target) {
    // Split the bucket with the widest spread; stop early if none can be split.
    let bestIndex = -1
    let bestRange = 0
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue
      const { range } = channelRange(buckets[i])
      if (range > bestRange) {
        bestRange = range
        bestIndex = i
      }
    }
    if (bestIndex < 0) break

    const bucket = buckets[bestIndex]
    const { channel } = channelRange(bucket)
    bucket.sort((a, b) => a[channel] - b[channel])
    const mid = bucket.length >> 1
    buckets = [
      ...buckets.slice(0, bestIndex),
      bucket.slice(0, mid),
      bucket.slice(mid),
      ...buckets.slice(bestIndex + 1),
    ]
  }

  // Average each bucket, and record which palette entry every source colour maps to.
  const palette: number[][] = []
  const lookup = new Map<number, number>()
  buckets.forEach((bucket, index) => {
    let r = 0, g = 0, b = 0, total = 0
    for (const c of bucket) {
      r += c.r * c.count
      g += c.g * c.count
      b += c.b * c.count
      total += c.count
    }
    palette.push(total > 0
      ? [Math.round(r / total), Math.round(g / total), Math.round(b / total)]
      : [0, 0, 0])
    for (const c of bucket) {
      lookup.set((c.r << 16) | (c.g << 8) | c.b, index)
    }
  })

  const indices = new Uint8Array(rgb.length / 3)
  for (let p = 0, i = 0; i < rgb.length; i += 3, p++) {
    indices[p] = lookup.get((rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2]) ?? 0
  }

  return {
    indices,
    palette,
    lossy: colors.length > palette.length,
    sourceColors: colors.length,
  }
}

/** The same reduction over an `ImageData`, which is what the JPEG-side slides hold. */
export function palettise(img: ImageData, maxColors: number): PaletteResult {
  const { data, width, height } = img
  const rgb = new Uint8Array(width * height * 3)
  for (let p = 0, i = 0; i < data.length; i += 4, p += 3) {
    rgb[p] = data[i]
    rgb[p + 1] = data[i + 1]
    rgb[p + 2] = data[i + 2]
  }
  const result = palettiseRgb(rgb, maxColors)
  return { ...result, width, height }
}

/** Bits per index, given the palette size — this is what makes the index stream small. */
export function indexBits(paletteSize: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, paletteSize))))
}

/** The primer: the table the decoder cannot work without. */
export function paletteBits(paletteSize: number): number {
  return paletteSize * 24
}

export function paletteToImageData(result: PaletteResult): ImageData {
  const { indices, palette, width, height } = result
  const out = new ImageData(width, height)
  for (let p = 0; p < indices.length; p++) {
    const [r, g, b] = palette[indices[p]] ?? [0, 0, 0]
    const i = p * 4
    out.data[i] = r
    out.data[i + 1] = g
    out.data[i + 2] = b
    out.data[i + 3] = 255
  }
  return out
}
