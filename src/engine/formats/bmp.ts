/**
 * Windows BMP, enough of it to price the run-length slide honestly.
 *
 * The act is built around this format because BMP settles the argument by itself: it has
 * an uncompressed mode, a palettised mode, and a run-length mode — and the run-length
 * mode exists *only* for palettised images. There is no 24-bit RLE in BMP, because
 * Microsoft already knew it does not work. The slides do not have to claim that RLE needs
 * a reframe first; the format's own compression field says so.
 *
 * Everything here is real: the 54-byte header, four bytes per palette entry, rows padded
 * to a four-byte boundary, and `BI_RLE8` exactly as the format specifies — runs as (count, index)
 * pairs, with a count of zero escaping to end-of-line, end-of-bitmap, a delta, or a block
 * of literal pixels padded to a word. That escape convention is the shared primer both
 * sides must agree on in advance, shipped in a format everyone has opened by accident.
 *
 * Not implemented: writing an actual file. Rows are handled top-down here, where a real
 * BMP stores them bottom-up; that changes nothing about any size this module reports.
 */

/** BITMAPFILEHEADER (14) + BITMAPINFOHEADER (40). */
export const BMP_HEADER_BYTES = 54

/** Palette entries are RGBQUAD — four bytes, not three. The fourth is unused. */
export const BMP_PALETTE_ENTRY_BYTES = 4

/** BMP's `biCompression` values, as far as this deck cares. */
export type BmpCompression = 'BI_RGB' | 'BI_RLE8' | 'BI_RLE4'

/** Rows are padded to a four-byte boundary — real overhead on awkward widths. */
export function rowStride(width: number, bitsPerPixel: number): number {
  return (((width * bitsPerPixel + 31) / 32) | 0) * 4
}

export function paletteBytes(entries: number): number {
  return entries * BMP_PALETTE_ENTRY_BYTES
}

/** Size of an uncompressed (`BI_RGB`) BMP, header and palette included. */
export function uncompressedSize(
  width: number,
  height: number,
  bitsPerPixel: number,
  paletteEntries = 0,
): number {
  return BMP_HEADER_BYTES + paletteBytes(paletteEntries) + rowStride(width, bitsPerPixel) * height
}

// --- BI_RLE8 ----------------------------------------------------------------

/** Runs shorter than this cost more as a (count, index) pair than as literals. */
const MIN_RUN = 3
const MAX_RUN = 255

/**
 * Encode 8-bit palette indices as a `BI_RLE8` pixel array.
 *
 * Greedy and row-by-row, which is what real encoders do: a run of three or more becomes
 * an encoded pair, anything else is gathered into an absolute (literal) block. Runs never
 * cross a scanline — every row ends with the 00 00 marker.
 */
export function encodeRle8(indices: Uint8Array, width: number, height: number): Uint8Array {
  const out: number[] = []

  for (let row = 0; row < height; row++) {
    const base = row * width
    let x = 0

    while (x < width) {
      let run = 1
      while (x + run < width && indices[base + x + run] === indices[base + x] && run < MAX_RUN) run++

      if (run >= MIN_RUN) {
        out.push(run, indices[base + x])
        x += run
        continue
      }

      // Not a run: gather literals until a real run starts or the row ends.
      let literals = 0
      while (x + literals < width) {
        let ahead = 1
        while (
          x + literals + ahead < width &&
          indices[base + x + literals + ahead] === indices[base + x + literals] &&
          ahead < MAX_RUN
        ) ahead++
        if (ahead >= MIN_RUN) break
        literals += ahead
        if (literals >= MAX_RUN) break
      }
      if (literals > MAX_RUN) literals = MAX_RUN

      if (literals >= MIN_RUN) {
        out.push(0, literals)
        for (let i = 0; i < literals; i++) out.push(indices[base + x + i])
        // Absolute blocks are padded to a 16-bit boundary.
        if (literals % 2) out.push(0)
      } else {
        // One or two stragglers are cheaper as encoded pairs than as an absolute block.
        for (let i = 0; i < literals; i++) out.push(1, indices[base + x + i])
      }
      x += literals
    }

    out.push(0, 0) // end of line
  }

  out.push(0, 1) // end of bitmap
  return Uint8Array.from(out)
}

