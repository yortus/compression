<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { usePhaseStage } from '../../deck/usePhaseStage'
import { useStat } from '../../stats/useStats'
import {
  SPRITES, REPRESENTATIONS, SPRITE_SIZE,
  spriteById, spritePixels, spriteBytes, sourceRgb, decodedRgb,
  type Representation, type SpritePixels,
} from '../../content/sprites'
import { runSpans, spansToBytes, decodePairs, type RunSpan } from '../../engine/codecs/rle'
import { layoutRibbon, drawRibbon, ribbonFont, type Ribbon, type RibbonGlyph } from '../../rendering/ribbon'
import { tokenColour } from '../../rendering/tokenColours'
import { drawStamp, stampBounds, ratioVerdict } from '../../rendering/stamp'

/**
 * Run-length encoding, in the abstract, on artwork the slide owns.
 *
 * The encoder never changes. What changes is what the bytes *mean* — and that alone moves
 * the ratio from better than ten-to-one to worse than useless. It is the deck's central
 * thesis reduced to a single toggle, and the reason this replaced four slides.
 *
 * **Why 16×16 sprites and not a photograph.** 256 pixels is a byte stream that fits on
 * screen in full, so every number here can be counted by eye against the hex dump beside
 * it. A 512px sample image meant showing the first few hundred of 786,432 bytes and asking
 * the audience to take the rest on trust. It also frees the slide from the global image
 * picker, so the artwork can be chosen to span the outcome space instead of hoping a photo
 * happens to make the point — hence a gradient, which defeats run-length coding *and*
 * overflows the palette, so it is the one sprite that makes palettising visibly lossy.
 *
 * **Both ribbons are laid out at the same font size and column count.** The encoded stream
 * is drawn in the same place as the source stream, so the crossfade in the third phase
 * shows it occupying visibly fewer rows — or, on the gradient in RGBA, visibly more. That
 * comparison is exact rather than asserted, which is the only reason to spend a whole
 * panel on it.
 *
 * **The encoded ribbon is real bytes.** `spansToBytes` emits count, value, count, value —
 * what the encoder would actually write — rather than a prettified `12×2A` notation. So the
 * two ribbons are directly comparable: same units, same glyphs, one is longer.
 */

// --- Stage geometry -------------------------------------------------------------

const STAGE_W = 1600
const STAGE_H = 816
const MARGIN = 16
const GAP = 22

const PANEL = 420
const PANEL_Y = 14
const LEFT_X = MARGIN
const RIGHT_X = STAGE_W - MARGIN - PANEL
const CELL = PANEL / SPRITE_SIZE

/** The sprite picker, on the canvas directly under the artwork it picks. */
const THUMB_Y = PANEL_Y + PANEL + 14
const THUMB_H = 64
const THUMB_GAP = 12
const THUMB_W = (PANEL - THUMB_GAP * (SPRITES.length - 1)) / SPRITES.length

const CENTRE_X = LEFT_X + PANEL + GAP
const CENTRE_W = RIGHT_X - GAP - CENTRE_X
const CENTRE_Y = PANEL_Y
const CENTRE_H = 580

const RIBBON_X = CENTRE_X + 18
const RIBBON_Y = CENTRE_Y + 18
const RIBBON_W = CENTRE_W - 36
// Fills the panel down to a strip for the truncation note. More rows means more bytes on
// screen and fewer truncated; the badge is allowed to overlay the lower rows.
const RIBBON_H = 524

/** Same band as the other exploration slides: what the decoder must be sent in advance. */
const PRIMER_Y = CENTRE_Y + CENTRE_H + 24
const PRIMER_H = STAGE_H - PRIMER_Y - 14
/** Two hex digits and a single space, per byte. */
const GLYPHS_PER_BYTE = 3
/**
 * Sixteen evenly spaced bytes to a line, and the type sized so exactly those fill the pane.
 *
 * The size comes from the *row width*, never from the content: a 256-byte stream and a
 * 1024-byte one are drawn at the same scale, so the difference in how many rows they take
 * is the comparison. Fitting to content instead drew the short one twice as large and
 * destroyed it.
 */
const BYTES_PER_ROW = 16
const RIBBON_COLS = BYTES_PER_ROW * GLYPHS_PER_BYTE

const STAGES = ['pixels', 'bytes', 'encoded', 'decoded'] as const
const STAGE_NAMES = ['Pixels', 'Bytes', 'Encoded', 'Decoded'] as const

// --- Model ------------------------------------------------------------------------

