<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { usePhaseStage } from '../../deck/usePhaseStage'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ZIGZAG_ORDER, zigzagScan } from '../../engine/jpeg/zigzag'
import { acBitsWholeImage, flattenRaster } from '../../engine/jpeg/stages'
import { acEncodedBits } from '../../engine/jpeg/acCoding'
import { drawStamp, stampBounds, ratioVerdict } from '../../rendering/stamp'
import { useStat } from '../../stats/useStats'
import type { Block } from '../../engine/jpeg/types'

/**
 * What zigzag actually buys, priced the way JPEG prices it.
 *
 * The 63 AC coefficients are run-length coded: each non-zero becomes a (zeros-skipped, size)
 * symbol from a fixed Huffman table plus its magnitude bits, and once only zeros remain the
 * block ends with a single EOB. Because the DCT compacts energy into the low frequencies,
 * reading them in zigzag order — low frequency first — front-loads the non-zeros and leaves
 * one long tail of zeros for EOB to swallow, while the interior skips stay short, the common
 * cheap symbols. Row-major order interleaves low and high frequencies, so the non-zeros
 * scatter: longer, rarer runs, ZRL markers past 15 zeros, and EOB reached late.
 *
 * The badge is the real AC bit cost of this block in each order, from the standard luminance
 * table — no invented ratio. The DC coefficient is coded separately, as a difference from the
 * previous block's DC, is identical in both orders, and sits outside the comparison.
 */

const pipeline = inject(PIPELINE_KEY)!

// --- Orders and data ---------------------------------------------------------

const RASTER_ORDER: [number, number][] =
  Array.from({ length: 64 }, (_, i) => [Math.floor(i / 8), i % 8])

const quantized = computed<Block | null>(() => pipeline.selectedQuantized.value)
const rasterSeq = computed(() => (quantized.value ? flattenRaster(quantized.value) : null))
const zigzagSeq = computed(() => (quantized.value ? zigzagScan(quantized.value) : null))

/** The same comparison across every block, so one lucky selection cannot carry the slide. */
const coefficientBits = computed(() => {
  const b = pipeline.quantizedBlocks.value
  if (!b) return 0
  return (b.y.blocks.length + b.cb.blocks.length + b.cr.blocks.length) * 64 * 8
})

// The real baseline-JPEG AC bit cost of this block in each reading order, and — as the
// badge — how much smaller the diagonal reading is than the row-major one. No invented
// ratio: this is the (run, size) Huffman table plus amplitude bits plus EOB, per T.81.
const rasterBits = computed(() => (rasterSeq.value ? acEncodedBits(rasterSeq.value) : 0))
const zigzagBits = computed(() => (zigzagSeq.value ? acEncodedBits(zigzagSeq.value) : 0))
const verdict = computed(() =>
  ratioVerdict(zigzagBits.value > 0 ? rasterBits.value / zigzagBits.value : 1))

useStat('zigzag', () => {
  const cache = pipeline.cache.value
  if (!cache || !coefficientBits.value) return null
  const { rasterAcBits, zigzagAcBits } = acBitsWholeImage(cache)
  const worse = zigzagAcBits > 0 ? (rasterAcBits / zigzagAcBits - 1) * 100 : 0
  return {
    label: 'Zigzag + RLE · whole image',
    rawBits: coefficientBits.value,
    encodedBits: zigzagAcBits,
    overheadBits: 0,
    lossy: false,
    note: `AC coefficients · row order would cost ${worse >= 0 ? '+' : ''}${worse.toFixed(0)}% more`,
  }
})

/** Zero-runs in an ordered sequence — the bands the run shading lights up. */
function zeroRuns(flat: readonly number[]) {
  const out: { start: number; length: number }[] = []
  let i = 0
  while (i < 64) {
    if (flat[i] !== 0) { i++; continue }
    let n = 0
    while (i + n < 64 && flat[i + n] === 0) n++
    out.push({ start: i, length: n })
    i += n
  }
  return out
}

// --- Stage geometry, in logical units ----------------------------------------

