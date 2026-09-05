<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { useDeck } from '../../deck/useDeck'
import { cosineShape } from '../../engine/signal'
import { paintBlock8, fillBlock8, PATTERN_CONTRAST } from '../../rendering/shade'

/**
 * How one dimension becomes two.
 *
 * The previous two slides built a signal out of cosines along a line. A block is not a
 * line, and the step from one to the other is the bit people quietly skip: JPEG's 64
 * patterns are not a new idea, they are every pairing of the same eight waves — one
 * running down, one running across, multiplied together.
 *
 * That is exact, not a metaphor. Each cell here is computed as
 * `cosineShape(u)[x] * cosineShape(v)[y]`, and `roundtrip.test.ts` checks that this
 * reproduces the engine's own `basisFunction` for all 64 patterns to nine decimal places.
 * The animation is therefore drawing the multiplication it claims to be drawing.
 *
 * Why the outer product matters beyond the picture: it is what makes the 2-D transform
 * *separable*, so an encoder runs eight one-dimensional transforms across the rows and
 * eight down the columns instead of one 64-by-64 matrix multiply.
 */

const deck = useDeck()

// --- Geometry -----------------------------------------------------------------

const STAGE_W = 1080
const STAGE_H = 600
const CELL = 54
const GAP = 4
const SPAN = CELL * 8 + GAP * 7
const WAVE = 52
const COL_X = 30
const GRID_X = COL_X + WAVE + 12
const ROW_Y = 34
const GRID_Y = ROW_Y + WAVE + 12

const DETAIL_X = 660
const DETAIL_SIZE = 200
const DETAIL_Y = 210

function cellX(v: number) { return GRID_X + v * (CELL + GAP) }
function cellY(u: number) { return GRID_Y + u * (CELL + GAP) }

// --- The patterns -------------------------------------------------------------

/** The eight shapes, cached: everything on this slide is built from these. */
const SHAPES = Array.from({ length: 8 }, (_, k) => cosineShape(k, 8))

/** One 2-D pattern, as the literal product of a wave down and a wave across. */
function pattern(u: number, v: number): number[][] {
  return Array.from({ length: 8 }, (_, x) =>
    Array.from({ length: 8 }, (_, y) => 128 + 127 * SHAPES[u][x] * SHAPES[v][y]))
}

const tiles: HTMLCanvasElement[] = Array.from({ length: 64 }, () => {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  return c
})

const selected = ref({ u: 2, v: 1 })

// --- Fill animation -----------------------------------------------------------

/**
 * One tweened number rather than 64 tweens: each cell's opacity is a function of how far
 * the sweep has passed it. Cheaper, and it scrubs cleanly in both directions.
 */
const fill = { p: 0 }
const OVERLAP = 0.18
let tl: gsap.core.Timeline | null = null

/** Row-major, so the two wave strips are read across and down as the grid fills. */
function order(u: number, v: number) { return u * 8 + v }

function cellAlpha(u: number, v: number) {
  const start = (order(u, v) / 63) * (1 - OVERLAP)
  return Math.max(0, Math.min(1, (fill.p - start) / OVERLAP))
}

/** The cell the sweep is passing through, for highlighting its two parent waves. */
const leading = () => {
  if (fill.p <= 0 || fill.p >= 1) return null
  const k = Math.round((fill.p / (1 - OVERLAP)) * 63)
  return { u: Math.floor(k / 8) % 8, v: k % 8 }
}

const built = computed(() => (deck.learnMode.value ? true : deck.fragment.value >= 1))

function buildTimeline() {
  tl?.kill()
  tl = gsap.timeline({ paused: true })
  tl.fromTo(fill, { p: 0 }, { p: 1, duration: 3.4, ease: 'none' })
  tl.progress(built.value ? 1 : 0)
}

function replay() {
  if (!tl) return
  tl.restart()
  tl.play()
}

watch(built, on => {
  if (!tl) return
  if (on) { tl.restart(); tl.play() }
  else { tl.pause(); tl.progress(0) }
})

// --- Drawing ------------------------------------------------------------------

const stageCanvas = ref<HTMLCanvasElement>()

/**
 * Device pixels per logical unit — see the same block in `Basis64.vue`. The stage is
 * authored at a fixed size and shown smaller, and leaving the backing store at the
 * authored size makes the browser resample the whole canvas smoothly every frame.
 */
let scale = 1
let observer: ResizeObserver | null = null

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
}

let colours = { bg: '#14141f', border: '#2a2a3a', text: '#e0e0e8', dim: '#8888a0', accent: '#6c8cff' }

function readColours() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  colours = {
    bg: v('--bg-surface', '#14141f'),
    border: v('--border', '#2a2a3a'),
    text: v('--text', '#e0e0e8'),
    dim: v('--text-secondary', '#8888a0'),
    accent: v('--accent', '#6c8cff'),
  }
}