interface Model {
  pixels: SpritePixels
  bytes: Uint8Array
  spans: RunSpan[]
  encoded: Uint8Array
  /** Three bytes per pixel, for drawing the two panels and comparing them. */
  sourcePixels: Uint8Array
  decodedPixels: Uint8Array
  roundTrips: boolean
  rawBits: number
  encodedBits: number
  overheadBits: number
  /** The bytes, tinted by run, written out as the scan reaches each pixel. */
  source: Ribbon
  packed: Ribbon
  /** Bytes per pixel, so the scan cursor can point at the pixel a byte belongs to. */
  perPixel: number
  /** Colour per byte of the source stream, by which run it belongs to. */
  runOf: Int32Array
  /** Run index per *glyph* of the source ribbon, so a run can be drawn as one piece. */
  runOfGlyph: Int32Array
  colours: string[]
  pairs: Pair[]
  /**
   * Longest run that is actually on screen.
   *
   * The fold runs at a constant pace per byte, so the beat lasts as long as the longest run
   * takes. Measuring that over *all* runs would let one 200-byte run off the bottom of the
   * pane stretch the beat while everything visible finished in the first few percent.
   */
  maxVisibleRun: number
  /**
   * Bytes once every run has been given a count byte and before any folding: the high-water
   * mark of the animation, and the number the truncation note quotes during those beats.
   */
  expandedTotal: number
  /** Whole bytes the pane can show. */
  capacity: number
}

/**
 * One run, mid-fold: where its bytes are now and where its `(count, value)` pair is going.
 *
 * Both positions are glyph indices rather than coordinates, because the two ribbons share a
 * column count and a font — so the same arithmetic places a pair in either of them, and the
 * end of the fold lands exactly where the packed ribbon would have drawn it.
 */
interface Pair {
  run: number
  count: number
  /** Glyph index of the run's first byte in the source ribbon. */
  from: number
  /** Glyph index of the pair's count byte in the packed ribbon. */
  to: number
  text: string
  colour: string
  fromVisible: boolean
  toVisible: boolean
  /**
   * Where this run sits down the visible dump, 0 to 1 — what the sweep is staggered by.
   *
   * Not the run index: on a stream of 900 mostly-length-one runs only the first 240 bytes
   * are on screen, so staggering by index finished everything visible in the first quarter
   * of the animation and then played to an empty pane for the rest.
   */
  pos: number
}

function glyphOfByte(b: number) {
  return b * GLYPHS_PER_BYTE
}

const HEX = '0123456789ABCDEF'
function hex(byte: number) {
  return HEX[(byte >> 4) & 15] + HEX[byte & 15]
}

const spriteId = ref(SPRITES[0].id)
const repId = ref<Representation>('rgba')
/** Thumbnails are redrawn every frame, so their pixels are built once. */
const thumbPixels = SPRITES.map(sprite => sourceRgb(spritePixels(sprite)))
const sprite = computed(() => spriteById(spriteId.value))
const rep = computed(() => REPRESENTATIONS.find(r => r.id === repId.value) ?? REPRESENTATIONS[0])
const model = shallowRef<Model | null>(null)

let colours = {
  bg: '#14141f', panel: '#0a0a0f', border: '#2a2a3a',
  text: '#e0e0e8', dim: '#8888a0', accent: '#6c8cff', good: '#4ade80', warn: '#fbbf24',
}

function readColours() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  colours = {
    bg: v('--bg-surface', '#14141f'),
    panel: v('--bg', '#0a0a0f'),
    border: v('--border', '#2a2a3a'),
    text: v('--text', '#e0e0e8'),
    dim: v('--text-secondary', '#8888a0'),
    accent: v('--accent', '#6c8cff'),
    good: v('--positive', '#4ade80'),
    warn: v('--warning', '#fbbf24'),
  }
}

/** Bytes as a hex dump: `1F 00 03 01 …`, sixteen to a row. */
function glyphsFor(bytes: Uint8Array, colourAt: (i: number) => string): RibbonGlyph[] {
  const out: RibbonGlyph[] = []
  for (let i = 0; i < bytes.length; i++) {
    const c = colourAt(i)
    const h = hex(bytes[i])
    out.push({ ch: h[0], colour: c }, { ch: h[1], colour: c }, { ch: ' ', colour: c })
  }
  return out
}

