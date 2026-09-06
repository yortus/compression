<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { usePhaseStage } from '../../deck/usePhaseStage'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { inverseDCT } from '../../engine/jpeg/dct'
import { scaleQTable, LUMA_TABLE } from '../../engine/jpeg/quantization'
import { ZIGZAG_ORDER, zigzagIndex } from '../../engine/jpeg/zigzag'
import type { Block } from '../../engine/jpeg/types'
import { paintBlock8 as paintBlock, writeShade, fillBlock8 } from '../../rendering/shade'
import { drawStamp, stampBounds } from '../../rendering/stamp'
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

// --- Stage geometry, in canvas logical units ---------------------------------

/**
 * 1.55:1, and the canvas is told to fill the column it sits in rather than being capped
 * at a fraction of the viewport.
 *
 * The old stage was 1.96:1 pinned to `54vh`, which is nearly two to one dropped into a
 * box nearer three to two: about 230px of the slide area went unused every time, and the
 * tiles paid for it. Everything on this stage is square and laid out in a row, so the
 * composition wants to be wide; the fix is to meet the box most of the way and spend the
 * rest on margin, not to leave it outside the canvas where it does nothing.
 *
 * The horizontal budget is the binding constraint — two stations, two arrow runs and the
 * grid have to share 1320 units — so the station and tile sizes below are a split of it
 * rather than independent choices. Changing one means changing another.
 */
/** Both divide by 8, so a cell is a whole number of pixels wide — see CLAUDE.md. */
const TILE = 80
const GAP = 8
const GRID_SPAN = TILE * 8 + GAP * 7
const STATION = 200
const MARGIN = 16
/**
 * Wide enough for a bold arrow and nothing else. It used to carry "forward DCT" and
 * "inverse DCT" above it, which set a floor of about 90 units on the run; without the
 * words the row packs tighter, and since tile size is `column width / STAGE_W * TILE`,
 * every unit taken out of the packing comes back as a bigger tile.
 */
const ARROW_RUN = 76
const SRC_X = MARGIN
const GRID_X = SRC_X + STATION + ARROW_RUN
const RECON_X = GRID_X + GRID_SPAN + ARROW_RUN
const STAGE_W = RECON_X + STATION + MARGIN
/** Aspect between the box a laptop offers and the one a 1080p projector does. */
const STAGE_H = 832
/** Nothing above or below the row any more, so it simply sits in the middle. */
const GRID_Y = (STAGE_H - GRID_SPAN) / 2
const CY = GRID_Y + GRID_SPAN / 2

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
 * The stage used to carry an unambiguous restatement of the current state in its top
 * corner, because two of the four labels are the same word. It is gone: the lit button
 * and the picture below it already say where the animation is, and a caption that
 * changes on every step is the kind of thing an audience reads instead of watching.
 */
const STAGE_NAMES = ['Pixels', 'Waves', 'Waves', 'Pixels'] as const

function build() {
  const surv = survivors.value

  for (const s of sprites) {
    s.gx = cellX(s.v); s.gy = cellY(s.u); s.gsize = TILE; s.galpha = 1
    s.flight = 0; s.merge = 1; s.quantMix = 1
  }

  const tl = gsap.timeline({ paused: true })
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
  return tl
}

// --- Drawing ------------------------------------------------------------------

let colours = {
  bg: '#14141f', border: '#2a2a3a', text: '#e0e0e8',
  dim: '#8888a0', accent: '#6c8cff', good: '#4ade80', warn: '#fbbf24',
}

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
    warn: v('--warning', '#fbbf24'),
  }
}

/**
 * The forward and inverse transforms, as shape rather than as words.
 *
 * They were labelled, in 13px grey, which is unreadable from a room and was the only
 * reason the arrow runs had to be 90 units wide. A heavy accent chevron says "this way,
 * and this is the move" at a glance, and the slide's title says which move it is.
 */
function arrow(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  const HEAD = 26
  ctx.strokeStyle = colours.accent
  ctx.lineWidth = 9
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2 - HEAD + 2, y)
  ctx.stroke()
  ctx.fillStyle = colours.accent
  ctx.beginPath()
  ctx.moveTo(x2, y); ctx.lineTo(x2 - HEAD, y - 15); ctx.lineTo(x2 - HEAD, y + 15)
  ctx.closePath(); ctx.fill()
}

