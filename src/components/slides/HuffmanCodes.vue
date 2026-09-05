<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { useDeck } from '../../deck/useDeck'
import { useStat } from '../../stats/useStats'
import { SAMPLE_TEXTS, sampleById, type SampleText } from '../../content/corpus'
import { tokenise, graphemes, utf8Bytes } from '../../engine/codecs/tokenise'
import {
  buildHuffman,
  countSymbols,
  encodeSymbols,
  decodeBits,
} from '../../engine/codecs/huffman'

/**
 * Huffman coding as a round trip you can watch, end to end, on real text.
 *
 * Deliberately *not* about how the codes are chosen — the tree, the merges, the greedy
 * argument are all absent. What the audience is meant to take away is the shape of the
 * thing: a message is cut into symbols, the symbols are counted, the common ones are
 * handed short codes and the rare ones long ones, the message becomes a ribbon of bits
 * several times smaller, and the ribbon turns back into exactly the text it came from.
 *
 * Three decisions worth knowing about:
 *
 * **The tokeniser is part of the picker, not a hidden constant.** Each text declares how
 * it is cut up, because that choice is the whole game and changing texts without changing
 * it would be a lie: English is coded by word, Chinese by character, and the ASCII noise
 * by character too, where it makes no difference because nothing repeats. Watching the
 * badge fall from 20x to 1.2x across the four texts is the argument that compression is a
 * property of the data, not of the coder.
 *
 * **The numbers are measured, never asserted.** The ratio in the badge is
 * `utf8Bytes(message) * 8 / payloadBits`, and the decode is a real `decodeBits` walk that
 * the slide checks against the original — the tick beside "decoded" is a round-trip
 * assertion, not decoration. The code table is not waved away either, but it is priced in
 * the HUD rather than on the stage: see `drawCentre`.
 *
 * **One 2D canvas, GSAP tweening plain objects the draw loop reads.** Same model as
 * `basis-64`, for the same reasons: several hundred moving labels are nothing for canvas
 * and would be hundreds of DOM nodes thrashing layout, and the deck already has exactly
 * one rendering model. The backing store is sized to the real display size (see
 * CLAUDE.md) so nothing gets resampled.
 */

const deck = useDeck()

// --- Stage geometry, in canvas logical units ---------------------------------

/**
 * The stage aspect is chosen to match the deck's slide area once the control row beneath
 * it is accounted for, and the canvas is then told to fill that area in both directions.
 * An earlier version pinned the height to `66vh` against a 2.1:1 stage, which left about
 * a hundred pixels unused down each edge — on a projector that is legibility thrown away.
 *
 * There are no captions on the stage. Every panel is identifiable from what it contains
 * and from the step buttons under it, and the words that were genuinely carrying
 * information — which text this is, and what a symbol is for that text — moved into the
 * control row where they belong.
 */
const STAGE_W = 1600
/**
 * 1.96:1 — between the two shapes the slide area actually takes. A laptop leaves a box
 * near 2.0:1 and a 1080p projector nearer 1.9:1, so a fixed stage has to pick somewhere
 * between them; at either end the leftover is around 30px on one axis rather than 60 on
 * the other.
 */
const STAGE_H = 816

const MARGIN = 16
const GAP = 22

/** The two text grids are square and the same size, so a match is checkable by eye. */
const PANEL = 486
const GRID_Y = 14
const LEFT_X = MARGIN
const RIGHT_X = STAGE_W - MARGIN - PANEL

const CENTRE_X = LEFT_X + PANEL + GAP
const CENTRE_W = RIGHT_X - GAP - CENTRE_X
const CENTRE_Y = GRID_Y
const CENTRE_H = PANEL

const RIBBON_X = CENTRE_X + 16
const RIBBON_Y = CENTRE_Y + 16
const RIBBON_W = CENTRE_W - 32
const RIBBON_H = 374
const RIBBON_FONT = 24
/** The badge sits alone under the ribbon — the arithmetic behind it lives in the HUD. */
const BADGE_Y = CENTRE_Y + CENTRE_H - 28

const TABLE_X = MARGIN
const TABLE_Y = GRID_Y + PANEL + 24
const TABLE_W = STAGE_W - MARGIN * 2
const TABLE_H = STAGE_H - TABLE_Y - 14
/**
 * Six across rather than eight. Twenty-four entries fitted, and every one of them was
 * too small to read from the back of a room — which makes the table decoration rather
 * than evidence. The tail is a count, not a list, so fewer and bigger wins.
 */