function buildModel(): Model | null {
  const pixels = spritePixels(sprite.value)
  const bytes = spriteBytes(pixels, repId.value)
  const spans = runSpans(bytes)
  const encoded = spansToBytes(spans)

  // Decoded rather than asserted, and compared as *pixels* rather than as bytes: the
  // question the stamp answers is whether the audience gets their picture back. That is
  // what catches the palette row on the gradient, whose bytes round-trip perfectly and
  // whose picture does not: the colours were reduced before the encoder ever saw them.
  const back = Uint8Array.from(decodePairs(spans.map(s => ({ count: s.length, value: s.value }))))
  const sourcePixels = sourceRgb(pixels)
  const decodedPixels = decodedRgb(back, repId.value, pixels)
  let roundTrips = true
  for (let i = 0; roundTrips && i < sourcePixels.length; i++) {
    roundTrips = sourcePixels[i] === decodedPixels[i]
  }

  // Which run each byte belongs to, so the ribbon can tint by run rather than by value —
  // a run of one gets no colour, which is what makes "there are no runs here" visible.
  const runOf = new Int32Array(bytes.length)
  for (let r = 0; r < spans.length; r++) {
    for (let k = 0; k < spans[r].length; k++) runOf[spans[r].start + k] = r
  }
  const runColours = spans.map((s, r) => tokenColour(r, s.length, colours.dim))

  // Both ribbons share one size and column count, so the change in how many rows each
  // occupies is a like-for-like comparison rather than an artefact of scaling.
  const opts = { width: RIBBON_W, height: RIBBON_H, fontSize: 20, fitCols: RIBBON_COLS }

  const source = layoutRibbon(glyphsFor(bytes, i => runColours[runOf[i]]), opts)
  // A pair is tinted by the run it came from, so a band in the source and its two bytes in
  // the encoded stream are the same colour.
  const packed = layoutRibbon(glyphsFor(encoded, i => runColours[i >> 1]), opts)

  // Which run owns each glyph of the source, so the fold can dim a whole run at once.
  const runOfGlyph = new Int32Array(source.glyphs.length).fill(-1)
  for (let b = 0; b < bytes.length; b++) {
    const g = glyphOfByte(b)
    for (let k = 0; k < GLYPHS_PER_BYTE; k++) {
      if (g + k < runOfGlyph.length) runOfGlyph[g + k] = runOf[b]
    }
  }

  // A pair is two bytes, so always six contiguous glyphs — one string to draw.
  const visibleGlyphs = Math.max(1, source.glyphs.length)
  let maxVisibleRun = 2
  const pairs: Pair[] = spans.map((span, r) => {
    const from = glyphOfByte(span.start)
    const to = glyphOfByte(r * 2)
    return {
      run: r,
      count: span.length,
      from,
      to,
      text: `${hex(span.length)} ${hex(span.value)}`,
      colour: runColours[r],
      fromVisible: from < source.glyphs.length,
      toVisible: to + 5 <= packed.glyphs.length,
      pos: Math.min(1, from / visibleGlyphs),
    }
  })
  for (const pair of pairs) {
    if (pair.fromVisible && pair.count > maxVisibleRun) maxVisibleRun = pair.count
  }

  // The palette is the primer: indices mean nothing without it. Only the indexed
  // representation needs one — the others carry their colours in the bytes.
  const overheadBits = repId.value === 'palette' ? pixels.palette.length * 3 * 8 : 0

  return {
    pixels, bytes, spans, encoded, sourcePixels, decodedPixels, roundTrips,
    pairs, runOfGlyph, maxVisibleRun,
    expandedTotal: bytes.length + spans.length,
    capacity: Math.floor(source.glyphs.length / GLYPHS_PER_BYTE),
    perPixel: bytes.length / (SPRITE_SIZE * SPRITE_SIZE),
    rawBits: bytes.length * 8,
    encodedBits: encoded.length * 8,
    overheadBits,
    source, packed, runOf, colours: runColours,
  }
}

/**
 * The stream, before and after coding. The palette is a fixed cost that does not scale with
 * the picture, so it is kept out of the badge and stated where it is drawn — the band at the
 * bottom gives it in entries and bytes, and `useStat` carries it as `overheadBits`.
 */
const ratio = computed(() => {
  const m = model.value
  return m && m.encodedBits > 0 ? m.rawBits / m.encodedBits : 1
})

useStat('rle-bitmap', () => {
  const m = model.value
  if (!m) return null
  const ones = m.spans.filter(s => s.length === 1).length
  return {
    label: `RLE · ${sprite.value.label} as ${rep.value.label.toLowerCase()}`,
    rawBits: m.rawBits,
    encodedBits: m.encodedBits,
    overheadBits: m.overheadBits,
    lossy: !m.roundTrips,
    note: `${m.bytes.length} bytes · ${m.spans.length} runs · ${ones} of them length 1`,
  }
})