function renderTiles() {
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) paintBlock8(tiles[u * 8 + v], pattern(u, v), PATTERN_CONTRAST)
  }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, colour: string, size = 13, align: CanvasTextAlign = 'center') {
  ctx.fillStyle = colour
  ctx.font = `${size}px Inter, system-ui, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

/** A wave drawn as a line plot, either across a strip or down one. */
function wave(
  ctx: CanvasRenderingContext2D,
  shape: number[],
  x: number, y: number, w: number, h: number,
  vertical: boolean,
  hot: boolean,
) {
  ctx.strokeStyle = hot ? colours.accent : colours.dim
  ctx.lineWidth = hot ? 2.5 : 1.5
  ctx.globalAlpha = hot ? 1 : 0.75
  ctx.beginPath()
  for (let i = 0; i < shape.length; i++) {
    const t = (i + 0.5) / shape.length
    // The wave runs along the axis it modulates, and swings across the other one.
    const px = vertical ? x + w / 2 - (shape[i] * w) / 2.6 : x + t * w
    const py = vertical ? y + t * h : y + h / 2 - (shape[i] * h) / 2.6
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawDetail(ctx: CanvasRenderingContext2D) {
  const { u, v } = selected.value
  const x = DETAIL_X + 60
  const y = DETAIL_Y

  text(ctx, 'one pattern, close up', x + DETAIL_SIZE / 2, y - 76, colours.text, 15)

  wave(ctx, SHAPES[v], x, y - 62, DETAIL_SIZE, 48, false, true)
  wave(ctx, SHAPES[u], x - 60, y, 48, DETAIL_SIZE, true, true)

  // Cell by cell in device pixels: the close-up is the one place a soft edge is obvious.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  fillBlock8(ctx, pattern(u, v), x * scale, y * scale, DETAIL_SIZE * scale, PATTERN_CONTRAST)
  ctx.restore()
  ctx.strokeStyle = colours.accent
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, DETAIL_SIZE, DETAIL_SIZE)

  text(ctx, `wave ${u} down  ×  wave ${v} across`, x + DETAIL_SIZE / 2, y + DETAIL_SIZE + 26, colours.text, 14)
  text(ctx, 'every pixel is one multiplication', x + DETAIL_SIZE / 2, y + DETAIL_SIZE + 48, colours.dim, 12)
}

function draw() {
  const canvas = stageCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  const lead = leading()

  text(ctx, 'the same eight waves, across', GRID_X + SPAN / 2, 16, colours.dim, 13)
  ctx.save()
  ctx.translate(14, GRID_Y + SPAN / 2)
  ctx.rotate(-Math.PI / 2)
  text(ctx, 'and down', 0, 0, colours.dim, 13)
  ctx.restore()

  // The eight waves along each edge.
  for (let k = 0; k < 8; k++) {
    wave(ctx, SHAPES[k], cellX(k), ROW_Y, CELL, WAVE, false, lead?.v === k)
    wave(ctx, SHAPES[k], COL_X, cellY(k), WAVE, CELL, true, lead?.u === k)
  }

  // The grid: every pairing of one with the other.
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      const a = cellAlpha(u, v)
      const x = cellX(v)
      const y = cellY(u)
      ctx.strokeStyle = colours.border
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
      if (a <= 0.01) continue
      ctx.globalAlpha = a
      // Cells swell into place rather than simply fading, so the sweep has direction.
      const size = CELL * (0.55 + 0.45 * a)
      ctx.drawImage(tiles[u * 8 + v], x + (CELL - size) / 2, y + (CELL - size) / 2, size, size)
      ctx.globalAlpha = 1
      if (selected.value.u === u && selected.value.v === v) {
        ctx.strokeStyle = colours.accent
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, CELL, CELL)
      }
    }
  }

  drawDetail(ctx)
}

// --- Interaction ---------------------------------------------------------------

function onClick(e: MouseEvent) {
  const canvas = stageCanvas.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * STAGE_W
  const y = ((e.clientY - rect.top) / rect.height) * STAGE_H
  const v = Math.floor((x - GRID_X) / (CELL + GAP))
  const u = Math.floor((y - GRID_Y) / (CELL + GAP))
  if (u < 0 || u > 7 || v < 0 || v > 7) return
  selected.value = { u, v }
}

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
  renderTiles()
  buildTimeline()
  gsap.ticker.add(draw)
})

onUnmounted(() => {
  gsap.ticker.remove(draw)
  observer?.disconnect()
  tl?.kill()
})
</script>

<template>
  <SlideLayout column>
    <div class="basis2d">
      <canvas ref="stageCanvas" @click="onClick" />

      <div class="controls">
        <button class="chip" @click="replay()">↻ replay</button>
        <span class="hint">click any pattern to see how it is made</span>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          There is no separate two-dimensional idea to learn. The 64 patterns are every pairing of
          the same eight waves — one running down the block, one running across — multiplied
          together. That is why an encoder never builds a 64×64 matrix: it runs the one-dimensional
          transform along the eight rows, then along the eight columns, and the two passes together
          <em>are</em> the 2-D transform.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.basis2d {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  justify-content: center;
}

.basis2d canvas {
  max-width: 100%;
  max-height: 56vh;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.58rem;
  color: var(--text-secondary);
}

.chip {
  padding: 0.16rem 0.45rem;
  font-size: 0.56rem;
  border-radius: 4px;
}

.hint {
  font-style: italic;
  opacity: 0.75;
}

.verdict {
  font-size: 0.66rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 54rem;
}
</style>