const TABLE_COLS = 6
const TABLE_ROWS = 3
const TABLE_SLOTS = TABLE_COLS * TABLE_ROWS
const SLOT_W = TABLE_W / TABLE_COLS
const SLOT_H = TABLE_H / TABLE_ROWS

// --- The message --------------------------------------------------------------

interface Placed {
  text: string
  typeId: number
  row: number
  col: number
  /** Width in grid cells, i.e. grapheme clusters. */
  span: number
  /** Offset of this occurrence's code in the bitstream. */
  bitAt: number
}

interface TokenType {
  /** Also the frequency rank: 0 is the most common token in the message. */
  id: number
  text: string
  /** What to print — whitespace has to be drawn as something. */
  label: string
  count: number
  code: string
  colour: string
  /** Centre of this token's first occurrence in the left grid, in stage coordinates. */
  fromX: number
  fromY: number
  /** Table slot, or -1 for the tail that the table has no room for. */
  slot: number
}

interface Model {
  sample: SampleText
  cellW: number
  rowH: number
  fontSize: number
  rows: number
  placed: Placed[]
  /** Frequency order, so a type's id is also its index here. */
  types: TokenType[]
  rawBits: number
  payloadBits: number
  tableBits: number
  roundTrips: boolean
  /** Truncated at what the pane can show; `payloadBits` is the real total. */
  ribbon: { ch: string; colour: string }[]
  ribbonCols: number
  ribbonRowH: number
  hidden: number
}

/** Off-screen context used only for `measureText` while laying the grid out. */
const measure = document.createElement('canvas').getContext('2d')!