/** `scale` is device pixels per logical unit; the two 8x8 panels need it (see below). */
function draw(ctx: CanvasRenderingContext2D, scale: number) {
  if (!dequantised.value) return
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

  // No text on the stage at all. Everything that used to be written here is either
  // obvious from the picture (three panels, two arrows) or reported by the always-on
  // stats HUD, which already carries the kept count and the maximum pixel error.
  arrow(ctx, SRC_X + STATION + 8, GRID_X - 8, CY)
  arrow(ctx, GRID_X + GRID_SPAN + 8, RECON_X - 8, CY)

  // The one label the stage keeps, on the panel making the claim. Driven by the measured
  // pixel diff, so a block that happens to survive quantisation intact reads LOSSLESS —
  // which is true of that block, and the reason this is not a constant.
  //
  // Faded in by how much of the reconstruction has actually arrived, so it appears with
  // the picture it describes rather than sitting over an empty panel from the first frame.
  let arrived = 1
  for (const s of sprites) arrived = Math.min(arrived, s.merge)
  const t = Math.max(0, Math.min(1, (arrived - 0.9) / 0.1))
  const lossy = maxError.value > 0
  const text = lossy ? 'LOSSY' : 'LOSSLESS'
  // Below the station rather than struck across it: the reconstruction is only 200 units
  // wide, and a stamp that size would cover the picture it is describing. Centred under
  // the station, but pulled left if the wider of the two words would run off the stage.
  const b = stampBounds(ctx, text, 36)
  drawStamp(ctx, text,
    Math.min(RECON_X + STATION / 2, STAGE_W - MARGIN - b.w / 2),
    CY + STATION / 2 + 14 + b.h / 2,
    lossy ? colours.warn : colours.good, { size: 36, alpha: t * t * (3 - 2 * t) })

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

const { canvas: stageCanvas, stage, selectStage, rebuild } = usePhaseStage({
  stages: STAGES,
  width: STAGE_W,
  height: STAGE_H,
  beforeBuild: () => { readColours(); renderTiles() },
  build,
  draw,
})

function refresh() {
  rebuild()
  nextTick(drawPicker)
}

watch([() => pipeline.selectedBlockIndex.value, dequantised], refresh)
watch(() => pipeline.ycbcr.value, () => nextTick(drawPicker))
// Loading an image resets the selection to block 0, which on the pixel-art sample is
// blank background — the one block with nothing to show.
watch(() => pipeline.sourceImageData.value, () => pickInterestingBlock())

onMounted(() => {
  pickInterestingBlock()
  nextTick(drawPicker)
})
</script>

<template>
  <SlideLayout>
    <div class="basis">
      <div class="picker">
        <canvas ref="pickerCanvas" v-loupe @click="pickBlock" />
      </div>

      <div class="stage">
        <div class="stage-wrap">
          <canvas ref="stageCanvas" />
        </div>

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
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
/*
 * A percentage rather than a fixed 17rem for the picker: the wider the deck is, the wider
 * the stage column gets, and the closer the box it offers comes to the stage's own aspect.
 * A fixed column did the opposite — it took the same 476px from a laptop as from a
 * projector, which is where most of the wasted space on this slide came from.
 */
.basis {
  display: grid;
  grid-template-columns: 19% minmax(0, 1fr);
  gap: 1rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.picker {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

/* Gives the canvas a box with a definite height, so that `max-width` and `max-height`
   at 100% can scale it to fill whichever axis binds. */
.stage-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: 4px;
  cursor: crosshair;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  min-height: 0;
}

/* Sized in JS from `.stage-wrap` — see `usePhaseStage`. */
.stage canvas {
  display: block;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.45rem 1.2rem;
  font-size: 0.66rem;
  color: var(--text-secondary);
}

/* Nothing in this row may wrap mid-label — a squeezed flex item shreds into one word
   per line rather than simply moving to the next row. */
.controls > * {
  white-space: nowrap;
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
  font-size: 0.56rem;
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
  padding: 0.22rem 0.7rem;
  font-size: 0.66rem;
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

</style>