/**
 * Decode a `BI_RLE8` pixel array. Present so the slides can prove the round trip rather
 * than assert it — the deck claims this transform is invertible, so it is checked.
 */
export function decodeRle8(data: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height)
  let i = 0
  let x = 0
  let y = 0

  while (i + 1 < data.length) {
    const count = data[i++]
    const value = data[i++]

    if (count > 0) {
      for (let k = 0; k < count; k++) {
        if (x < width && y < height) out[y * width + x] = value
        x++
      }
      continue
    }

    if (value === 0) { x = 0; y++; continue }        // end of line
    if (value === 1) break                            // end of bitmap
    if (value === 2) { x += data[i++]; y += data[i++]; continue } // delta

    for (let k = 0; k < value; k++) {
      const v = data[i++]
      if (x < width && y < height) out[y * width + x] = v
      x++
    }
    if (value % 2) i++ // skip the pad byte
  }

  return out
}

export interface BmpVariant {
  label: string
  compression: BmpCompression
  bitsPerPixel: number
  /** Total file size in bytes, header and palette included. */
  bytes: number
  /** Bytes that are not pixel data: header plus palette. */
  overheadBytes: number
  lossy: boolean
  note: string
}

/**
 * The same image as the three BMP variants that matter, priced as whole files.
 *
 * `BI_RLE8` is only offered a palettised image because that is the only thing the format
 * will accept — which is the entire point of the act.
 */
export function describeVariants(
  width: number,
  height: number,
  indices: Uint8Array,
  paletteEntries: number,
  paletteIsLossy: boolean,
): BmpVariant[] {
  const rgbBytes = uncompressedSize(width, height, 24)
  const indexedBytes = uncompressedSize(width, height, 8, paletteEntries)

  const rle = encodeRle8(indices, width, height)
  const rleOverhead = BMP_HEADER_BYTES + paletteBytes(paletteEntries)
  const rleBytes = rleOverhead + rle.length

  return [
    {
      label: '24-bit BI_RGB',
      compression: 'BI_RGB',
      bitsPerPixel: 24,
      bytes: rgbBytes,
      overheadBytes: BMP_HEADER_BYTES,
      lossy: false,
      note: 'three bytes a pixel, no compression field to set',
    },
    {
      label: '8-bit BI_RGB',
      compression: 'BI_RGB',
      bitsPerPixel: 8,
      bytes: indexedBytes,
      overheadBytes: BMP_HEADER_BYTES + paletteBytes(paletteEntries),
      lossy: paletteIsLossy,
      note: `one index a pixel, plus a ${paletteEntries}-entry palette`,
    },
    {
      label: '8-bit BI_RLE8',
      compression: 'BI_RLE8',
      bitsPerPixel: 8,
      // A real encoder falls back rather than shipping a "compressed" file that is
      // bigger — the same bounded-downside move Deflate makes with its stored blocks.
      bytes: Math.min(rleBytes, indexedBytes),
      overheadBytes: rleOverhead,
      lossy: paletteIsLossy,
      note: rleBytes > indexedBytes
        ? 'RLE made it bigger — a real encoder writes BI_RGB instead'
        : 'runs of identical indices collapsed to (count, index)',
    },
  ]
}

/** True when RLE would expand the file, so the encoder should not use it. */
export function rleWouldExpand(
  width: number,
  height: number,
  indices: Uint8Array,
  paletteEntries: number,
): boolean {
  const rle = encodeRle8(indices, width, height).length
  return BMP_HEADER_BYTES + paletteBytes(paletteEntries) + rle >
    uncompressedSize(width, height, 8, paletteEntries)
}
