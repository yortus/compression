<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { useDeck } from '../../deck/useDeck'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { inverseDCT } from '../../engine/jpeg/dct'
import { scaleQTable, LUMA_TABLE } from '../../engine/jpeg/quantization'
import { ZIGZAG_ORDER, zigzagIndex } from '../../engine/jpeg/zigzag'
import type { Block } from '../../engine/jpeg/types'
import { paintBlock8 as paintBlock, writeShade, fillBlock8 } from '../../rendering/shade'
import { useStat } from '../../stats/useStats'

/**
 * The transform as a round trip you can watch: a block flies apart into the 64 patterns
 * it is made of, quantisation throws most of them away, and the survivors fly back
 * together into a picture that is nearly the one we started with.
 *
 * Three decisions worth knowing about, because the obvious versions are wrong:
 *
 * **The reconstruction is computed, not blended.** Adding sprites together with an
 * additive blend mode looks like superposition and is not: coefficients are signed, and
 * roughly half of them subtract. A glowing pile of `lighter`-blended tiles would be a
 * very convincing lie. So the flying tiles are narrative, and the panel they land in runs
 * a real inverse DCT over the coefficients that have arrived so far — weighted by each
 * sprite's own `merge` value, which means every intermediate frame is a true partial
 * reconstruction and the final frame is exactly what a JPEG decoder would produce. The
 * additive pass is kept only as a bloom during flight, where it suggests summation
 * without claiming to perform it.
 *
 * **Each tile is its own contribution, obtained the same way.** Rather than drawing a
 * scaled cosine and hoping it matches, a tile is `inverseDCT` of a block containing only
 * that one coefficient. So the tiles are literally the terms of the sum being animated,
 * and cannot drift out of agreement with the result.
 *
 * **Plain 2D canvas, not Pixi.** Sixty-four 8x8 sprites is nothing, everything needed
 * here (position, scale, alpha, additive blending) exists in 2D canvas, and the rest of
 * the deck is 2D canvas — introducing a WebGL scene graph would be a second rendering
 * model for one slide. GSAP still does the tweening, on plain objects the draw loop
 * reads.
 */

const pipeline = inject(PIPELINE_KEY)!
const deck = useDeck()

// --- Stage geometry, in canvas logical units ---------------------------------

const STAGE_W = 1100
const STAGE_H = 560
const TILE = 50
const GAP = 6
const GRID_SPAN = TILE * 8 + GAP * 7
const GRID_X = 315
const GRID_Y = 58
const CY = GRID_Y + GRID_SPAN / 2
const STATION = 170
const SRC_X = 40
const RECON_X = 880

// Cell coordinates are centres: sprites are drawn around their own centre so that scaling
// a tile grows it from the middle rather than from a corner.
function cellX(v: number) { return GRID_X + v * (TILE + GAP) + TILE / 2 }
function cellY(u: number) { return GRID_Y + u * (TILE + GAP) + TILE / 2 }

// --- Coefficients -------------------------------------------------------------

const qTable = computed(() => scaleQTable(LUMA_TABLE, pipeline.quality.value))

/** What the decoder actually receives: quantised integers multiplied back up. */
const dequantised = computed<Block | null>(() => {
  const q = pipeline.selectedQuantized.value
  const t = qTable.value
  if (!q) return null
  return q.map((row, u) => row.map((val, v) => val * t[u][v]))
})

/** Which coefficients survived quantisation — the animation's middle act. */
const survivors = computed<boolean[]>(() => {
  const q = pipeline.selectedQuantized.value
  const out = new Array<boolean>(64).fill(false)
  if (!q) return out
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) out[u * 8 + v] = q[u][v] !== 0
  return out
})

const keptCount = computed(() => survivors.value.filter(Boolean).length)

function reconstructFrom(weights: (i: number) => number): Block | null {
  const d = dequantised.value
  if (!d) return null
  const partial: Block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) partial[u][v] = d[u][v] * weights(u * 8 + v)
  }
  return inverseDCT(partial)
}

/** The finished reconstruction, for the readouts — not the per-frame animated one. */
const finalRecon = computed(() => reconstructFrom(() => 1))

const maxError = computed(() => {
  const original = pipeline.selectedBlock.value
  const recon = finalRecon.value
  if (!original || !recon) return 0
  let m = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) m = Math.max(m, Math.abs(original[r][c] - recon[r][c]))
  }
  return m
})

