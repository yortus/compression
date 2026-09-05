/**
 * Greenscale, shared by the two pattern slides in Act 4.
 *
 * Purely cosmetic, and deliberately kept in one file with two constants at the top so the
 * look can be tuned — or dropped — in a single place rather than hunted through two
 * components. Nothing downstream reads these canvases, so changing any of it is safe: the
 * DCT maths never looks at a pixel.
 *
 * The ramp is the deck's own `--positive` green with some of the red and blue taken out,
 * so the slides sit inside the existing palette rather than beside it.
 */

/** Set to null for plain greyscale. */
export const GREEN: readonly [number, number, number] | null = [0.26, 1, 0.48]

/**
 * Contrast about mid-grey, applied before the tint. 1 is untouched; higher deepens the
 * darks and pushes the brights. This is the knob to turn for more punch.
 *
 * Two values, because the two things being drawn have different ranges. Photographs,
 * blocks and coefficient contributions sit in a narrow band around mid-grey and are
 * transformed by a stretch — 1.5 makes them read across a room, and past about 2 the
 * highlights clip out to flat colour.
 */
export const CONTRAST = 1.5

/**
 * Basis patterns are a different case: they already swing the full range, so *any*
 * stretch clips them, and at 1.5 the smooth cosines turn into hard stripes. Since the
 * point of the `basis-2d` slide is that these are two smooth curves multiplied together,
 * they are drawn honestly. Raise it if the patterns look flat on the projector, but
 * expect them to go binary quickly.
 */
export const PATTERN_CONTRAST = 1

/** The one place the stretch and the tint are applied; everything else goes through it. */
function toRgb(value: number, contrast: number): [number, number, number] {
  const v = 128 + (value - 128) * contrast
  return GREEN ? [v * GREEN[0], v * GREEN[1], v * GREEN[2]] : [v, v, v]
}

/**
 * Write one monochrome sample as an RGBA pixel.
 *
 * `data` is a `Uint8ClampedArray`, which rounds and clamps on assignment, so raw floats
 * and out-of-range values from the contrast stretch need no handling here.
 */
export function writeShade(data: Uint8ClampedArray, offset: number, value: number, contrast = CONTRAST) {
  const [r, g, b] = toRgb(value, contrast)
  data[offset] = r
  data[offset + 1] = g
  data[offset + 2] = b
  data[offset + 3] = 255
}

/** The same shade as a CSS colour, for drawing a sample as a rectangle rather than a pixel. */
export function shadeCss(value: number, contrast = CONTRAST): string {
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(255, n)))
  const [r, g, b] = toRgb(value, contrast)
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
}

/**
 * Draw an 8x8 block scaled up, with every cell landing on whole device pixels.
 *
 * `drawImage` cannot do this: scaling 8 source pixels into, say, 170 destination pixels
 * spreads them 21.25 apart, so some cells get 21 and some 22 and hard-edged art comes out
 * banded. Rounding each seam from a running position instead keeps the cells even and
 * still tiles the box exactly.
 *
 * `x`, `y` and `size` are in device pixels, so callers with a scaled context must reset
 * the transform first — half a device pixel of offset is exactly the blur being avoided.
 */
export function fillBlock8(
  ctx: CanvasRenderingContext2D,
  block: number[][],
  x: number,
  y: number,
  size: number,
  contrast = CONTRAST,
) {
  for (let r = 0; r < 8; r++) {
    const y0 = Math.round(y + (r * size) / 8)
    const y1 = Math.round(y + ((r + 1) * size) / 8)
    for (let c = 0; c < 8; c++) {
      const x0 = Math.round(x + (c * size) / 8)
      const x1 = Math.round(x + ((c + 1) * size) / 8)
      ctx.fillStyle = shadeCss(block[r][c], contrast)
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
  }
}

/** Paint an 8x8 block onto an 8x8 canvas. Both slides do this constantly. */
export function paintBlock8(canvas: HTMLCanvasElement, block: number[][], contrast = CONTRAST) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(8, 8)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) writeShade(img.data, (r * 8 + c) * 4, block[r][c], contrast)
  }
  ctx.putImageData(img, 0, 0)
}