// --- Animation ---------------------------------------------------------------------

/**
 * Encoding, in five beats — and it gets *worse* before it gets better.
 *
 * `insert` — a bold `01` count byte is pushed in front of every run, every run, including
 *            the ones only one byte long. The stream reflows to make room and the dump
 *            visibly grows. This is naive run-length coding in its honest first form: a
 *            count for everything, whether it earns one or not.
 * `boxes`  — a tinted rectangle fades in behind each run of two or more, all at once: the
 *            ones that are about to pay for their count byte.
 * `fold`   — each run eats its own bytes right to left, the count ticking up with every one
 *            and the box shrinking after it. The pace is per byte, so long runs take longer
 *            and the dump finishes ragged rather than in lockstep.
 * `compact`— the surviving pairs slide left into the gaps the folds left behind.
 * `boxOut` — the tint fades, leaving the encoded bytes.
 *
 * Leading with the expansion is what makes the rest mean anything. A run of one has to
 * carry a count byte it can never earn back, and on a representation full of them the
 * stream never recovers — which is the whole reason the 32-bit RGBA row ends up bigger
 * than it started.
 */
const anim = { scan: 0, insert: 0, boxes: 0, fold: 0, compact: 0, boxOut: 0, decode: 0, badge: 0 }

const SCAN_DUR = 1.6
const INSERT_DUR = 0.8
const BOXES_DUR = 0.4
const COMPACT_DUR = 0.8
const BOXOUT_DUR = 0.35
const DEC_DUR = 1.4

/**
 * The fold is paced per byte, so its *duration* has to depend on the longest run.
 *
 * Dividing a fixed beat by the longest visible run looks right until a representation has
 * no long runs: on 32-bit RGBA the longest run on screen is two bytes, so a single step
 * stretched across the whole beat and every short run crawled. Fixing the seconds per byte
 * instead keeps the pace identical everywhere — the beat is simply shorter when there is
 * less to fold.
 */
const FOLD_STEP = 0.085
/** Floors and ceilings on the beat, not on the pace: a one-step fold still wants a beat. */
const FOLD_MIN = 0.25
const FOLD_MAX = 1.6

function foldDuration(m: Model) {
  return Math.min(FOLD_MAX, Math.max(FOLD_MIN, (m.maxVisibleRun - 1) * FOLD_STEP))
}

function build() {
  const m = model.value
  if (!m) return null
  anim.scan = 0; anim.decode = 0; anim.badge = 0
  anim.insert = 0; anim.boxes = 0; anim.fold = 0; anim.compact = 0; anim.boxOut = 0

  const tl = gsap.timeline({ paused: true })
  tl.addLabel('pixels', 0)
  tl.fromTo(anim, { scan: 0 }, { scan: 1, duration: SCAN_DUR, ease: 'none' }, 0.1)
  const runsAt = 0.1 + SCAN_DUR + 0.15
  tl.addLabel('bytes', runsAt)

  let at = runsAt + 0.2
  tl.fromTo(anim, { insert: 0 }, { insert: 1, duration: INSERT_DUR, ease: 'power2.inOut' }, at)
  at += INSERT_DUR + 0.2
  tl.fromTo(anim, { boxes: 0 }, { boxes: 1, duration: BOXES_DUR, ease: 'power2.out' }, at)
  at += BOXES_DUR + 0.1
  const foldDur = foldDuration(m)
  tl.fromTo(anim, { fold: 0 }, { fold: 1, duration: foldDur, ease: 'none' }, at)
  at += foldDur + 0.15
  tl.fromTo(anim, { compact: 0 }, { compact: 1, duration: COMPACT_DUR, ease: 'power2.inOut' }, at)
  at += COMPACT_DUR + 0.1
  tl.fromTo(anim, { boxOut: 0 }, { boxOut: 1, duration: BOXOUT_DUR, ease: 'none' }, at)
  tl.fromTo(anim, { badge: 0 }, { badge: 1, duration: 0.6, ease: 'power2.out' }, at)
  const encodedAt = at + BOXOUT_DUR + 0.3
  tl.addLabel('encoded', encodedAt)

  tl.fromTo(anim, { decode: 0 }, { decode: 1, duration: DEC_DUR, ease: 'none' }, encodedAt + 0.2)
  const decodedAt = encodedAt + 0.2 + DEC_DUR + 0.3
  tl.addLabel('decoded', decodedAt)
  // Something has to occupy the final instant or the timeline ends before the label.
  tl.to({}, { duration: 0.01 }, decodedAt)
  return tl
}