useStat('basis-64', () => {
  if (!dequantised.value) return null
  return {
    label: `${keptCount.value} of 64 patterns · block ${pipeline.selectedBlockIndex.value}`,
    rawBits: 64 * 8,
    encodedBits: keptCount.value * 8,
    // Nothing counted here, deliberately. Saying *which* coefficients survived is a real
    // cost, but it is not a flat one, and an earlier version of this slide priced it as
    // 6 bits for a zigzag prefix against 64 for an arbitrary set — a model the `zigzag`
    // slide then contradicts, having measured that JPEG spends nothing on positions
    // beyond the run lengths it was already emitting. This slide does not model it; the
    // next two are about exactly that.
    overheadBits: 0,
    lossy: maxError.value > 0,
    note: maxError.value > 0 ? `max pixel error ${Math.round(maxError.value)}/255` : 'exact',
  }
})

// --- Sprites ------------------------------------------------------------------

interface Sprite {
  i: number
  u: number
  v: number
  /** Position in the zigzag, used to stagger everything coarse-to-fine. */
  zig: number
  /** Home in the grid: animated during the explode, static afterwards. */
  gx: number
  gy: number
  gsize: number
  galpha: number
  /** 0 while parked, 1 on arrival — drives the bloom during the journey. */
  flight: number
  /** How much of this coefficient has arrived, 0 to 1. Drives the real maths. */
  merge: number
  /** 0 before quantisation, 1 after — crossfades the tile between the two versions. */
  quantMix: number
}

const sprites: Sprite[] = []
for (let u = 0; u < 8; u++) {
  for (let v = 0; v < 8; v++) {
    sprites.push({
      i: u * 8 + v, u, v, zig: zigzagIndex(u, v),
      gx: cellX(v), gy: cellY(u), gsize: TILE, galpha: 1,
      flight: 0, merge: 1, quantMix: 1,
    })
  }
}

/**
 * Two 8x8 offscreen canvases per pattern: its contribution before quantisation and after.
 *
 * The grid crossfades between them during the middle act, and that crossfade is the act.
 * Straight off the forward DCT every one of the 64 coefficients is non-zero and every
 * tile has something in it; after quantisation most are exactly zero and their tiles are
 * blank. Drawing only the post-quantisation set — which the first version did — meant the
 * quantise phase dimmed sixty squares that were already empty, and looked like nothing
 * happening.
 */
function makeTiles() {
  return sprites.map(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    return c
  })
}
const tileCanvases: HTMLCanvasElement[] = makeTiles()
const quantTileCanvases: HTMLCanvasElement[] = makeTiles()
/** One coefficient on its own, inverse-transformed: literally one term of the sum. */
function contributionOf(coeffs: Block, u: number, v: number): Block {
  const only: Block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  only[u][v] = coeffs[u][v]
  return inverseDCT(only)
}

/**
 * Display gain for the contribution tiles.
 *
 * Truthfully drawn, every pattern but the first few is a flat square — their
 * contributions really are that small, which is the lesson, and also makes 60 of the 64
 * tiles invisible. One gain applied to all of them preserves their sizes *relative to
 * each other* exactly, so the picture stays honest; it is a contrast control, not a
 * rescaling of individual tiles, and the canvas says what it is set to.
 *
 * The DC term is exempt: it is the block's average brightness rather than a wiggle about
 * it, and its true value is worth seeing. This is separate from the display contrast in
 * `rendering/shade.ts`, which is a look; this one is about legibility of tiny numbers.
 */
const gain = ref(1)

function renderTiles() {
  const dq = dequantised.value
  const raw = pipeline.selectedDCT.value
  if (!dq || !raw) return

  const before = sprites.map(s => contributionOf(raw, s.u, s.v))
  const after = sprites.map(s => contributionOf(dq, s.u, s.v))

  // Set from the pre-quantisation set, which is the larger of the two, and applied to
  // both so the crossfade compares like with like.
  let maxAc = 1e-6
  for (const s of sprites) {
    if (s.i === 0) continue
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) maxAc = Math.max(maxAc, Math.abs(before[s.i][r][c] - 128))
    }
  }
  gain.value = Math.max(1, Math.min(16, 100 / maxAc))

  for (const s of sprites) {
    const g = s.i === 0 ? 1 : gain.value
    const lift = (b: Block) => b.map(row => row.map(v => 128 + (v - 128) * g))
    paintBlock(tileCanvases[s.i], lift(before[s.i]))
    paintBlock(quantTileCanvases[s.i], lift(after[s.i]))
  }
}

