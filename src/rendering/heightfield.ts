/**
 * A grid of heights drawn as a faceted surface, in plain 2-D canvas.
 *
 * The 2-D counterpart of the line graph on `waves-intro`: where that plots one value
 * against position, this lifts each value of an N×N grid into a third axis and draws the
 * surface it makes. Fixed isometric projection, painter's algorithm back-to-front, and
 * every facet flat-shaded against one light — so the form reads as relief rather than as a
 * heat-map, and it stays honest to the eight-by-eight blockiness rather than smoothing it.
 *
 * No WebGL: sixty-odd quads is nothing, and the rest of the deck is 2-D canvas.
 */

export interface HeightfieldOpts {
  /** Screen position of grid point (0,0) at height 0. */
  cx: number
  cy: number
  /** Isometric step per grid unit: horizontal, and vertical (defaults to ax/2). */
  ax: number
  ay?: number
  /** Screen pixels per unit of height (values are 0..1). */
  hz: number
  /** Base hue, hex. Facets are this colour scaled by their shade. */
  colour: string
  /** How pronounced the shading is — larger tilts facets more per unit height. */
  slope?: number
  ambient?: number
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Draw `grid` (values 0..1) as a shaded surface. */
export function drawHeightfield(ctx: CanvasRenderingContext2D, grid: readonly number[][], opts: HeightfieldOpts) {
  const n = grid.length
  const { cx, cy, ax, hz, colour } = opts
  const ay = opts.ay ?? ax * 0.5
  const slope = opts.slope ?? 1.6
  const ambient = opts.ambient ?? 0.35
  const [br, bg, bb] = hexToRgb(colour)

  const px = (i: number, j: number) => cx + (j - i) * ax
  const py = (i: number, j: number, h: number) => cy + (i + j) * ay - h * hz

  // Light from the upper-left-front, above the surface (z is up).
  const L = [-0.5, -0.55, 0.67]
  const Ln = Math.hypot(L[0], L[1], L[2])

  // Faint footprint at height 0, to ground the relief.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(px(0, 0), py(0, 0, 0))
  ctx.lineTo(px(0, n - 1), py(0, n - 1, 0))
  ctx.lineTo(px(n - 1, n - 1), py(n - 1, n - 1, 0))
  ctx.lineTo(px(n - 1, 0), py(n - 1, 0, 0))
  ctx.closePath()
  ctx.stroke()

  // Facets back-to-front: smaller (i+j) is further away, drawn first.
  const facets: [number, number][] = []
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) facets.push([i, j])
  facets.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))

  for (const [i, j] of facets) {
    const h00 = grid[i][j], h01 = grid[i][j + 1], h11 = grid[i + 1][j + 1], h10 = grid[i + 1][j]

    // Flat-shade from the facet's slope: normal ≈ (-dz/dx, -dz/dy, 1).
    const dzdx = ((h01 - h00) + (h11 - h10)) * 0.5
    const dzdy = ((h10 - h00) + (h11 - h01)) * 0.5
    const nx = -dzdx * slope, ny = -dzdy * slope, nz = 1
    const nn = Math.hypot(nx, ny, nz)
    const dot = (nx * L[0] + ny * L[1] + nz * L[2]) / (nn * Ln)
    const shade = ambient + (1 - ambient) * Math.max(0, dot)

    ctx.fillStyle = `rgb(${Math.round(br * shade)},${Math.round(bg * shade)},${Math.round(bb * shade)})`
    ctx.beginPath()
    ctx.moveTo(px(i, j), py(i, j, h00))
    ctx.lineTo(px(i, j + 1), py(i, j + 1, h01))
    ctx.lineTo(px(i + 1, j + 1), py(i + 1, j + 1, h11))
    ctx.lineTo(px(i + 1, j), py(i + 1, j, h10))
    ctx.closePath()
    ctx.fill()
    // A hairline seam keeps the facets legible where two of them are nearly coplanar.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}