// --- Drawing ---------------------------------------------------------------------

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

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = colours.panel
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8)
  ctx.stroke()
}

/**
 * The artwork, one filled cell per pixel.
 *
 * `revealed` is how much of the picture has arrived, 0 to 1 across the pixels in scan
 * order. Below it, pixels are drawn dim — on the left that is the scan sweeping through,
 * on the right it is the decode filling in.
 */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  gx: number,
  rgb: Uint8Array,
  revealed: number,
) {
  const n = rgb.length / 3
  const head = revealed * n
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.min(1, head - i))
    if (a <= 0.01) continue
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
    const x = gx + (i % SPRITE_SIZE) * CELL
    const y = PANEL_Y + Math.floor(i / SPRITE_SIZE) * CELL
    ctx.globalAlpha = a
    ctx.fillStyle = `rgb(${r},${g},${b})`
    // Snapped to whole units so neighbouring cells meet exactly with no seam.
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(CELL), Math.ceil(CELL))
  }
  ctx.globalAlpha = 1
}

/**
 * The sprite picker, drawn on the stage under the artwork rather than as buttons below it.
 *
 * Six pictures name themselves better than six words do, and moving them onto the canvas
 * hands the control row back to the one choice that does need words.
 */
function drawThumbs(ctx: CanvasRenderingContext2D) {
  SPRITES.forEach((sprite, i) => {
    const x = LEFT_X + i * (THUMB_W + THUMB_GAP)
    const chosen = sprite.id === spriteId.value
    const pixels = thumbPixels[i]
    const cell = Math.floor(Math.min(THUMB_W - 12, THUMB_H - 12) / SPRITE_SIZE)
    const side = cell * SPRITE_SIZE
    const ox = Math.round(x + (THUMB_W - side) / 2)
    const oy = Math.round(THUMB_Y + (THUMB_H - side) / 2)

    ctx.fillStyle = colours.panel
    roundRect(ctx, x, THUMB_Y, THUMB_W, THUMB_H, 6)
    ctx.fill()
    for (let p = 0; p < SPRITE_SIZE * SPRITE_SIZE; p++) {
      ctx.fillStyle = `rgb(${pixels[p * 3]},${pixels[p * 3 + 1]},${pixels[p * 3 + 2]})`
      ctx.fillRect(ox + (p % SPRITE_SIZE) * cell, oy + Math.floor(p / SPRITE_SIZE) * cell, cell, cell)
    }
    ctx.strokeStyle = chosen ? colours.accent : colours.border
    ctx.lineWidth = chosen ? 2.5 : 1
    roundRect(ctx, x + 0.5, THUMB_Y + 0.5, THUMB_W - 1, THUMB_H - 1, 6)
    ctx.stroke()
  })

  // The thumbnails say which sprite; this says why it is in the picker at all.
  ctx.fillStyle = colours.dim
  ctx.font = 'italic 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(sprite.value.note, LEFT_X + PANEL / 2, THUMB_Y + THUMB_H + 26, PANEL)
}

function pickSprite(event: MouseEvent) {
  const el = event.currentTarget as HTMLCanvasElement
  const rect = el.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * STAGE_W
  const y = ((event.clientY - rect.top) / rect.height) * STAGE_H
  if (y < THUMB_Y || y > THUMB_Y + THUMB_H) return
  const i = Math.floor((x - LEFT_X) / (THUMB_W + THUMB_GAP))
  if (i >= 0 && i < SPRITES.length) spriteId.value = SPRITES[i].id
}

/**
 * Word-wrapped lines. The band is wide enough that a sentence set at a readable size needs
 * two of them, and the alternative — one line sized to fit — is the thing the deck forbids.
 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * The primer band. Only the palette representation has one — which is why the band is on
 * all three rather than only on the one that fills it: an empty primer is a result.
 */