function gridFont(size: number) {
  return `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono", monospace`
}
function bitFont(size: number) {
  return `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
}
function uiFont(size: number, weight = '400') {
  return `${weight} ${size}px Inter, system-ui, sans-serif`
}

/**
 * A font size at which the text fills its cells.
 *
 * Measured rather than tabulated, because "fixed width" only holds within one script:
 * the same monospace stack falls back to a different family for Han and for Devanagari,
 * with different advance widths, and hard-coding a size per language would break the
 * moment the deck ran on another machine. Averaging over the whole text — rather than
 * fitting the widest cluster — keeps the common case at full size and lets the occasional
 * wide conjunct be condensed by `fillText`'s own maxWidth.
 */
function fitFont(tokens: string[], cellW: number): number {
  const REF = 100
  measure.font = gridFont(REF)
  let width = 0
  let cells = 0
  for (const t of tokens) {
    if (t === '\n') { cells += 1; continue }
    width += measure.measureText(t).width
    cells += graphemes(t).length
  }
  if (!width || !cells) return 16
  return Math.max(9, Math.min(cellW * 2, (cellW * REF * 0.98) / (width / cells)))
}

/**
 * Distinct hues by frequency rank, so the eye can follow one token from the grid to the
 * table without reading it. Tokens that occur once get no colour: a colour box means
 * "this repeats", and 200 unique hues would say nothing at all.
 */
function colourFor(rank: number, count: number, dim: string): string {
  if (count < 2) return dim
  return `hsl(${Math.round((rank * 137.508) % 360)} 88% 64%)`
}

function labelFor(text: string): string {
  if (text === '\n') return '↵'
  if (text === ' ') return '␣'
  if (/^\s+$/.test(text)) return '␣'
  return text
}

/**
 * Lay the message into the grid, wrapping on whole tokens.
 *
 * Anything past the last row is dropped from the *message*, not merely from the display,
 * so every number on the slide describes exactly the text on screen — but `overflow` says
 * when that happened, and the caller shrinks the font and tries again rather than quietly
 * accepting the loss.
 */
function layout(raw: string[], spans: number[], cols: number, rows: number) {
  const placed: Placed[] = []
  let row = 0
  let col = 0
  let overflow = false
  for (let i = 0; i < raw.length; i++) {
    const text = raw[i]
    if (row >= rows) { overflow = true; break }
    if (text === '\n') {
      placed.push({ text, typeId: -1, row, col, span: 1, bitAt: 0 })
      row++
      col = 0
      continue
    }
    const span = spans[i]
    if (col > 0 && col + span > cols) {
      row++
      col = 0
      // A space that falls off the end of a line is swallowed by the wrap, as in any text
      // layout. Both grids run this same function, so they stay identical regardless.
      if (/^\s+$/.test(text)) continue
      if (row >= rows) { overflow = true; break }
    }
    placed.push({ text, typeId: -1, row, col, span, bitAt: 0 })
    col += span
  }
  return { placed, overflow }
}

function buildModel(sample: SampleText, dim: string): Model | null {
  const raw = tokenise(sample.text.replace(/\r\n/g, '\n'), sample.tokeniser)
  if (!raw.length) return null

  const cellW = PANEL / sample.cols
  const spans = raw.map(t => (t === '\n' ? 1 : graphemes(t).length))

  // Shrink until the whole message fits, rather than trusting the first estimate. The
  // font stack resolves to a different family on every operating system — Consolas is a
  // tenth narrower than most — and a text that fitted here but lost its last line on the
  // projector is exactly the sort of bug nobody finds until they are in front of a room.
  let fontSize = fitFont(raw, cellW)
  let rowH = fontSize * sample.lineFactor
  let rows = Math.max(1, Math.floor(PANEL / rowH))
  let laid = layout(raw, spans, sample.cols, rows)
  for (let attempt = 0; attempt < 8 && laid.overflow; attempt++) {
    fontSize *= 0.92
    rowH = fontSize * sample.lineFactor
    rows = Math.max(1, Math.floor(PANEL / rowH))
    laid = layout(raw, spans, sample.cols, rows)
  }
  const placed = laid.placed
  if (!placed.length) return null

  const message = placed.map(p => p.text)
  const counts = countSymbols(message)
  const { tree, codes } = buildHuffman(counts)
  if (!tree) return null

  // Ties broken by first appearance so the table does not reshuffle between texts of the
  // same shape — and so the ordering is reproducible for a presenter who has rehearsed.
  const firstAt = new Map<string, number>()
  message.forEach((t, i) => { if (!firstAt.has(t)) firstAt.set(t, i) })
  const ordered = [...counts].sort(
    (a, b) => b[1] - a[1] || firstAt.get(a[0])! - firstAt.get(b[0])!)

  const visible = ordered.length > TABLE_SLOTS ? TABLE_SLOTS - 1 : ordered.length
  const types: TokenType[] = ordered.map(([text, count], rank) => ({
    id: rank,
    text,
    label: labelFor(text),
    count,
    code: codes.get(text) ?? '',
    colour: colourFor(rank, count, dim),
    fromX: -1,
    fromY: -1,
    slot: rank < visible ? rank : -1,
  }))
  const indexOf = new Map<string, number>()
  types.forEach(t => indexOf.set(t.text, t.id))

  let bitAt = 0
  for (const p of placed) {
    p.typeId = indexOf.get(p.text)!
    p.bitAt = bitAt
    const type = types[p.typeId]
    bitAt += type.code.length
    if (type.fromX < 0) {
      type.fromX = LEFT_X + (p.col + p.span / 2) * cellW
      type.fromY = GRID_Y + (p.row + 0.5) * rowH
    }
  }

  const payloadBits = bitAt
  const rawBits = utf8Bytes(message.join('')) * 8

  /**
   * The primer, priced. The decoder cannot read one bit of the payload without the
   * table, so it is a real cost and gets its own bar: for each entry, a byte of length,
   * the token's own UTF-8 bytes, five bits of code length, and the code.
   */
  let tableBits = 0
  for (const [text, code] of codes) tableBits += 8 + utf8Bytes(text) * 8 + 5 + code.length

  // Decoded back rather than asserted to work — the tick on the right panel is this.
  const bitstring = encodeSymbols(message, codes)
  const roundTrips = decodeBits(tree, bitstring).join('') === message.join('')

  measure.font = bitFont(RIBBON_FONT)
  const ribbonCols = Math.max(8, Math.floor(RIBBON_W / measure.measureText('0').width))
  const ribbonRowH = RIBBON_FONT * 1.15
  const cap = ribbonCols * Math.max(1, Math.floor(RIBBON_H / ribbonRowH))

  const ribbon: { ch: string; colour: string }[] = []
  for (const p of placed) {
    if (ribbon.length >= cap) break
    const type = types[p.typeId]
    for (const ch of type.code) {
      if (ribbon.length >= cap) break
      ribbon.push({ ch, colour: type.colour })
    }
  }

  return {
    sample,
    cellW,
    rowH,
    fontSize,
    rows,
    placed,
    types,
    rawBits,
    payloadBits,
    tableBits,
    roundTrips,
    ribbon,
    ribbonCols,
    ribbonRowH,
    hidden: payloadBits - ribbon.length,
  }
}

// --- Colours -------------------------------------------------------------------

let colours = {
  bg: '#14141f',
  panel: '#0a0a0f',
  border: '#2a2a3a',
  text: '#e0e0e8',
  dim: '#8888a0',
  accent: '#6c8cff',
  good: '#4ade80',
  warn: '#fbbf24',
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

// --- Model ----------------------------------------------------------------------

const sampleId = ref(SAMPLE_TEXTS[0].id)
const sample = computed(() => sampleById(sampleId.value))
/**
 * `shallowRef`, not `ref`: the model holds several hundred `Placed` and `TokenType`
 * objects that the draw loop reads on every frame, and the flight sprites hold references
 * to them. Deep reactivity would put a Proxy in front of every one of those reads and
 * would give the sprites a different object identity from the model's own.
 */
const model = shallowRef<Model | null>(null)

function rebuildModel() {
  model.value = buildModel(sample.value, colours.dim)
}

useStat('huffman-codes', () => {
  const m = model.value
  if (!m) return null
  return {
    label: `Huffman · ${m.sample.label} text`,
    rawBits: m.rawBits,
    encodedBits: m.payloadBits,
    overheadBits: m.tableBits,
    lossy: !m.roundTrips,
    note: `${m.placed.length} ${m.sample.unit} · ${m.types.length} distinct · ` +
      `${(m.payloadBits / m.placed.length).toFixed(2)} bits each`,
  }
})

const ratio = computed(() => {
  const m = model.value
  return m && m.payloadBits > 0 ? m.rawBits / m.payloadBits : 1
})
// --- Animation ------------------------------------------------------------------

const STAGES = ['text', 'tokens', 'table', 'codes', 'encoded', 'decoded'] as const
const STAGE_NAMES = ['Message', 'Tokens', 'Counts', 'Codes', 'Encoded', 'Decoded'] as const
/** Tweened by GSAP, read by the draw loop. Nothing here is reactive on purpose. */
const anim = { scan: 0, encode: 0, decode: 0, badge: 0 }
let flyers: { type: TokenType; t: number }[] = []
let codeReveal: { a: number }[] = []
let decoders: { p: Placed; at: number; t: number }[] = []

let tl: gsap.core.Timeline | null = null
let playhead: gsap.core.Tween | null = null
const stage = ref(deck.learnMode.value ? STAGES.length - 1 : Math.min(STAGES.length - 1, deck.fragment.value))

const SCAN_AT = 0.1
const SCAN_DUR = 1.8
const FLY_DUR = 0.7
const CODE_DUR = 0.3
const ENC_DUR = 1.5
const DEC_DUR = 2.0
const DEC_FLIGHT = 0.55
/** How many of the decoded tokens actually get a sprite; the rest simply appear. */
const DEC_SPRITES = 44

function buildTimeline() {
  tl?.kill()
  const m = model.value
  if (!m) return

  anim.scan = 0; anim.encode = 0; anim.decode = 0; anim.badge = 0
  flyers = m.types.map(type => ({ type, t: 0 }))
  codeReveal = m.types.map(() => ({ a: 0 }))

  const step = Math.max(1, Math.ceil(m.placed.length / DEC_SPRITES))
  decoders = m.placed
    .map((p, at) => ({ p, at, t: 0 }))
    .filter(d => d.at % step === 0)

  const n = m.types.length
  const flyStagger = Math.min(0.04, 1.7 / Math.max(1, n))
  const codeStagger = Math.min(0.03, 1.2 / Math.max(1, n))

  tl = gsap.timeline({ paused: true })
  // Every entry in STAGES must exist as a label — GSAP silently resolves an unknown one
  // to the end of the timeline.
  tl.addLabel('text', 0)

  tl.fromTo(anim, { scan: 0 }, { scan: 1, duration: SCAN_DUR, ease: 'none' }, SCAN_AT)
  const tokensAt = SCAN_AT + SCAN_DUR + 0.15
  tl.addLabel('tokens', tokensAt)

  const flyAt = tokensAt + 0.2
  flyers.forEach((f, i) => {
    tl!.fromTo(f, { t: 0 }, { t: 1, duration: FLY_DUR, ease: 'power2.inOut' }, flyAt + i * flyStagger)
  })
  const tableAt = flyAt + (n - 1) * flyStagger + FLY_DUR + 0.1
  tl.addLabel('table', tableAt)

  const codeAt = tableAt + 0.2
  codeReveal.forEach((c, i) => {
    tl!.fromTo(c, { a: 0 }, { a: 1, duration: CODE_DUR, ease: 'power1.out' }, codeAt + i * codeStagger)
  })
  const codesAt = codeAt + (n - 1) * codeStagger + CODE_DUR + 0.1
  tl.addLabel('codes', codesAt)

  const encAt = codesAt + 0.2
  tl.fromTo(anim, { encode: 0 }, { encode: 1, duration: ENC_DUR, ease: 'none' }, encAt)
  tl.fromTo(anim, { badge: 0 }, { badge: 1, duration: 0.7, ease: 'power2.out' }, encAt + ENC_DUR * 0.65)
  const encodedAt = encAt + ENC_DUR + 0.45
  tl.addLabel('encoded', encodedAt)

  const decAt = encodedAt + 0.25
  tl.fromTo(anim, { decode: 0 }, { decode: 1, duration: DEC_DUR, ease: 'none' }, decAt)
  const total = Math.max(1, m.placed.length)
  for (const d of decoders) {
    // Launched so that it lands just as its cell in the right-hand grid fills in.
    const lands = decAt + (d.at / total) * DEC_DUR
    tl.fromTo(d, { t: 0 }, { t: 1, duration: DEC_FLIGHT, ease: 'power1.inOut' },
      Math.max(decAt, lands - DEC_FLIGHT))
  }
  const decodedAt = decAt + DEC_DUR + 0.35
  tl.addLabel('decoded', decodedAt)
  // Something has to occupy the final instant or the timeline ends before the label.
  tl.to({}, { duration: 0.01 }, decodedAt)

  goToStage(stage.value, true)
}

function goToStage(n: number, instant = false) {
  if (!tl) return
  playhead?.kill()
  playhead = null
  const label = STAGES[Math.max(0, Math.min(STAGES.length - 1, n))]
  // No duration given, so GSAP moves the playhead at natural speed: picking a state
  // *plays* the animation to it, forwards or backwards.
  if (instant) tl.seek(label)
  else playhead = tl.tweenTo(label)
  dirty = true
}

function selectStage(n: number) {
  const target = Math.max(0, Math.min(STAGES.length - 1, n))
  // Picking the state you are already in replays the step that got you there.
  if (target === stage.value && target > 0 && tl) tl.seek(STAGES[target - 1])
  stage.value = target
  if (!deck.learnMode.value) deck.fragment.value = target
  goToStage(target)
}

// --- Drawing --------------------------------------------------------------------

const stageCanvas = ref<HTMLCanvasElement>()
let scale = 1
let observer: ResizeObserver | null = null

/**
 * A full frame is around two thousand `fillText` calls — two grids of text, a ribbon of
 * a thousand bits and two dozen table entries. That is fine while something is moving and
 * pure waste for the minutes a presenter spends parked on one state, so the loop only
 * redraws while the playhead is running or something has explicitly changed.
 */
let dirty = true

function resizeCanvas() {
  const canvas = stageCanvas.value
  if (!canvas) return
  const width = canvas.getBoundingClientRect().width
  if (!width) return
  const next = (width * (window.devicePixelRatio || 1)) / STAGE_W
  if (Math.abs(next - scale) < 0.001) return
  scale = next
  canvas.width = Math.round(STAGE_W * scale)
  canvas.height = Math.round(STAGE_H * scale)
  dirty = true
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0 || h <= 0) return
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
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
 * One of the two text grids. Both go through here, which is what guarantees the decoded
 * panel can be compared with the source panel by eye — same layout, same boxes, same
 * glyph positions, differing only in what each one has revealed so far.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  gx: number,
  textAlpha: (i: number) => number,
  boxAlpha: (i: number) => number,
) {
  const m = model.value!
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = gridFont(m.fontSize)
  for (let i = 0; i < m.placed.length; i++) {
    const p = m.placed[i]
    const ta = textAlpha(i)
    const ba = boxAlpha(i)
    if (ta <= 0.01 && ba <= 0.01) continue
    const type = m.types[p.typeId]
    const x = gx + p.col * m.cellW
    const y = GRID_Y + p.row * m.rowH
    const w = Math.max(2, p.span * m.cellW)

    if (ba > 0.01) {
      ctx.globalAlpha = ba * (type.count > 1 ? 0.42 : 0.14)
      ctx.fillStyle = type.count > 1 ? type.colour : colours.dim
      roundRect(ctx, x + 0.5, y + 1.5, w - 1, m.rowH - 3, 3)
      ctx.fill()
    }
    if (ta > 0.01) {
      ctx.globalAlpha = ta
      // Glyphs stay in the body colour whatever the box does: colouring 200 words as well
      // as their boxes made the paragraph unreadable from the back of a room.
      ctx.fillStyle = p.text === '\n' ? colours.border : colours.text
      ctx.fillText(p.text === '\n' ? '↵' : p.text, x + 1, y + m.rowH / 2, w - 2)
    }
  }
  ctx.globalAlpha = 1
}

function slotCentre(slot: number) {
  const col = slot % TABLE_COLS
  const row = Math.floor(slot / TABLE_COLS)
  return { x: TABLE_X + (col + 0.5) * SLOT_W, y: TABLE_Y + (row + 0.5) * SLOT_H }
}

function drawTable(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  for (const type of m.types) {
    if (type.slot < 0) continue
    const alpha = smoothstep(0.82, 1, flyers[type.id].t)
    if (alpha <= 0.01) continue
    drawEntry(ctx, type, alpha, codeReveal[type.id].a)
  }

  const spare = m.types.length - (TABLE_SLOTS - 1)
  if (spare > 0) {
    const { x, y } = slotCentre(TABLE_SLOTS - 1)
    const arrived = smoothstep(0.82, 1, flyers[TABLE_SLOTS - 1].t)
    ctx.globalAlpha = arrived
    ctx.fillStyle = colours.dim
    ctx.font = uiFont(26)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+ ${spare} rarer`, x, y - 16)
    ctx.fillText('tokens', x, y + 16)
    ctx.globalAlpha = 1
  }
}

