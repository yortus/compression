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
