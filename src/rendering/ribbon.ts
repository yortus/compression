/**
 * A wrapped stream of small glyphs — bits, hex bytes — coloured by which symbol produced
 * them, revealed a fraction at a time.
 *
 * This is the middle panel of the entropy and run-length slides: the thing the message
 * *became*. Colouring each glyph by its source symbol is what makes it legible as
 * structure rather than as a wall of characters — variable-length Huffman codes show up as
 * a ragged rainbow, and a run of identical bytes shows up as a solid band before anything
 * has been encoded at all.
 *
 * Two implementation notes worth keeping:
 *
 * **Runs are batched.** Drawing a thousand glyphs one `fillText` at a time is a few
 * milliseconds per frame for nothing; consecutive same-colour glyphs on the same row go out
 * as a single call, which is a four-fold reduction on typical data.
 *
 * **Overflow is reported, never hidden.** A ribbon that does not fit is truncated and
 * `hidden` says by how much, so the slide can print "+N more" rather than implying the
 * whole stream is on screen. The numbers a slide publishes are always computed over the
 * full stream, never over the visible part.
 */

export interface RibbonGlyph {
  ch: string
  colour: string
}

export interface Ribbon {
  /** Only what fits; `hidden` counts the rest. */
  glyphs: RibbonGlyph[]
  cols: number
  rows: number
  adv: number
  rowH: number
  fontSize: number
  total: number
  hidden: number
}

export interface RibbonOptions {
  width: number
  height: number
  fontSize: number
  /**
   * Round the column count down to a multiple of this.
   *
   * A hex dump is read in groups — two characters to a byte, a wider gap every eight — and
   * a row holding two and a half groups is unreadable. Pass the glyph width of one group
   * and every row breaks in the same place.
   */
  alignTo?: number
  /**
   * Choose the font size so exactly this many columns fill the width, instead of taking
   * the size as given. The size still does not depend on how much content there is — it
   * depends on how many columns a row should hold — so two streams of different lengths
   * are still drawn at the same scale and remain comparable.
   */
  fitCols?: number
}

const measure = document.createElement('canvas').getContext('2d')!

export function ribbonFont(size: number) {
  return `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
}

export function layoutRibbon(glyphs: readonly RibbonGlyph[], opts: RibbonOptions): Ribbon {
  let fontSize = opts.fontSize
  if (opts.fitCols && opts.fitCols > 0) {
    const REF = 100
    measure.font = ribbonFont(REF)
    fontSize = (opts.width / opts.fitCols) * (REF / measure.measureText('0').width)
  }
  measure.font = ribbonFont(fontSize)
  const adv = measure.measureText('0').width
  let cols = opts.fitCols ?? Math.max(4, Math.floor(opts.width / adv))
  if (!opts.fitCols && opts.alignTo && opts.alignTo > 0) {
    cols = Math.max(opts.alignTo, Math.floor(cols / opts.alignTo) * opts.alignTo)
  }
  const rowH = fontSize * 1.15
  const rows = Math.max(1, Math.floor(opts.height / rowH))
  const cap = cols * rows
  return {
    glyphs: glyphs.length > cap ? glyphs.slice(0, cap) : [...glyphs],
    cols,
    rows,
    // The font's own advance, *not* the width divided by the columns. Stretching it to
    // fill the pane put the grid and the glyphs on different pitches: `drawRibbon` batches
    // same-colour runs into one `fillText`, which lays them out at the font's advance, so
    // every run drifted out of its slot and the characters visibly bunched and collided.
    adv,
    rowH,
    fontSize,
    total: glyphs.length,
    hidden: Math.max(0, glyphs.length - cap),
  }
}

/** Where a glyph sits, in stage coordinates, given the ribbon's top-left corner. */
export function ribbonPos(ribbon: Ribbon, index: number, rx: number, ry: number) {
  const i = Math.max(0, Math.min(index, ribbon.glyphs.length - 1))
  return {
    x: rx + (i % ribbon.cols + 0.5) * ribbon.adv,
    y: ry + (Math.floor(i / ribbon.cols) + 0.5) * ribbon.rowH,
  }
}

/** `reveal` is 0 to 1 across the visible glyphs. */
export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  ribbon: Ribbon,
  rx: number,
  ry: number,
  reveal = 1,
) {
  const shown = Math.floor(Math.max(0, Math.min(1, reveal)) * ribbon.glyphs.length)
  if (shown <= 0) return
  ctx.font = ribbonFont(ribbon.fontSize)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  let i = 0
  while (i < shown) {
    const row = Math.floor(i / ribbon.cols)
    const col = i % ribbon.cols
    const colour = ribbon.glyphs[i].colour
    let run = ''
    let j = i
    while (j < shown && Math.floor(j / ribbon.cols) === row && ribbon.glyphs[j].colour === colour) {
      run += ribbon.glyphs[j].ch
      j++
    }
    ctx.fillStyle = colour
    ctx.fillText(run, rx + col * ribbon.adv, ry + (row + 0.5) * ribbon.rowH)
    i = j
  }
}