function drawEntry(ctx: CanvasRenderingContext2D, type: TokenType, alpha: number, codeAlpha: number) {
  const sx = TABLE_X + (type.slot % TABLE_COLS) * SLOT_W
  const sy = TABLE_Y + Math.floor(type.slot / TABLE_COLS) * SLOT_H
  const chipW = SLOT_W - 108

  ctx.fillStyle = type.colour
  ctx.globalAlpha = alpha * (type.count > 1 ? 0.38 : 0.14)
  roundRect(ctx, sx + 8, sy + 8, chipW, 43, 7)
  ctx.fill()
  ctx.globalAlpha = alpha * (type.count > 1 ? 0.85 : 0.35)
  ctx.strokeStyle = type.colour
  ctx.lineWidth = 1.5
  roundRect(ctx, sx + 8.75, sy + 8.75, chipW - 1.5, 41.5, 7)
  ctx.stroke()

  ctx.globalAlpha = alpha
  ctx.fillStyle = colours.text
  ctx.font = gridFont(28)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(type.label, sx + 8 + chipW / 2, sy + 29, chipW - 14)

  ctx.fillStyle = colours.dim
  ctx.font = uiFont(25)
  ctx.textAlign = 'left'
  ctx.fillText(`×${type.count}`, sx + chipW + 20, sy + 29)

  if (codeAlpha > 0.01) {
    ctx.globalAlpha = alpha * codeAlpha
    ctx.fillStyle = colours.accent
    ctx.font = bitFont(30)
    ctx.fillText(type.code, sx + 10, sy + 74, SLOT_W - 24)
  }
  ctx.globalAlpha = 1
}

