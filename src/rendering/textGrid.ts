import { graphemes } from '../engine/codecs/tokenise'

/**
 * Text laid into a fixed-width character grid, for the slides that show a message on the
 * left and the same message reconstructed on the right.
 *
 * The point of the grid is that both panels run this same function, so a decoded panel can
 * be compared with its source by eye — same wrap, same cells, same glyph positions, and a
 * mismatch shows up as a visible shift rather than as a claim in a caption.
 *
 * Two things here are less obvious than they look.
 *
 * **"Fixed width" only holds within one writing system.** The same monospace stack falls
 * back to a different family for Han and for Devanagari, with different advance widths, so
 * the font size is measured at runtime rather than tabulated. Averaging over the whole text
 * — rather than fitting the widest cluster — keeps the common case at full size and lets
 * the occasional wide conjunct be condensed by `fillText`'s own maxWidth.
 *
 * **The column count is the type size.** A cell is `size / cols` wide and the font is
 * measured to fill it, so asking for more columns is asking for smaller type — under about
 * thirty-four columns in a 486-unit panel it drops below what a projector can carry. A slide
 * with spare height should pass `height` and let the message run to more rows instead.
 *
 * **A cell holds one grapheme cluster, not one code point.** A Devanagari consonant plus
 * its vowel sign is two code points and one visible character; splitting it puts a matra in
 * a box of its own. Tokens are drawn as a single `fillText` across their whole span, which
 * also keeps shaping intact for scripts that have any.
 */

export interface GridCell {
  /** The token's text. */
  text: string
  /** Index into the token array this grid was laid out from. */
  index: number
  row: number
  col: number
  /** Width in cells, i.e. grapheme clusters. */
  span: number
}

export interface TextGrid {
  cells: GridCell[]
  cols: number
  rows: number
  cellW: number
  rowH: number
  fontSize: number
  /** Tokens that still did not fit after the shrink retries. Normally zero. */
  dropped: number
}

export interface GridOptions {
  /** Width of the panel, in stage units — and its height too, unless `height` says otherwise. */
  size: number
  /**
   * Height of the panel, when it is not square.
   *
   * Width sets the type size (it is `size / cols` wide per cell); height only decides how
   * many rows there is room for. A slide with spare vertical space should spend it here
   * rather than on a bigger `cols`, because more rows let the same message be set larger.
   */
  height?: number
  cols: number
  /** Line height as a multiple of the font size; scripts with marks need more. */
  lineFactor: number
  /**
   * Force a size instead of fitting one.
   *
   * Panels that show the same message in two forms must share a size, or the shorter form
   * is scaled up to fill its panel and the compression stops being visible — which is the
   * one thing those panels exist to show. Pass the source grid's `fontSize` here.
   */
  fontSize?: number
}

/** Off-screen context used only for `measureText`. */
const measure = document.createElement('canvas').getContext('2d')!

export function gridFont(size: number) {
  return `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono", monospace`
}

function fitFont(tokens: readonly string[], spans: readonly number[], cellW: number): number {
  const REF = 100
  measure.font = gridFont(REF)
  let width = 0
  let cells = 0
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '\n') { cells += 1; continue }
    width += measure.measureText(tokens[i]).width
    cells += spans[i]
  }
  if (!width || !cells) return 16
  return Math.max(9, Math.min(cellW * 2, (cellW * REF * 0.98) / (width / cells)))
}

function place(tokens: readonly string[], spans: readonly number[], cols: number, rows: number) {
  const cells: GridCell[] = []
  let row = 0
  let col = 0
  let overflow = false
  for (let i = 0; i < tokens.length; i++) {
    const text = tokens[i]
    if (row >= rows) { overflow = true; break }
    if (text === '\n') {
      cells.push({ text, index: i, row, col, span: 1 })
      row++
      col = 0
      continue
    }
    const span = spans[i]
    if (col > 0 && col + span > cols) {
      row++
      col = 0
      // A space that falls off the end of a line is swallowed by the wrap, as in any text
      // layout. Every panel runs this function, so they stay identical regardless.
      if (/^\s+$/.test(text)) continue
      if (row >= rows) { overflow = true; break }
    }
    cells.push({ text, index: i, row, col, span })
    col += span
  }
  return { cells, overflow }
}