const STAGE_W = 1440
const MARGIN = 28
const GRID_CELL = 52
const GRID = GRID_CELL * 8
const ARROW = 72
const STRIP_X = MARGIN + GRID + ARROW
const STRIP_W = STAGE_W - MARGIN - STRIP_X
const STRIP_CELL = STRIP_W / 64
const STRIP_H = 118
const LABEL_H = 44
const ROW_H = LABEL_H + GRID
const ROW_GAP = 56
const TOP = 26
const ROW1_Y = TOP
const ROW2_Y = ROW1_Y + ROW_H + ROW_GAP
const STAGE_H = ROW2_Y + ROW_H + 26

// --- Colours -----------------------------------------------------------------

let colours = {
  bg: '#14141f', panel: '#1e1e2e', border: '#2a2a3a', text: '#e0e0e8',
  dim: '#8888a0', good: '#4ade80', warn: '#fbbf24', accent: '#6c8cff',
}

function readColours() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  colours = {
    bg: v('--bg-surface', '#14141f'),
    panel: v('--bg-elevated', '#1e1e2e'),
    border: v('--border', '#2a2a3a'),
    text: v('--text', '#e0e0e8'),
    dim: v('--text-secondary', '#8888a0'),
    good: v('--positive', '#4ade80'),
    warn: v('--warning', '#fbbf24'),
    accent: v('--accent', '#6c8cff'),
  }
}

// --- Animation ---------------------------------------------------------------

const anim = { scan: 0, runs: 0, badge: 0 }

const STAGES = ['grid', 'scan', 'runs'] as const
const STAGE_NAMES = ['Grid', 'Scan', 'Runs'] as const

const SCAN_AT = 0.1
const SCAN_DUR = 2.2
const SCAN_LABEL = SCAN_AT + SCAN_DUR + 0.15
const RUNS_AT = SCAN_LABEL
const RUNS_DUR = 0.8
const RUNS_LABEL = RUNS_AT + RUNS_DUR + 0.1

function build() {
  if (!quantized.value) return null
  anim.scan = 0; anim.runs = 0; anim.badge = 0

  const tl = gsap.timeline({ paused: true })
  tl.addLabel('grid', 0)
  tl.fromTo(anim, { scan: 0 }, { scan: 1, duration: SCAN_DUR, ease: 'none' }, SCAN_AT)
  tl.addLabel('scan', SCAN_LABEL)
  tl.to(anim, { runs: 1, duration: RUNS_DUR, ease: 'power1.inOut' }, RUNS_AT)
  tl.to(anim, { badge: 1, duration: 0.6, ease: 'power2.out' }, RUNS_AT + 0.25)
  tl.addLabel('runs', RUNS_LABEL)
  tl.to({}, { duration: 0.01 }, RUNS_LABEL)
  return tl
}

// --- Drawing -----------------------------------------------------------------

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

function maxAbs(q: Block) {
  let m = 1e-6
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) m = Math.max(m, Math.abs(q[r][c]))
  return m
}

/** How strongly a coefficient shades its cell — zero is nearly invisible. */
function cellAlpha(val: number, peak: number) {
  return val === 0 ? 0.06 : 0.34 + 0.6 * (Math.abs(val) / peak)
}

function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, colour: string) {
  const HEAD = 20
  ctx.strokeStyle = colour
  ctx.lineWidth = 6
  ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2 - HEAD + 2, y); ctx.stroke()
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(x2, y); ctx.lineTo(x2 - HEAD, y - 12); ctx.lineTo(x2 - HEAD, y + 12)
  ctx.closePath(); ctx.fill()
}