function bitPos(m: Model, bit: number) {
  const i = Math.min(bit, Math.max(0, m.ribbon.length - 1))
  const col = i % m.ribbonCols
  const row = Math.floor(i / m.ribbonCols)
  const adv = RIBBON_W / m.ribbonCols
  return { x: RIBBON_X + (col + 0.5) * adv, y: RIBBON_Y + (row + 0.5) * m.ribbonRowH }
}

function drawRibbon(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  const shown = Math.floor(anim.encode * m.ribbon.length)
  if (shown <= 0) return
  const adv = RIBBON_W / m.ribbonCols
  ctx.font = bitFont(RIBBON_FONT)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // Batched into same-colour runs within a row: a code is two to a dozen bits, so this
  // turns roughly a thousand fillText calls per frame into a couple of hundred.
  let i = 0
  while (i < shown) {
    const row = Math.floor(i / m.ribbonCols)
    const col = i % m.ribbonCols
    const colour = m.ribbon[i].colour
    let run = ''
    let j = i
    while (j < shown && Math.floor(j / m.ribbonCols) === row && m.ribbon[j].colour === colour) {
      run += m.ribbon[j].ch
      j++
    }
    ctx.fillStyle = colour
    ctx.fillText(run, RIBBON_X + col * adv, RIBBON_Y + (row + 0.5) * m.ribbonRowH)
    i = j
  }

  if (m.hidden > 0 && anim.encode > 0.98) {
    ctx.fillStyle = colours.dim
    ctx.font = uiFont(14)
    ctx.textAlign = 'right'
    ctx.fillText(`+ ${m.hidden.toLocaleString()} more bits`, RIBBON_X + RIBBON_W, RIBBON_Y + RIBBON_H + 6)
  }
}