/**
 * Lay tokens out, shrinking the font until the whole message fits.
 *
 * The retry matters: the font stack resolves to a different family on every operating
 * system — Consolas is a tenth narrower than most — and a text that fitted on the author's
 * machine but lost its last line on the projector is the sort of bug nobody finds until
 * they are standing in front of a room.
 */
export function layoutTextGrid(tokens: readonly string[], opts: GridOptions): TextGrid {
  const spans = tokens.map(t => (t === '\n' ? 1 : graphemes(t).length))
  const cellW = opts.size / opts.cols

  const height = opts.height ?? opts.size
  let fontSize = opts.fontSize ?? fitFont(tokens, spans, cellW)
  let rowH = fontSize * opts.lineFactor
  let rows = Math.max(1, Math.floor(height / rowH))
  let laid = place(tokens, spans, opts.cols, rows)
  // A forced size is forced: shrinking it would defeat the point of sharing one.
  for (let attempt = 0; attempt < (opts.fontSize ? 0 : 8) && laid.overflow; attempt++) {
    fontSize *= 0.92
    rowH = fontSize * opts.lineFactor
    rows = Math.max(1, Math.floor(height / rowH))
    laid = place(tokens, spans, opts.cols, rows)
  }

  return {
    cells: laid.cells,
    cols: opts.cols,
    rows,
    cellW,
    rowH,
    fontSize,
    dropped: tokens.length - laid.cells.length,
  }
}

/** Centre of a cell in stage coordinates, given the grid's top-left corner. */
export function cellCentre(grid: TextGrid, cell: GridCell, gx: number, gy: number) {
  return {
    x: gx + (cell.col + cell.span / 2) * grid.cellW,
    y: gy + (cell.row + 0.5) * grid.rowH,
  }
}

export interface DrawGridOptions {
  /** Per-cell opacity for the glyph. */
  textAlpha: (i: number) => number
  /** Per-cell opacity for the highlight box behind it. Omit for no boxes. */
  boxAlpha?: (i: number) => number
  /** Fill for the highlight box. Return null for no box on that cell. */
  boxColour?: (i: number) => string | null
  /** How strongly the box tints. */
  boxOpacity?: number
  text: string
  /** Used for the newline marker, which is furniture rather than content. */
  dim: string
}

export function drawTextGrid(
  ctx: CanvasRenderingContext2D,
  grid: TextGrid,
  gx: number,
  gy: number,
  opts: DrawGridOptions,
) {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = gridFont(grid.fontSize)
  const boxOpacity = opts.boxOpacity ?? 0.42

  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i]
    const ta = opts.textAlpha(i)
    const ba = opts.boxAlpha?.(i) ?? 0
    if (ta <= 0.01 && ba <= 0.01) continue
    const x = gx + cell.col * grid.cellW
    const y = gy + cell.row * grid.rowH
    const w = Math.max(2, cell.span * grid.cellW)

    if (ba > 0.01) {
      const colour = opts.boxColour?.(i) ?? null
      if (colour) {
        ctx.globalAlpha = ba * boxOpacity
        ctx.fillStyle = colour
        roundRect(ctx, x + 0.5, y + 1.5, w - 1, grid.rowH - 3, 3)
        ctx.fill()
      }
    }
    if (ta > 0.01) {
      ctx.globalAlpha = ta
      // Glyphs stay in the body colour whatever the box does: colouring the words as well
      // as their boxes made the paragraph unreadable from the back of a room.
      ctx.fillStyle = cell.text === '\n' ? opts.dim : opts.text
      ctx.fillText(cell.text === '\n' ? '↵' : cell.text, x + 1, y + grid.rowH / 2, w - 2)
    }
  }
  ctx.globalAlpha = 1
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