/**
 * Nobody has picked a block yet, so pick a good one.
 *
 * Block 0 is the top-left corner, which on most photographs is flat sky or shadow — the
 * one block where this slide has nothing to show. Only fires while the selection is still
 * the untouched default, so it never overrides a presenter's choice.
 */
function pickInterestingBlock() {
  const dct = pipeline.dctBlocks.value
  if (!dct || pipeline.selectedBlockIndex.value !== 0) return
  const energy = dct.y.blocks.map((b, i) => {
    let e = 0
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) if (u || v) e += b[u][v] * b[u][v]
    }
    return { i, e }
  })
  if (!energy.length) return
  // Blank blocks are excluded before ranking, not just ranked low. The pixel-art sample is
  // about nine tenths white background, so a plain 80th percentile over every block still
  // lands on empty space.
  const lively = energy.filter(e => e.e > 50)
  const pool = lively.length ? lively : energy
  pool.sort((a, b) => a.e - b.e)
  // The 80th percentile of those rather than the maximum: plenty of detail, without the
  // freak block whose coefficients are all enormous.
  pipeline.selectedBlockIndex.value = pool[Math.floor(pool.length * 0.8)].i
}

// --- Timeline -----------------------------------------------------------------

/**
 * Timeline shape, as constants, because the label positions have to be derived from them.
 *
 * Hardcoding `done` at 4.4s was wrong: the last implode starts at 2.75 + 63 x 0.014 and
 * runs for 1.05, finishing at 4.68. Any block whose surviving coefficients reach far
 * enough along the zigzag was therefore declared finished while several patterns were
 * still in flight — the reconstruction was genuinely incomplete, and the leftover flyers
 * sat on top of the panel. It only showed on busy blocks, because a photo at Q50 keeps
 * nine coefficients and they are all near the front of the scan.
 */
const EXPLODE_DUR = 0.85
const EXPLODE_STAGGER = 0.011
const QUANT_AT = 1.75
const QUANT_DUR = 0.45
const QUANT_STAGGER = 0.005
const IMPLODE_AT = 2.75
const IMPLODE_DUR = 1.05
const IMPLODE_STAGGER = 0.014
/** A beat after the last tween of each phase, so a phase is never entered early. */
const GRID_LABEL = 63 * EXPLODE_STAGGER + EXPLODE_DUR + 0.2
const QUANT_LABEL = IMPLODE_AT
const DONE_LABEL = IMPLODE_AT + 63 * IMPLODE_STAGGER + IMPLODE_DUR + 0.1

const STAGES = ['start', 'grid', 'quantised', 'done'] as const
/**
 * The four states, named twice.
 *
 * The buttons say pixels / waves / waves / pixels, which makes the round trip obvious at
 * a glance — same picture, two representations, out and back. The two brackets beneath
 * carry the other half of the meaning: the boundary between them is exactly where
 * quantisation throws information away, so everything left of it is still reversible.
 *
 * The duplicate button labels are the point, but they would make a useless status
 * readout, so the corner of the stage gets its own unambiguous wording.
 */
const STAGE_NAMES = ['Pixels', 'Waves', 'Waves', 'Pixels'] as const
const PHASE_NAMES = ['pixels', 'all 64 waves', 'the waves that survived', 'pixels rebuilt'] as const

let tl: gsap.core.Timeline | null = null
/** The tween that moves the playhead, kept so a second click can cancel the first. */
let playhead: gsap.core.Tween | null = null

/**
 * Which of the four states we are heading for.
 *
 * Driven from two places that have to agree: the buttons under the stage, and the arrow
 * keys, which move the deck's fragment like on every other slide. The buttons write the
 * fragment back so a presenter can mix the two freely.
 */
const stage = ref(deck.learnMode.value ? 3 : Math.min(3, deck.fragment.value))