/**
 * The ribbon, and one number under it.
 *
 * The badge used to arrive with a raw-versus-encoded bar pair and a line about amortising
 * the code table. All of it was true and none of it was readable at the back of a room,
 * and it argued with the headline rather than supporting it. The primer is still counted
 * — the HUD carries `overheadBits` as its own slice on every slide — so the pane can say
 * the one thing it is for.
 */
function drawCentre(ctx: CanvasRenderingContext2D) {
  panel(ctx, CENTRE_X, CENTRE_Y, CENTRE_W, CENTRE_H)
  drawRibbon(ctx)
  if (anim.badge <= 0.01) return

  const shown = 1 + (ratio.value - 1) * anim.badge
  ctx.globalAlpha = anim.badge
  ctx.fillStyle = colours.good
  ctx.font = uiFont(50, '700')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${shown.toFixed(1)}× smaller`, CENTRE_X + CENTRE_W / 2, BADGE_Y)
  ctx.globalAlpha = 1
}

/**
 * The round trip, asserted on the panel that has to prove it. Sits on the frame of the
 * decoded grid rather than above it, so the panels can start at the top of the stage.
 */
function drawVerdict(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  if (anim.decode <= 0.999) return
  const text = m.roundTrips ? '✓ identical' : '✗ mismatch'
  const colour = m.roundTrips ? colours.good : colours.warn
  ctx.font = uiFont(21, '600')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + 30
  const cx = RIGHT_X + PANEL - w / 2 - 14
  const cy = GRID_Y + PANEL - 4
  ctx.fillStyle = colours.panel
  roundRect(ctx, cx - w / 2, cy - 18, w, 36, 18)
  ctx.fill()
  ctx.strokeStyle = colour
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = colour
  ctx.fillText(text, cx, cy + 1)
}

/** A token in flight: the same chip the table will show, mid-journey. */
function drawFlyers(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of flyers) {
    const t = f.t
    if (t <= 0.001 || t >= 0.999) continue
    const dest = slotCentre(f.type.slot >= 0 ? f.type.slot : TABLE_SLOTS - 1)
    const x = lerp(f.type.fromX, dest.x, t)
    // A shallow rise, so the paths fan apart instead of stacking into one diagonal.
    const y = lerp(f.type.fromY, dest.y, t) - 46 * Math.sin(Math.PI * t)
    const alpha = 1 - smoothstep(0.85, 1, t)

    ctx.font = gridFont(22)
    const w = Math.min(220, ctx.measureText(f.type.label).width + 22)
    ctx.globalAlpha = alpha
    ctx.fillStyle = f.type.colour
    roundRect(ctx, x - w / 2, y - 17, w, 34, 6)
    ctx.fill()
    ctx.fillStyle = colours.panel
    ctx.fillText(f.type.label, x, y + 1, w - 8)
  }
  ctx.globalAlpha = 1
}

/**
 * Codes going the other way, turning back into text on the trip.
 *
 * Only a sample of the message flies — a sprite per token would be several hundred labels
 * on top of each other. The right-hand grid fills continuously underneath, and each
 * sprite is launched so that it lands on the beat its own cell appears.
 */
function drawDecoders(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const d of decoders) {
    const t = d.t
    if (t <= 0.001 || t >= 0.999) continue
    const type = m.types[d.p.typeId]
    const from = bitPos(m, d.p.bitAt)
    const to = {
      x: RIGHT_X + (d.p.col + d.p.span / 2) * m.cellW,
      y: GRID_Y + (d.p.row + 0.5) * m.rowH,
    }
    const x = lerp(from.x, to.x, t)
    const y = lerp(from.y, to.y, t) - 60 * Math.sin(Math.PI * t)
    const fade = Math.min(1, t / 0.12, (1 - t) / 0.12)
    const asCode = (1 - smoothstep(0.35, 0.6, t)) * fade
    const asText = smoothstep(0.4, 0.65, t) * fade

    if (asCode > 0.01) {
      ctx.globalAlpha = asCode
      ctx.fillStyle = colours.accent
      ctx.font = bitFont(20)
      ctx.fillText(type.code, x, y)
    }
    if (asText > 0.01) {
      ctx.globalAlpha = asText
      ctx.fillStyle = type.colour
      ctx.font = gridFont(22)
      ctx.fillText(type.label, x, y, 210)
    }
  }
  ctx.globalAlpha = 1
}

function draw() {
  const canvas = stageCanvas.value
  const m = model.value
  if (!canvas || !m) return
  if (!dirty && !playhead?.isActive() && !tl?.isActive()) return
  dirty = false
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  const total = m.placed.length
  const scanHead = anim.scan * total
  const decHead = anim.decode * total

  // Source panel: the text is always there; the boxes arrive with the scan.
  panel(ctx, LEFT_X, GRID_Y, PANEL, PANEL)
  drawGrid(ctx, LEFT_X, () => 1, i => Math.max(0, Math.min(1, scanHead - i)))

  if (anim.scan > 0.001 && anim.scan < 0.999) {
    const head = m.placed[Math.min(total - 1, Math.floor(scanHead))]
    ctx.fillStyle = colours.accent
    ctx.fillRect(LEFT_X + head.col * m.cellW - 1, GRID_Y + head.row * m.rowH + 1, 2, m.rowH - 2)
  }

  panel(ctx, RIGHT_X, GRID_Y, PANEL, PANEL)
  drawGrid(ctx, RIGHT_X,
    i => Math.max(0, Math.min(1, decHead - i)),
    i => Math.max(0, Math.min(1, decHead - i)))

  drawCentre(ctx)
  drawTable(ctx)
  drawFlyers(ctx)
  drawDecoders(ctx)
  drawVerdict(ctx)
}

// --- Wiring ----------------------------------------------------------------------

/** Cleared on unmount, so a font that loads late cannot resurrect a dead timeline. */
let alive = true

function rebuild() {
  if (!alive) return
  rebuildModel()
  buildTimeline()
  dirty = true
}

watch(sample, rebuild)
watch(() => deck.fragment.value, n => {
  const target = Math.max(0, Math.min(STAGES.length - 1, n))
  if (target === stage.value) return
  stage.value = target
  goToStage(target)
})
watch(() => deck.learnMode.value, on => {
  if (!on) return
  stage.value = STAGES.length - 1
  goToStage(STAGES.length - 1)
})

onMounted(() => {
  readColours()
  const canvas = stageCanvas.value
  if (canvas) {
    canvas.width = STAGE_W
    canvas.height = STAGE_H
    resizeCanvas()
    observer = new ResizeObserver(resizeCanvas)
    observer.observe(canvas)
  }
  rebuild()
  // Grid metrics come from measureText, so a font arriving late would leave the layout
  // fitted to the fallback. Cheap to redo once.
  document.fonts?.ready?.then(rebuild)
  gsap.ticker.add(draw)
})

onUnmounted(() => {
  alive = false
  gsap.ticker.remove(draw)
  observer?.disconnect()
  playhead?.kill()
  tl?.kill()
})
</script>

<template>
  <SlideLayout column>
    <div class="huff">
      <div class="stage-wrap">
        <canvas ref="stageCanvas" />
      </div>

      <div class="controls">
        <div class="picker">
          <!-- What this text is and what a symbol is for it: the only two captions the
               stage was carrying that said anything, so they live over the picker that
               changes them. -->
          <span class="desc">{{ sample.credit }} · by {{ sample.unit }}</span>
          <div class="group">
            <button
              v-for="s in SAMPLE_TEXTS" :key="s.id"
              class="seg" :class="{ on: sampleId === s.id }"
              @click="sampleId = s.id"
            >{{ s.label }}</button>
          </div>
        </div>

        <div class="group">
          <!-- Picking a state plays the animation to it, in whichever direction; the
               arrow keys drive the same thing through the deck's fragment. -->
          <button
            v-for="(name, i) in STAGE_NAMES" :key="i"
            class="seg" :class="{ on: stage === i }"
            @click="selectStage(i)"
          >{{ name }}</button>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.huff {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* Gives the canvas a definite box to fit inside. With `max-width` and `max-height` both
   at 100% the canvas scales to fill whichever dimension binds first and keeps its aspect,
   so no space is left over on either axis. */
.stage-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.controls {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem 1.2rem;
  color: var(--text-secondary);
}

.controls > * {
  white-space: nowrap;
}

/*
 * The description sits above the buttons that change it — and must never be the reason
 * the control row wraps. `min-width: 0` lets the column shrink to its button group, and
 * the label ellipsises into whatever is left; a wrap here costs a whole line of canvas
 * height, which is far more than the tail of a credit is worth.
 */
.picker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-width: 0;
}

.desc {
  font-size: 0.56rem;
  font-style: italic;
  padding-left: 0.1rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Segmented group: one control with several states, rather than several buttons. */
.group {
  display: flex;
  flex: none;
}

/* Natural widths, not six equal columns: equalising them to the longest label cost about
   90px, which is the difference between one row and two on a laptop. */
.seg {
  padding: 0.22rem 0.6rem;
  font-size: 0.66rem;
  border-radius: 0;
  border-right-width: 0;
}

.seg:first-child {
  border-radius: 4px 0 0 4px;
}

.seg:last-child {
  border-radius: 0 4px 4px 0;
  border-right-width: 1px;
}

.seg.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
