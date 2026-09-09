/**
 * Loading images at the one size the whole deck agrees on.
 *
 * The 512px cap is what keeps the synchronous pipeline fast enough to feel interactive,
 * so everything that turns a file into pixels goes through here rather than rolling its
 * own — otherwise the benchmark slide would quietly measure a different image from the
 * one on screen.
 */

export const MAX_DIMENSION = 512

export async function blobToImageData(blob: Blob, max = MAX_DIMENSION): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

export async function loadImageData(url: string, max = MAX_DIMENSION): Promise<ImageData> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`could not load ${url}: ${response.status}`)
  return blobToImageData(await response.blob(), max)
}

/**
 * The sample set is part of the argument, not decoration: each image is here because it
 * breaks or flatters a different technique, which is what makes the brittleness slide
 * possible. `note` says what each one is for.
 */
// public/ assets must respect Vite's base so they resolve on a sub-path Pages deploy.
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const SAMPLES = [
  // Three rows of five in the picker, grouped by what kind of thing they are.
  // Row 1 — photographs and continuous tone.
  { name: 'Photo', url: asset('samples/photo.jpg'), note: 'natural detail and sensor noise' },
  { name: 'Parrot', url: asset('samples/parrot.png'), note: 'saturated colour, fine feathers, smooth bokeh' },
  { name: 'Forest', url: asset('samples/forest.png'), note: 'dense twigs over flat snow, nearly monochrome' },
  { name: 'Gradient', url: asset('samples/gradient.png'), note: 'smooth everywhere, no repeats' },
  { name: 'Dither', url: asset('samples/dither.png'), note: 'looks continuous, repeats nothing — compare with Gradient' },
  // Row 2 — flat-colour graphics.
  { name: 'Graphic', url: asset('samples/graphic.png'), note: 'flat colour and hard edges' },
  { name: 'Flat', url: asset('samples/flat.png'), note: 'solid blocks — the case RLE was invented for' },
  { name: 'Pixel art', url: asset('samples/pixelart.png'), note: 'sprites packed onto the 8×8 block grid — the only sample under 512px' },
  { name: 'Line art', url: asset('samples/lineart.png'), note: 'two colours, long runs, palettises exactly' },
  { name: 'Mosaic', url: asset('samples/mosaic.png'), note: 'exact repetition, few colours' },
  // Row 3 — structure and stress tests.
  { name: 'Text', url: asset('samples/text.png'), note: 'fine edges — JPEG rings badly' },
  { name: 'Checker', url: asset('samples/checker.png'), note: 'the highest frequency an 8×8 block can hold' },
  { name: 'Sweep', url: asset('samples/sweep.png'), note: 'every frequency once — watch quantisation eat it' },
  { name: 'Noise', url: asset('samples/noise.png'), note: 'no redundancy at all — nothing helps' },
] as const

export type Sample = (typeof SAMPLES)[number]
