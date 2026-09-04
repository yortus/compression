import type { YcbcrData } from './types'

export function rgbToYcbcr(r: number, g: number, b: number): [number, number, number] {
  const y  =  0.299 * r + 0.587 * g + 0.114 * b
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128
  const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128
  return [y, cb, cr]
}

export function ycbcrToRgb(y: number, cb: number, cr: number): [number, number, number] {
  const r = y + 1.402 * (cr - 128)
  const g = y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)
  const b = y + 1.772 * (cb - 128)
  return [
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  ]
}

export function imageToYcbcr(imageData: ImageData): YcbcrData {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const y = new Float64Array(pixelCount)
  const cb = new Float64Array(pixelCount)
  const cr = new Float64Array(pixelCount)

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    const [yv, cbv, crv] = rgbToYcbcr(data[off], data[off + 1], data[off + 2])
    y[i] = yv
    cb[i] = cbv
    cr[i] = crv
  }

  return { y, cb, cr, width, height }
}

export function ycbcrToImageData(ycbcr: YcbcrData): ImageData {
  const { y, cb, cr, width, height } = ycbcr
  const imageData = new ImageData(width, height)
  const data = imageData.data
  const pixelCount = width * height

  for (let i = 0; i < pixelCount; i++) {
    const [r, g, b] = ycbcrToRgb(y[i], cb[i], cr[i])
    const off = i * 4
    data[off] = r
    data[off + 1] = g
    data[off + 2] = b
    data[off + 3] = 255
  }

  return imageData
}

export function channelToImageData(channel: Float64Array, width: number, height: number): ImageData {
  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let i = 0; i < width * height; i++) {
    const v = Math.max(0, Math.min(255, Math.round(channel[i])))
    const off = i * 4
    data[off] = v
    data[off + 1] = v
    data[off + 2] = v
    data[off + 3] = 255
  }

  return imageData
}

export type YcbcrChannel = 'y' | 'cb' | 'cr'

/**
 * Render one YCbCr plane for display.
 *
 * Greyscale is the literal reading, and for Y it is the right one — Y *is* brightness.
 * For the chroma planes it is actively misleading: rendered grey, Cb and Cr look like two
 * noisy, interchangeable copies of the picture, when what they actually hold is
 * blue-ness and red-ness. Mapping each one back through the colour transform with the
 * other two channels held neutral shows the axis it really encodes — Cb running
 * yellow-to-blue, Cr running cyan-to-red — and makes it obvious at a glance that Y is
 * carrying the image and the other two are carrying tint.
 */
export function ycbcrPlaneToImageData(
  plane: Float64Array,
  width: number,
  height: number,
  channel: YcbcrChannel,
  coloured = true,
): ImageData {
  if (channel === 'y' || !coloured) return channelToImageData(plane, width, height)

  const imageData = new ImageData(width, height)
  const data = imageData.data
  for (let i = 0; i < width * height; i++) {
    const v = plane[i]
    // Neutral luma, neutral on the other chroma axis: only this plane varies.
    const [r, g, b] = channel === 'cb' ? ycbcrToRgb(128, v, 128) : ycbcrToRgb(128, 128, v)
    const off = i * 4
    data[off] = r
    data[off + 1] = g
    data[off + 2] = b
    data[off + 3] = 255
  }
  return imageData
}