function buildTimeline() {
  tl?.kill()
  const surv = survivors.value

  for (const s of sprites) {
    s.gx = cellX(s.v); s.gy = cellY(s.u); s.gsize = TILE; s.galpha = 1
    s.flight = 0; s.merge = 1; s.quantMix = 1
  }

  tl = gsap.timeline({ paused: true })
  // Every entry in STAGES must exist as a label: GSAP resolves an unknown label to the
  // end of the timeline rather than failing, which is silent and very confusing.
  tl.addLabel('start', 0)

  // Explode: the forward transform. Everything starts stacked on the source block.
  for (const s of sprites) {
    tl.fromTo(s,
      { gx: SRC_X + STATION / 2, gy: CY, gsize: STATION / 8, galpha: 0, merge: 0, quantMix: 0, flight: 0 },
      { gx: cellX(s.v), gy: cellY(s.u), gsize: TILE, galpha: 1, duration: EXPLODE_DUR, ease: 'power2.out' },
      s.zig * EXPLODE_STAGGER)
  }
  tl.addLabel('grid', GRID_LABEL)

  // Quantise: every tile crossfades to its post-quantisation self, which for most of
  // them means emptying out, and the discarded ones then dim and stay behind.
  for (const s of sprites) {
    tl.to(s, { quantMix: 1, duration: QUANT_DUR, ease: 'power1.inOut' }, QUANT_AT + s.zig * QUANT_STAGGER)
    if (!surv[s.i]) {
      tl.to(s, { galpha: 0.12, duration: QUANT_DUR, ease: 'power1.in' }, QUANT_AT + 0.1 + s.zig * QUANT_STAGGER)
    }
  }
  tl.addLabel('quantised', QUANT_LABEL)

  // Implode: the inverse transform. The tiles themselves make the journey rather than
  // sending a copy, so the grid empties as they go — the mirror of the explode, where they
  // came out of the block. Cloning them left the grid looking untouched, as though the
  // coefficients had been used without being spent.
  for (const s of sprites) {
    if (surv[s.i]) {
      tl.to(s, {
        gx: RECON_X + STATION / 2, gy: CY, gsize: STATION, galpha: 0, merge: 1, flight: 1,
        duration: IMPLODE_DUR, ease: 'power2.inOut',
      }, IMPLODE_AT + s.zig * IMPLODE_STAGGER)
    } else {
      // Discarded patterns are not spent on anything, so they simply go out. Their merge
      // still reaches 1 so that clicking one back on afterwards does something.
      tl.to(s, { galpha: 0, duration: IMPLODE_DUR * 0.6, ease: 'power1.in' }, IMPLODE_AT)
      tl.to(s, { merge: 1, duration: 0.01 }, IMPLODE_AT)
    }
  }
  tl.addLabel('done', DONE_LABEL)
  // Something has to occupy the final instant or the timeline ends before the label.
  tl.to({}, { duration: 0.01 }, DONE_LABEL)

  goToStage(stage.value, true)
}

function goToStage(n: number, instant = false) {
  if (!tl) return
  playhead?.kill()
  playhead = null
  const label = STAGES[Math.max(0, Math.min(3, n))]
  // No duration given, so GSAP moves the playhead at natural speed: picking a state
  // *plays* the animation from wherever it is to that state, forwards or backwards.
  if (instant) tl.seek(label)
  else playhead = tl.tweenTo(label)
}

function selectStage(n: number) {
  const target = Math.max(0, Math.min(3, n))
  // Picking the state you are already in replays the step that got you there, which is
  // what the play button used to be for.
  if (target === stage.value && target > 0 && tl) tl.seek(STAGES[target - 1])
  stage.value = target
  if (!deck.learnMode.value) deck.fragment.value = target
  goToStage(target)
}

// --- Drawing ------------------------------------------------------------------

const stageCanvas = ref<HTMLCanvasElement>()

/**
 * Device pixels per logical unit.
 *
 * The stage is authored in a fixed 1100x560 coordinate system, but CSS shows it at
 * whatever width is left over — around 775px. Leaving the backing store at 1100 meant the
 * browser resampled the entire canvas down by 0.7 on every frame, smoothly, and no amount
 * of `imageSmoothingEnabled = false` prevents that: the flag governs drawing *into* a
 * canvas, not the scaling *of* one. Everything on the stage was being softened, which is
 * most obvious on an 8x8 block of pixel art.
 *
 * So the backing store is sized to the real display size and the context is scaled to
 * match, leaving the drawing code in logical units.
 */
