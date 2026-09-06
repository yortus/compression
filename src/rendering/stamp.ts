/**
 * Rubber-stamp verdicts: the one or two words a slide most wants read from the back of a
 * room, struck across the panel that earned them.
 *
 * Two things use this and they are meant to look like a matched pair — the ratio a slide
 * achieved, and whether it was lossless. Both are conclusions rather than labels, so both
 * get the same treatment: heavy letterspaced caps, a double border, a hard tilt, and an
 * opaque black interior that punches through whatever it lands on. Obscuring a corner of
 * the output is the point; a stamp that politely avoided the artwork would read as a
 * caption again.
 *
 * They arrive at the end of their animation, never before. The verdict is the payoff of
 * watching the output panel fill, and a stamp already sitting there gives the answer away
 * and turns back into chrome. Callers pass `alpha` from their own progress so it fades in
 * with the last of it.
 *
 * Any lossy/lossless flag passed here must be *measured* — a decode compared against the
 * original, or a pixel diff — never a constant. Two slides once hardcoded `lossy: true`
 * for JPEG, which is true of the format but not of every block it is handed.
 */

/** Every stamp in the deck leans the same way, or they read as a mistake rather than a set. */
const ANGLE = -7 * (Math.PI / 180)

export interface StampOptions {
  size?: number
  alpha?: number
}

function stampFont(size: number) {
  return `800 ${size}px Inter, system-ui, sans-serif`
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + tracking
  return w - tracking
}

/**
 * Unrotated box size, so a caller can place a stamp against a corner rather than guessing.
 * Clobbers `ctx.font`, which every caller sets before drawing anyway.
 */
export function stampSize(ctx: CanvasRenderingContext2D, text: string, size = 40) {
  ctx.font = stampFont(size)
  return {
    w: trackedWidth(ctx, text, size * 0.08) + size * 1.15,
    h: size * 1.72,
  }
}

const COS = Math.cos(ANGLE)
const SIN = Math.abs(Math.sin(ANGLE))

/**
 * Size of the *rotated* footprint, which is what a caller placing a stamp against a corner
 * actually needs — the tilt adds a noticeable amount to both axes, and using the unrotated
 * box instead is how a stamp ends up hanging off the edge of the stage.
 */
export function stampBounds(ctx: CanvasRenderingContext2D, text: string, size = 40) {
  const { w, h } = stampSize(ctx, text, size)
  return { w: w * COS + h * SIN, h: w * SIN + h * COS }
}

export function drawStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  colour: string,
  { size = 40, alpha = 1 }: StampOptions = {},
) {
  if (alpha <= 0.01) return
  const tracking = size * 0.08
  const { w, h } = stampSize(ctx, text, size)
  const r = size * 0.34
  const inset = size * 0.13

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(ANGLE)

  // Opaque, not tinted: the stamp has to survive landing on text or on artwork.
  ctx.fillStyle = '#000'
  roundRect(ctx, -w / 2, -h / 2, w, h, r)
  ctx.fill()

  ctx.strokeStyle = colour
  ctx.lineWidth = size * 0.1
  ctx.stroke()

  // The thin second rule is what makes it read as a stamp rather than as a button.
  ctx.lineWidth = size * 0.035
  roundRect(ctx, -w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, r - inset * 0.6)
  ctx.stroke()

  // Drawn glyph by glyph: `ctx.letterSpacing` is too new to rely on, and tracking is most
  // of what separates stamped lettering from ordinary bold text.
  ctx.fillStyle = colour
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let x = -trackedWidth(ctx, text, tracking) / 2
  for (const ch of text) {
    ctx.fillText(ch, x, size * 0.04)
    x += ctx.measureText(ch).width + tracking
  }

  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