function drawPrimer(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  panel(ctx, MARGIN, PRIMER_Y, STAGE_W - MARGIN * 2, PRIMER_H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // "No primer" is a two-line sentence in a band built to hold a palette, so it gets the
  // room: set large and wrapped, centred in the empty space rather than squeezed onto one
  // line in the middle of it.
  if (repId.value !== 'palette') {
    ctx.fillStyle = colours.dim
    ctx.font = '34px Inter, system-ui, sans-serif'
    const lines = wrapLines(ctx, rep.value.primer, STAGE_W - MARGIN * 2 - 60)
    const lineH = 46
    const top = PRIMER_Y + PRIMER_H / 2 - ((lines.length - 1) * lineH) / 2
    lines.forEach((l, i) => ctx.fillText(l, MARGIN + 30, top + i * lineH))
    return
  }

  const lost = m.pixels.lossyPalette
  ctx.fillStyle = colours.warn
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  ctx.fillText(
    `THE PALETTE · ${m.pixels.palette.length} ENTRIES · ${Math.round(m.overheadBits / 8)} BYTES`
    + (lost
      ? ` — the artwork had ${m.pixels.sourceColours} colours, so this is lossy`
      : ' — an index means nothing without it, so it travels with the picture'),
    MARGIN + 26, PRIMER_Y + 30)

  // Sized to whatever the palette turned out to be: four for a sprite, sixteen for a ramp.
  const pitch = Math.min(110, (STAGE_W - MARGIN * 2 - 52) / m.pixels.palette.length)
  const sw = Math.max(26, pitch - 16)
  m.pixels.palette.forEach((rgb, i) => {
    const x = MARGIN + 26 + i * pitch
    const y = PRIMER_Y + 56
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    roundRect(ctx, x, y, sw, 46, 5)
    ctx.fill()
    ctx.strokeStyle = colours.border
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = colours.accent
    ctx.font = '26px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText(hex(i), x + sw / 2, y + 68)
    ctx.textAlign = 'left'
  })
}

/** Where a byte sits in a ribbon: left edge of its two hex digits. */
function bytePos(rib: Ribbon, byteIndex: number) {
  const g = glyphOfByte(byteIndex)
  return {
    x: RIBBON_X + (g % rib.cols) * rib.adv,
    y: RIBBON_Y + (Math.floor(g / rib.cols) + 0.5) * rib.rowH,
    row: Math.floor(g / rib.cols),
  }
}

interface RunState {
  /** Value bytes still on screen, not counting the count byte in front of them. */
  values: number
  /** The count as it stands. */
  count: number
  /** Fractional width in bytes including the count, so the box slides rather than snaps. */
  width: number
}

/**
 * Where run `r` has got to.
 *
 * All runs start folding together and the pace is one byte per tick, so a run of twelve
 * takes eleven times as long as a run of two. Because the count byte was *inserted* rather
 * than written over the first value, the arithmetic comes out exactly: absorbing `len - 1`
 * values leaves one behind, and the count reaches `len`.
 */
function runState(m: Model, r: number): RunState {
  const len = m.spans[r].length
  const steps = Math.max(1, m.maxVisibleRun - 1)
  const progress = Math.min(anim.fold * steps, len - 1)
  const done = Math.floor(progress)
  return {
    values: Math.max(1, len - done),
    count: 1 + done,
    width: 1 + Math.max(1, len - progress),
  }
}

const BOX_RADIUS = 3

/** The tint behind a run, in one rectangle per row it occupies. */
function drawRunBox(
  ctx: CanvasRenderingContext2D,
  rib: Ribbon,
  firstByte: number,
  width: number,
  colour: string,
  alpha: number,
) {
  if (alpha <= 0.01 || width <= 0) return
  ctx.globalAlpha = alpha * 0.3
  ctx.fillStyle = colour
  let remaining = width
  let byte = firstByte
  while (remaining > 0.01) {
    const at = bytePos(rib, byte)
    const inRow = Math.min(remaining, rib.cols / GLYPHS_PER_BYTE - (glyphOfByte(byte) % rib.cols) / GLYPHS_PER_BYTE)
    const w = inRow * GLYPHS_PER_BYTE * rib.adv - rib.adv * 0.35
    roundRect(ctx, at.x - rib.adv * 0.28, at.y - rib.rowH * 0.46, w, rib.rowH * 0.92, BOX_RADIUS)
    ctx.fill()
    remaining -= inRow
    byte += Math.round(inRow)
    if (inRow <= 0) break
  }
  ctx.globalAlpha = 1
}

/**
 * The dump, mid-encode: every run drawn as the bytes it currently has left.
 *
 * Runs are drawn individually rather than batched, because each one is at its own point in
 * its own fold — which is the whole reason the beat is legible.
 *
 * Three coordinate spaces, in order: the raw dump, the *expanded* dump once every run has
 * a count byte in front of it (`start + r`, since each earlier run pushed everything along
 * by one), and the packed stream. `insert` interpolates between the first two and `compact`
 * between the second and third.
 */
function drawEncoding(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  const src = m.source
  const boxAlpha = anim.boxes * (1 - anim.boxOut)
  const ins = anim.insert
  const move = anim.compact
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  const countFont = `700 ${src.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

  for (const pair of m.pairs) {
    if (!pair.fromVisible && !pair.toVisible) continue
    const run = m.spans[pair.run]
    const st = runState(m, pair.run)
    const isRun = run.length >= 2
    const value = hex(run.value)
    const expStart = run.start + pair.run

    let alpha = 1
    if (!pair.fromVisible) alpha = move
    else if (!pair.toVisible) alpha = 1 - move
    if (alpha <= 0.01) continue

    if (move > 0.001) {
      // Sliding left into the gaps: count and value travel together to the packed slot.
      const fromA = bytePos(src, expStart)
      const fromB = bytePos(src, expStart + 1)
      const toA = bytePos(m.packed, pair.run * 2)
      const toB = bytePos(m.packed, pair.run * 2 + 1)
      const ax = fromA.x + (toA.x - fromA.x) * move
      const ay = fromA.y + (toA.y - fromA.y) * move
      const bx = fromB.x + (toB.x - fromB.x) * move
      const by = fromB.y + (toB.y - fromB.y) * move

      if (isRun && boxAlpha > 0.01 && Math.abs(by - ay) < 1) {
        ctx.globalAlpha = alpha * boxAlpha * 0.3
        ctx.fillStyle = pair.colour
        const w = (bx - ax) + GLYPHS_PER_BYTE * src.adv - src.adv * 0.35
        roundRect(ctx, ax - src.adv * 0.28, ay - src.rowH * 0.46, w, src.rowH * 0.92, BOX_RADIUS)
        ctx.fill()
      }

      ctx.globalAlpha = alpha
      ctx.fillStyle = colours.text
      ctx.font = countFont
      ctx.fillText(hex(run.length), ax, ay)
      ctx.fillStyle = pair.colour
      ctx.font = ribbonFont(src.fontSize)
      ctx.fillText(value, bx, by)
      continue
    }

    // In place. The box spans the count byte and whatever values are left behind it.
    if (isRun && expStart < m.capacity) {
      const room = Math.max(0, m.capacity - expStart)
      drawRunBox(ctx, src, expStart, Math.min(st.width, room), pair.colour, boxAlpha)
    }

    // The count byte: pushed in during `insert`, then ticking up through the fold.
    if (ins > 0.01 && expStart < m.capacity) {
      const at = bytePos(src, expStart)
      ctx.globalAlpha = alpha * Math.min(1, ins * 2)
      ctx.fillStyle = colours.text
      ctx.font = countFont
      ctx.fillText(hex(st.count), at.x, at.y)
    }

    // The values, sliding right as the counts make room for them.
    ctx.font = ribbonFont(src.fontSize)
    ctx.fillStyle = pair.colour
    for (let j = 0; j < st.values; j++) {
      const to = expStart + 1 + j
      if (to >= m.capacity) break
      const a = bytePos(src, run.start + j)
      const b = bytePos(src, to)
      ctx.globalAlpha = alpha
      ctx.fillText(value, a.x + (b.x - a.x) * ins, a.y + (b.y - a.y) * ins)
    }
  }
  ctx.globalAlpha = 1
}

function drawCentre(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  panel(ctx, CENTRE_X, CENTRE_Y, CENTRE_W, CENTRE_H)

  // The pane starts empty and the scan writes it, one byte per pixel. Watching the bytes
  // arrive is what makes them read as *the picture, restated* rather than as a second thing
  // on the slide — and each arrives already tinted, so a run appears as a band the moment it
  // exists and "there are no runs in this one" is something you watch fail to happen.
  //
  // Clipped to the *visible rows*, not just the panel. The in-place beats check every byte
  // against `capacity` before drawing it, but the compaction beat interpolates from
  // *expanded* positions — a run near the end of a full pane has been pushed past the last
  // visible row by the count bytes in front of it, and `bytePos` will happily return a row
  // below the dump. The panel is taller than the dump, so clipping only to the panel left a
  // dead band beneath the last row where those bytes popped into view the instant the fold
  // ended. Clipped to the rows the fold itself drew into, such a pair stays hidden and
  // slides up into the stream during compaction instead of appearing at the bottom.
  ctx.save()
  roundRect(ctx, CENTRE_X + 1, CENTRE_Y + 1, CENTRE_W - 2, CENTRE_H - 2, 8)
  ctx.clip()
  ctx.beginPath()
  ctx.rect(CENTRE_X, RIBBON_Y, CENTRE_W, m.source.rows * m.source.rowH)
  ctx.clip()
  if (anim.insert <= 0.001) {
    drawRibbon(ctx, m.source, RIBBON_X, RIBBON_Y, anim.scan)
  } else {
    drawEncoding(ctx)
  }
  ctx.restore()

  // Truncated, never shrunk — and it says by how much, in bytes rather than glyphs. Held
  // back until the pane has actually been written: during the scan it is only partly full,
  // so a count of what did not fit would be describing something not yet there.
  //
  // Three totals across the beats: raw, then raw plus a count byte per run, then encoded.
  const total = anim.compact > 0.5
    ? m.encoded.length
    : anim.insert > 0.5 ? m.expandedTotal : m.bytes.length
  const missing = Math.max(0, total - m.capacity)
  if (anim.scan > 0.98 && missing > 0) {
    ctx.fillStyle = colours.warn
    ctx.font = '22px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`… ${missing} more bytes`, RIBBON_X, RIBBON_Y + RIBBON_H + 14)
  }

  if (anim.badge > 0.01) {
    const verdict = ratioVerdict(1 + (ratio.value - 1) * anim.badge)
    drawStamp(ctx, verdict.text, CENTRE_X + CENTRE_W / 2, CENTRE_Y + CENTRE_H - 62,
      verdict.better ? colours.good : colours.warn, { alpha: anim.badge })
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  const m = model.value
  if (!m) return
  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  // The artwork is the premise, not a reveal: it is there from the first frame, and the
  // scan is a cursor moving over it rather than the picture arriving.
  panel(ctx, LEFT_X, PANEL_Y, PANEL, PANEL)
  drawSprite(ctx, LEFT_X, m.sourcePixels, 1)
  if (anim.scan > 0.001 && anim.scan < 0.999) {
    const pixel = Math.floor((anim.scan * m.bytes.length) / m.perPixel)
    const cx = LEFT_X + (pixel % SPRITE_SIZE) * CELL
    const cy = PANEL_Y + Math.floor(pixel / SPRITE_SIZE) * CELL
    ctx.strokeStyle = colours.accent
    ctx.lineWidth = 3
    ctx.strokeRect(cx, cy, CELL, CELL)
  }

  panel(ctx, RIGHT_X, PANEL_Y, PANEL, PANEL)
  drawSprite(ctx, RIGHT_X, m.decodedPixels, anim.decode)

  drawThumbs(ctx)
  drawCentre(ctx)
  drawPrimer(ctx)

  const text = m.roundTrips ? 'LOSSLESS' : 'LOSSY'
  drawStamp(ctx, text, RIGHT_X + PANEL / 2, THUMB_Y + THUMB_H / 2,
    m.roundTrips ? colours.good : colours.warn,
    { size: 36, alpha: smoothstep(0.94, 1, anim.decode) })
}

const { canvas, stage, progress, selectStage, scrub, rebuild } = usePhaseStage({
  stages: STAGES,
  width: STAGE_W,
  height: STAGE_H,
  beforeBuild: () => { readColours(); model.value = buildModel() },
  build,
  draw,
})

watch([sprite, repId], () => rebuild(), { immediate: true })
</script>

<template>
  <SlideLayout column>
    <div class="rle">
      <div class="stage-wrap">
        <!-- The sprite picker lives on the canvas, under the artwork; see `drawThumbs`. -->
        <canvas ref="canvas" @click="pickSprite" />
      </div>

      <div class="stage-controls">
        <div class="stage-picker">
          <span class="desc">{{ rep.unit }}</span>
          <div class="seg-group">
            <button
              v-for="r in REPRESENTATIONS" :key="r.id"
              :class="{ on: repId === r.id }"
              @click="repId = r.id"
            >{{ r.label }}</button>
          </div>
        </div>

        <!-- Slider and buttons drive one playhead: the buttons jump to a labelled phase,
             the slider goes anywhere, and each shows what the other did. -->
        <div class="stage-picker">
          <input
            class="stage-scrub" type="range" min="0" max="1000" step="1"
            aria-label="Scrub the animation"
            :value="Math.round(progress * 1000)"
            @input="scrub(Number(($event.target as HTMLInputElement).value) / 1000)"
          />
          <div class="seg-group">
            <button
              v-for="(name, i) in STAGE_NAMES" :key="i"
              :class="{ on: stage === i }"
              @click="selectStage(i)"
            >{{ name }}</button>
          </div>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.rle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.stage-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sized in JS from the wrapper — see `usePhaseStage`. `display: block` only stops the
   inline-element baseline gap from making the wrapper a few pixels taller than the canvas. */
canvas {
  display: block;
  border-radius: 8px;
  border: 1px solid var(--border);
  /* Only the thumbnail strip is clickable, but the cursor is the only affordance there is. */
  cursor: pointer;
}
</style>