function drawRow(
  ctx: CanvasRenderingContext2D, rowTop: number,
  q: Block, order: [number, number][], seq: number[], colour: string, label: string,
  bits: number, stamp?: { text: string; better: boolean },
) {
  const peak = maxAbs(q)
  const gridTop = rowTop + LABEL_H
  const stripTop = gridTop + (GRID - STRIP_H) / 2

  // Row label.
  ctx.fillStyle = colours.dim
  ctx.font = '600 30px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, MARGIN, rowTop + LABEL_H / 2)

  // The block, shaded by coefficient magnitude so the corner of survivors reads at a glance.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = MARGIN + c * GRID_CELL
      const y = gridTop + r * GRID_CELL
      ctx.fillStyle = withAlpha(colour, cellAlpha(q[r][c], peak))
      ctx.fillRect(x, y, GRID_CELL - 1, GRID_CELL - 1)
    }
  }
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 1
  ctx.strokeRect(MARGIN + 0.5, gridTop + 0.5, GRID - 1, GRID - 1)

  // The scan path, drawn as far as the sweep has reached.
  const head = Math.round(anim.scan * 64)
  if (head > 0) {
    ctx.strokeStyle = colour
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i < head; i++) {
      const [r, c] = order[i]
      const x = MARGIN + c * GRID_CELL + GRID_CELL / 2
      const y = gridTop + r * GRID_CELL + GRID_CELL / 2
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    const [hr, hc] = order[Math.min(head, 64) - 1]
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(MARGIN + hc * GRID_CELL + GRID_CELL / 2, gridTop + hr * GRID_CELL + GRID_CELL / 2, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  arrow(ctx, MARGIN + GRID + 14, STRIP_X - 12, gridTop + GRID / 2, colour)

  // The linear strip, filled in scan order as the sweep advances.
  ctx.fillStyle = colours.panel
  roundRect(ctx, STRIP_X, stripTop, STRIP_W, STRIP_H, 6)
  ctx.fill()
  for (let i = 0; i < head; i++) {
    const x = STRIP_X + i * STRIP_CELL
    ctx.fillStyle = withAlpha(colour, cellAlpha(seq[i], peak))
    ctx.fillRect(x + 0.5, stripTop + 0.5, STRIP_CELL - 1, STRIP_H - 1)
  }
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 1
  roundRect(ctx, STRIP_X + 0.5, stripTop + 0.5, STRIP_W - 1, STRIP_H - 1, 6)
  ctx.stroke()

  // The last non-zero AC coefficient — where JPEG stops the block and writes EOB.
  // Everything past it is that one code, so a low index here is the whole compression win.
  let lastNZ = 0
  for (let i = 1; i < 64; i++) if (seq[i] !== 0) lastNZ = i

  if (anim.runs > 0.01) {
    // Interior zero-runs — the skips RLE folds into each (run, size) symbol. Only those
    // before EOB: the trailing zeros are not a run, they are the block ending.
    for (const run of zeroRuns(seq)) {
      if (run.start === 0 || run.start > lastNZ) continue
      const visible = Math.min(run.length, lastNZ + 1 - run.start)
      const x = STRIP_X + run.start * STRIP_CELL
      const w = visible * STRIP_CELL
      ctx.fillStyle = withAlpha(colour, 0.18 * anim.runs)
      ctx.fillRect(x, stripTop, w, STRIP_H)
      ctx.strokeStyle = withAlpha(colour, 0.55 * anim.runs)
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 0.75, stripTop + 0.75, w - 1.5, STRIP_H - 1.5)
    }

    // EOB: the trailing zeros, darkened and closed by one marker. Zigzag makes this tail
    // long and arrives at it early; row order must code far more before it can.
    if (lastNZ < 63) {
      const ex = STRIP_X + (lastNZ + 1) * STRIP_CELL
      ctx.fillStyle = `rgba(10, 10, 15, ${0.62 * anim.runs})`
      ctx.fillRect(ex, stripTop, STRIP_X + STRIP_W - ex, STRIP_H)
      ctx.strokeStyle = withAlpha(colour, anim.runs)
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(ex, stripTop); ctx.lineTo(ex, stripTop + STRIP_H); ctx.stroke()
      ctx.globalAlpha = anim.runs
      ctx.fillStyle = colour
      ctx.font = '700 24px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('EOB', ex + 10, stripTop + STRIP_H / 2)
      ctx.globalAlpha = 1
    }
  }

  // DC is the exception: coded once as a difference from the previous block's DC, so it is
  // identical in either order and sits outside this comparison.
  ctx.fillStyle = colours.dim
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('DC', STRIP_X + STRIP_CELL / 2, stripTop - 8)

  // The block's AC coefficients in real JPEG bits, and — on the winning row — the verdict.
  if (anim.badge > 0.01) {
    ctx.globalAlpha = anim.badge
    ctx.fillStyle = colours.text
    ctx.font = '700 32px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${bits} bits`, STRIP_X + STRIP_W, stripTop - 8)
    ctx.globalAlpha = 1
    if (stamp) {
      const b = stampBounds(ctx, stamp.text, 30)
      drawStamp(ctx, stamp.text,
        STRIP_X + STRIP_W - b.w / 2, stripTop + STRIP_H + b.h / 2 + 8,
        stamp.better ? colours.good : colours.warn, { size: 30, alpha: anim.badge })
    }
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  const q = quantized.value
  const rSeq = rasterSeq.value
  const zSeq = zigzagSeq.value
  if (!q || !rSeq || !zSeq) return
  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  drawRow(ctx, ROW1_Y, q, RASTER_ORDER, rSeq, colours.warn, 'ROW BY ROW', rasterBits.value)
  drawRow(ctx, ROW2_Y, q, ZIGZAG_ORDER, zSeq, colours.good, 'ZIGZAG', zigzagBits.value, verdict.value)
}

// --- Block picker ------------------------------------------------------------

const pickerCanvas = ref<HTMLCanvasElement>()
const blocksPerRow = computed(() => pipeline.allBlocks.value?.y.blocksPerRow ?? 0)
const blockCount = computed(() => pipeline.allBlocks.value?.y.blocks.length ?? 0)

function drawPicker() {
  const src = pipeline.sourceImageData.value
  const canvas = pickerCanvas.value
  if (!src || !canvas) return
  const width = src.width
  const height = src.height
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(src, 0, 0)

  ctx.strokeStyle = 'rgba(174, 203, 245, 0.32)'
  ctx.lineWidth = 1
  for (let x = 0; x <= width; x += 8) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke() }
  for (let yy = 0; yy <= height; yy += 8) { ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(width, yy + 0.5); ctx.stroke() }

  const per = blocksPerRow.value
  if (!per) return
  const i = pipeline.selectedBlockIndex.value
  const bx = (i % per) * 8
  const by = Math.floor(i / per) * 8
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

// --- Wiring ------------------------------------------------------------------

const { canvas: stageCanvas, stage, progress, selectStage, scrub, rebuild } = usePhaseStage({
  stages: STAGES,
  width: STAGE_W,
  height: STAGE_H,
  beforeBuild: readColours,
  build,
  draw,
})

function refresh() {
  rebuild()
  nextTick(drawPicker)
}

/** Block 0 is the top-left corner, often blank; pick a lively block while untouched. */
function pickInterestingBlock() {
  const dct = pipeline.dctBlocks.value
  if (!dct || pipeline.selectedBlockIndex.value !== 0) return
  const energy = dct.y.blocks.map((b, i) => {
    let e = 0
    for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) if (u || v) e += b[u][v] * b[u][v]
    return { i, e }
  })
  if (!energy.length) return
  const lively = energy.filter(e => e.e > 50)
  const pool = lively.length ? lively : energy
  pool.sort((a, b) => a.e - b.e)
  pipeline.selectedBlockIndex.value = pool[Math.floor(pool.length * 0.8)].i
}

watch(quantized, refresh)
watch(() => pipeline.sourceImageData.value, () => nextTick(drawPicker))
watch(() => pipeline.sourceImageData.value, () => pickInterestingBlock())
onMounted(() => {
  pickInterestingBlock()
  nextTick(drawPicker)
})
</script>

<template>
  <SlideLayout>
    <div class="zz">
      <div class="picker">
        <canvas ref="pickerCanvas" v-loupe @click="pickBlock" />
      </div>

      <div class="stage">
        <div class="stage-wrap">
          <canvas ref="stageCanvas" />
        </div>

        <div class="stage-controls">
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
    </div>
  </SlideLayout>
</template>

<style scoped>
.zz {
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

.stage-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sized in JS from `.stage-wrap` — see `usePhaseStage`. */
.stage canvas {
  display: block;
  border-radius: 6px;
  border: 1px solid var(--border);
}
</style>