let scale = 1

function resizeCanvas() {
  const canvas = stageCanvas.value
  if (!canvas) return
  const width = canvas.getBoundingClientRect().width
  if (!width) return
  const next = (width * (window.devicePixelRatio || 1)) / STAGE_W
  if (Math.abs(next - scale) < 0.001) return
  scale = next
  // Both dimensions scale together, so the intrinsic aspect ratio — and therefore the
  // laid-out size — does not change, and this cannot feed back into the observer.
  canvas.width = Math.round(STAGE_W * scale)
  canvas.height = Math.round(STAGE_H * scale)
}

let observer: ResizeObserver | null = null

let colours = { bg: '#14141f', border: '#2a2a3a', text: '#e0e0e8', dim: '#8888a0', accent: '#6c8cff', good: '#4ade80' }

function readColours() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  colours = {
    bg: v('--bg-surface', '#14141f'),
    border: v('--border', '#2a2a3a'),
    text: v('--text', '#e0e0e8'),
    dim: v('--text-secondary', '#8888a0'),
    accent: v('--accent', '#6c8cff'),
    good: v('--positive', '#4ade80'),
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour = colours.dim, size = 15) {
  ctx.fillStyle = colour
  ctx.font = `${size}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, text: string) {
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2 - 8, y)
  ctx.stroke()
  ctx.fillStyle = colours.border
  ctx.beginPath()
  ctx.moveTo(x2, y); ctx.lineTo(x2 - 10, y - 6); ctx.lineTo(x2 - 10, y + 6)
  ctx.closePath(); ctx.fill()
  label(ctx, text, (x1 + x2) / 2, y - 18, colours.dim, 13)
}

/** Where the playhead actually is, which is not the same as which fragment is showing. */
function phaseName() {
  if (!tl) return PHASE_NAMES[0]
  const t = tl.time()
  const l = tl.labels
  if (t >= l.done - 0.01) return PHASE_NAMES[3]
  if (t > l.quantised) return 'reassembling'
  if (t >= l.quantised - 0.01) return PHASE_NAMES[2]
  if (t > l.grid) return 'quantising'
  if (t >= l.grid - 0.01) return PHASE_NAMES[1]
  if (t > 0.01) return 'transforming'
  return PHASE_NAMES[0]
}

function draw() {
  const canvas = stageCanvas.value
  if (!canvas || !dequantised.value) return
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  // Empty grid cells, so the destination is visible before anything arrives.
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 1
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      ctx.strokeRect(cellX(v) - TILE / 2 + 0.5, cellY(u) - TILE / 2 + 0.5, TILE - 1, TILE - 1)
    }
  }

  // The two 8x8 panels are drawn cell by cell in device pixels rather than by scaling an
  // 8x8 canvas up: 170 does not divide by 8, so drawImage would band them.
  const block = pipeline.selectedBlock.value
  // Discarded coefficients are zero, so they contribute nothing whatever their weight.
  const recon = reconstructFrom(i => sprites[i].merge)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const panel = STATION * scale
  if (block) fillBlock8(ctx, block, SRC_X * scale, (CY - STATION / 2) * scale, panel)
  if (recon) fillBlock8(ctx, recon, RECON_X * scale, (CY - STATION / 2) * scale, panel)
  ctx.restore()

  ctx.strokeStyle = colours.border
  ctx.strokeRect(SRC_X + 0.5, CY - STATION / 2 + 0.5, STATION - 1, STATION - 1)
  ctx.strokeRect(RECON_X + 0.5, CY - STATION / 2 + 0.5, STATION - 1, STATION - 1)

  ctx.textAlign = 'left'
  ctx.fillStyle = colours.accent
  ctx.font = '600 13px Inter, system-ui, sans-serif'
  ctx.fillText(phaseName().toUpperCase(), 16, 20)

  arrow(ctx, SRC_X + STATION + 14, GRID_X - 12, CY, 'forward DCT')
  arrow(ctx, GRID_X + GRID_SPAN + 12, RECON_X - 14, CY, 'inverse DCT')

  label(ctx, 'the block', SRC_X + STATION / 2, CY - STATION / 2 - 20, colours.text)
  label(ctx, '64 coefficients', GRID_X + GRID_SPAN / 2, GRID_Y - 22, colours.text)
  label(ctx, 'what comes back', RECON_X + STATION / 2, CY - STATION / 2 - 20, colours.text)
  label(ctx, `${keptCount.value} of 64 kept`, GRID_X + GRID_SPAN / 2, GRID_Y + GRID_SPAN + 22, colours.good, 13)
  if (gain.value > 1.05) {
    label(ctx, `fine patterns shown at ×${gain.value.toFixed(1)} contrast`,
      GRID_X + GRID_SPAN / 2, GRID_Y + GRID_SPAN + 40, colours.dim, 11)
  }

  // Grid tiles, crossfaded between their before- and after-quantisation versions. During
  // the implode these are the same objects, in flight towards the reconstruction.
  for (const s of sprites) {
    // Once quantisation has run, mark the cells whose patterns are in play. The marker
    // stays on the cell while the tile leaves it, so the grid still says what went.
    if (s.quantMix > 0.5 && survivors.value[s.i]) {
      ctx.strokeStyle = colours.accent
      ctx.lineWidth = 1.5
      ctx.strokeRect(cellX(s.v) - TILE / 2, cellY(s.u) - TILE / 2, TILE, TILE)
    }

    if (s.galpha <= 0.01) continue
    const x = s.gx - s.gsize / 2
    const y = s.gy - s.gsize / 2
    const visible = s.galpha

    if (s.quantMix < 0.99) {
      ctx.globalAlpha = visible * (1 - s.quantMix)
      ctx.drawImage(tileCanvases[s.i], x, y, s.gsize, s.gsize)
    }
    if (s.quantMix > 0.01) {
      ctx.globalAlpha = visible * s.quantMix
      ctx.drawImage(quantTileCanvases[s.i], x, y, s.gsize, s.gsize)
    }

    // A bloom while in transit, brightest mid-journey. It suggests summation; it does not
    // perform it — the reconstruction panel above is where the arithmetic happens.
    if (s.flight > 0.01 && s.flight < 0.99) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = Math.sin(s.flight * Math.PI) * 0.35
      ctx.drawImage(quantTileCanvases[s.i], x, y, s.gsize, s.gsize)
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = 1
  }
}

// --- Block picker -------------------------------------------------------------

const pickerCanvas = ref<HTMLCanvasElement>()

const blocksPerRow = computed(() => pipeline.allBlocks.value?.y.blocksPerRow ?? 0)
const blockCount = computed(() => pipeline.allBlocks.value?.y.blocks.length ?? 0)

function drawPicker() {
  const ycbcr = pipeline.ycbcr.value
  const canvas = pickerCanvas.value
  if (!ycbcr || !canvas) return
  const { y, width, height } = ycbcr
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // Same tint and contrast as the panels and tiles, rather than the engine's greyscale.
  const img = ctx.createImageData(width, height)
  for (let i = 0; i < width * height; i++) writeShade(img.data, i * 4, y[i])
  ctx.putImageData(img, 0, 0)

  ctx.strokeStyle = 'rgba(108, 140, 255, 0.18)'
  ctx.lineWidth = 1
  for (let x = 0; x <= width; x += 8) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke()
  }
  for (let yy = 0; yy <= height; yy += 8) {
    ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(width, yy + 0.5); ctx.stroke()
  }

  const per = blocksPerRow.value
  if (!per) return
  const i = pipeline.selectedBlockIndex.value
  const bx = (i % per) * 8
  const by = Math.floor(i / per) * 8
  // Two strokes so the marker reads against both light and dark image areas.
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 4
  ctx.strokeRect(bx - 1, by - 1, 10, 10)
  ctx.strokeStyle = colours.accent
  ctx.lineWidth = 2
  ctx.strokeRect(bx - 1, by - 1, 10, 10)
}

function pickBlock(e: MouseEvent) {
  const canvas = pickerCanvas.value
  const per = blocksPerRow.value
  if (!canvas || !per) return
  const rect = canvas.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height
  const index = Math.floor(py / 8) * per + Math.floor(px / 8)
  if (index >= 0 && index < blockCount.value) pipeline.selectedBlockIndex.value = index
}

// --- Wiring -------------------------------------------------------------------

function rebuild() {
  renderTiles()
  buildTimeline()
  nextTick(drawPicker)
}

watch([() => pipeline.selectedBlockIndex.value, dequantised], rebuild)
watch(() => pipeline.ycbcr.value, () => nextTick(drawPicker))
// Loading an image resets the selection to block 0, which on the pixel-art sample is
// blank background — the one block with nothing to show.
watch(() => pipeline.sourceImageData.value, () => pickInterestingBlock())
// Arrow keys move the deck's fragment; mirror that onto the stage without looping back.
watch(() => deck.fragment.value, n => {
  const target = Math.max(0, Math.min(3, n))
  if (target === stage.value) return
  stage.value = target
  goToStage(target)
})
watch(() => deck.learnMode.value, on => {
  if (!on) return
  stage.value = 3
  goToStage(3)
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
  pickInterestingBlock()
  rebuild()
  gsap.ticker.add(draw)
})

onUnmounted(() => {
  gsap.ticker.remove(draw)
  observer?.disconnect()
  tl?.kill()
})

</script>

<template>
  <SlideLayout>
    <div class="basis">
      <div class="picker">
        <h3>Pick a block</h3>
        <canvas ref="pickerCanvas" v-loupe @click="pickBlock" />
        <p class="hint">
          block {{ pipeline.selectedBlockIndex.value }}<template v-if="blockCount">/{{ blockCount - 1 }}</template>
          · click anywhere on the image
        </p>
      </div>

      <div class="stage">
        <div class="stage-inner">
          <canvas ref="stageCanvas" />

          <div class="controls">
            <!-- Picking a state plays the animation to it, in whichever direction.
                 Keyed by index, not by name: two of the four labels are the same word. -->
            <div class="stages">
              <div class="stage-row">
                <button
                  v-for="(name, i) in STAGE_NAMES" :key="i"
                  class="stage-btn" :class="{ on: stage === i }"
                  @click="selectStage(i)"
                >{{ name }}</button>
              </div>
              <div class="brackets">
                <span class="bracket">original</span>
                <span class="bracket">compressed</span>
              </div>
            </div>

            <span class="err" :class="maxError === 0 ? 'good' : 'warn'">max error {{ Math.round(maxError) }}/255</span>

          </div>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.basis {
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr);
  gap: 1.4rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  align-items: center;
}

.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

h3 {
  font-size: 0.6rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.picker canvas {
  max-width: 100%;
  max-height: 46vh;
  border-radius: 4px;
  cursor: crosshair;
}

.hint {
  font-size: 0.55rem;
  color: var(--text-secondary);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.stage {
  display: flex;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

/* Shrink-wraps the canvas so the control row lines up under it rather than centring
   itself on the whole column. */
.stage-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  min-height: 0;
}

.stage canvas {
  max-width: 100%;
  max-height: 54vh;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.58rem;
  color: var(--text-secondary);
}

/* Nothing in this row may wrap mid-label — a squeezed flex item shreds into one word
   per line rather than simply moving to the next row. */
.controls > * {
  white-space: nowrap;
}

.chip {
  padding: 0.16rem 0.45rem;
  font-size: 0.56rem;
  border-radius: 4px;
}

/* Segmented group: one control with four states, rather than four separate buttons. */
.stages {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* Equal columns so the two brackets below line up with two buttons each — the labels
   are different lengths and would otherwise drift out of register. */
.stage-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.brackets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.bracket {
  position: relative;
  padding-top: 0.42rem;
  text-align: center;
  font-size: 0.5rem;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

/* A downward brace under each pair: ticks rising towards the buttons it groups. */
.bracket::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 0.26rem;
  /* --border is almost invisible at this size; tie the brace to the label instead. */
  border: 1px solid currentColor;
  border-top: none;
  opacity: 0.55;
}

.stage-btn {
  padding: 0.18rem 0.5rem;
  font-size: 0.56rem;
  border-radius: 0;
  border-right-width: 0;
}

.stage-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.stage-btn:last-child {
  border-radius: 0 4px 4px 0;
  border-right-width: 1px;
}

.stage-btn.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}


.err {
  font-variant-numeric: tabular-nums;
  min-width: 7rem;
}

.err.good { color: var(--positive); }
.err.warn { color: var(--warning); }
</style>
