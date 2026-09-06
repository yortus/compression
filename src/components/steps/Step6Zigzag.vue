<script setup lang="ts">
import { inject, ref, watch, onMounted, onUnmounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ZIGZAG_ORDER } from '../../engine/jpeg/zigzag'
import { compareScanOrders, compareScanOrdersWholeImage, flattenRaster } from '../../engine/jpeg/stages'
import { zigzagScan } from '../../engine/jpeg/zigzag'
import { useStat } from '../../stats/useStats'
import gsap from 'gsap'

/**
 * The reorder insight, shown as a comparison rather than asserted — and the comparison
 * turned out not to say what the first version of this slide claimed.
 *
 * "Zigzag produces fewer RLE pairs" is false: a pair is emitted per non-zero coefficient
 * plus an end-of-block marker, and reordering cannot change how many non-zeros there are.
 * Both strips below really do show the same pair count, and the slide now says so out
 * loud, because that is the more interesting fact. What the reordering changes is the run
 * *lengths* between the non-zeros — scattered fives and sixes in row order, almost all
 * zeros along the diagonal — which collapses the alphabet the entropy coder has to
 * describe. So the saving is drawn in bits after Huffman, where it actually lives.
 */

const pipeline = inject(PIPELINE_KEY)!

const gridCanvas = ref<HTMLCanvasElement>()
const order = ref<'zigzag' | 'raster'>('zigzag')

const animIndex = ref(64)
const isPlaying = ref(false)
let tween: gsap.core.Tween | null = null

const RASTER_ORDER: [number, number][] = Array.from({ length: 64 }, (_, i) => [Math.floor(i / 8), i % 8])
const path = computed(() => (order.value === 'zigzag' ? ZIGZAG_ORDER : RASTER_ORDER))

const quantized = computed(() => pipeline.selectedQuantized.value)
const raster = computed(() => (quantized.value ? flattenRaster(quantized.value) : null))
const zigzag = computed(() => (quantized.value ? zigzagScan(quantized.value) : null))
const comparison = computed(() => (quantized.value ? compareScanOrders(quantized.value) : null))

/** The same question asked of every block, so one lucky selection cannot carry the slide. */
const wholeImage = computed(() => {
  const cache = pipeline.cache.value
  return cache ? compareScanOrdersWholeImage(cache) : null
})

const coefficientBits = computed(() => {
  const b = pipeline.quantizedBlocks.value
  if (!b) return 0
  return (b.y.blocks.length + b.cb.blocks.length + b.cr.blocks.length) * 64 * 8
})

useStat('zigzag', () => {
  const w = wholeImage.value
  if (!w || !coefficientBits.value) return null
  const worse = (w.rasterSymbolBits / w.zigzagSymbolBits - 1) * 100
  return {
    label: 'Zigzag + RLE · whole image',
    rawBits: coefficientBits.value,
    encodedBits: w.zigzagSymbolBits,
    overheadBits: 0,
    lossy: false,
    note: `row order would cost ${worse >= 0 ? '+' : ''}${worse.toFixed(0)}% more`,
  }
})

/**
 * Half the block, at a size that can be read from the back of a room.
 *
 * Sixty-four cells across the strip put the coefficients at about twelve pixels, which made
 * the one comparison this slide exists for the least legible thing on it. The tail is
 * reported as a count instead — and on the zigzag strip that count is itself the argument,
 * because it is nearly always every remaining coefficient, all zero.
 */
const SHOWN = 32

/** Zero runs in a strip, so the shading has something to shade. */
function runs(flat: readonly number[]) {
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

/** How many gaps are non-zero — the count of run lengths the coder has to spell out. */
function nonZeroGaps(lengths: number[] | undefined) {
  return (lengths ?? []).filter(n => n > 0).length
}

/** Runs clipped to the visible half, so the shading lines up with the cells under it. */
function visibleRuns(flat: readonly number[] | null) {
  if (!flat) return []
  return runs(flat)
    .filter(r => r.start < SHOWN)
    .map(r => ({ start: r.start, length: Math.min(r.length, SHOWN - r.start) }))
}

/** The tail, as a count. Truncation is reported, never hidden — see CLAUDE.md. */
function tailOf(flat: readonly number[] | null) {
  if (!flat) return ''
  const rest = flat.slice(SHOWN)
  const nonZero = rest.filter(v => v !== 0).length
  return nonZero === 0
    ? `+ ${rest.length} more, every one zero`
    : `+ ${rest.length} more, ${nonZero} non-zero`
}

const rasterRuns = computed(() => visibleRuns(raster.value))
const zigzagRuns = computed(() => visibleRuns(zigzag.value))

function play() {
  stop()
  animIndex.value = 0
  isPlaying.value = true
  tween = gsap.to(animIndex, {
    value: 64,
    duration: 2.4,
    ease: 'none',
    onUpdate: () => {
      animIndex.value = Math.round(animIndex.value)
      drawGrid()
    },
    onComplete: () => { isPlaying.value = false },
  })
}

function stop() {
  tween?.kill()
  tween = null
  isPlaying.value = false
}

function reset() {
  stop()
  animIndex.value = 64
  drawGrid()
}

function drawGrid() {
  const q = quantized.value
  const canvas = gridCanvas.value
  if (!q || !canvas) return

  const size = 300
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cell = size / 8

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = q[r][c]
      ctx.fillStyle = val === 0 ? '#14141f' : '#2a2a4a'
      ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1)

      ctx.fillStyle = val === 0 ? '#44445a' : '#e0e0e8'
      ctx.font = `${cell * 0.34}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(val.toString(), c * cell + cell / 2, r * cell + cell / 2)
    }
  }

  ctx.strokeStyle = order.value === 'zigzag' ? '#6c8cff' : '#fbbf24'
  ctx.lineWidth = 2
  ctx.beginPath()
  const limit = Math.min(animIndex.value, 64)
  for (let i = 0; i < limit; i++) {
    const [r, c] = path.value[i]
    const x = c * cell + cell / 2
    const y = r * cell + cell / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  if (limit > 0) {
    const [r, c] = path.value[limit - 1]
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(c * cell + cell / 2, r * cell + cell / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

watch([quantized, order], reset)
onMounted(drawGrid)
onUnmounted(stop)
</script>

<template>
  <SlideLayout column>
    <div class="zigzag">
      <div class="top">
        <div class="grid-panel">
          <canvas ref="gridCanvas" />
          <div class="grid-controls">
            <button class="chip" :class="{ active: order === 'raster' }" @click="order = 'raster'">row by row</button>
            <button class="chip" :class="{ active: order === 'zigzag' }" @click="order = 'zigzag'">zigzag</button>
            <button class="chip" @click="isPlaying ? stop() : play()">{{ isPlaying ? '⏸' : '▶' }}</button>
          </div>
        </div>

        <div class="strips">
          <div class="strip-block">
            <h3>Read row by row</h3>
            <div class="strip">
              <span
                v-for="(v, i) in (raster ?? []).slice(0, SHOWN)" :key="i"
                class="cell" :class="{ zero: v === 0 }"
              >{{ v }}</span>
              <span
                v-for="(r, i) in rasterRuns" :key="'r' + i"
                class="run raster"
                :style="{ left: (r.start / SHOWN) * 100 + '%', width: (r.length / SHOWN) * 100 + '%' }"
              />
            </div>
            <p class="tally">
              <strong>{{ comparison?.rasterPairs ?? 0 }}</strong> pairs ·
              {{ comparison?.rasterSymbols ?? 0 }} distinct symbols ·
              gaps <span class="runs">{{ (comparison?.rasterRunLengths ?? []).join(' ') || 'none' }}</span>
              <span class="tail">{{ tailOf(raster) }}</span>
            </p>
          </div>

          <div class="strip-block">
            <h3>Read in zigzag order</h3>
            <div class="strip">
              <span
                v-for="(v, i) in (zigzag ?? []).slice(0, SHOWN)" :key="i"
                class="cell" :class="{ zero: v === 0 }"
              >{{ v }}</span>
              <span
                v-for="(r, i) in zigzagRuns" :key="'z' + i"
                class="run zig"
                :style="{ left: (r.start / SHOWN) * 100 + '%', width: (r.length / SHOWN) * 100 + '%' }"
              />
            </div>
            <p class="tally">
              <strong>{{ comparison?.zigzagPairs ?? 0 }}</strong> pairs ·
              <strong class="good">{{ comparison?.zigzagSymbols ?? 0 }}</strong> distinct symbols ·
              gaps <span class="runs good">{{ (comparison?.zigzagRunLengths ?? []).join(' ') || 'none' }}</span>
              <span class="tail">{{ tailOf(zigzag) }}</span>
            </p>
          </div>
        </div>
      </div>

      <Fragment :index="1">
        <p class="verdict" v-if="wholeImage && comparison">
          Identical numbers, identical encoder — and, note, <strong>identical pair counts</strong>.
          Reordering cannot change how many non-zero coefficients there are, so it cannot change how
          many pairs come out. What it changes is the gaps <em>between</em> them: on this block
          <strong>{{ nonZeroGaps(comparison.rasterRunLengths) }}</strong> of the
          {{ comparison.rasterRunLengths.length }} gaps are non-zero in row order, against
          <strong class="good">{{ nonZeroGaps(comparison.zigzagRunLengths) }}</strong> along the
          diagonal. Every distinct gap length is another symbol the coder has to describe, so a
          stream of zeros is far cheaper than a scatter of fives and thirteens. Across the whole
          image that is <strong>{{ (wholeImage.rasterSymbolBits / 8 / 1024).toFixed(0) }} KB</strong>
          in row order against
          <strong class="good">{{ (wholeImage.zigzagSymbolBits / 8 / 1024).toFixed(0) }} KB</strong>
          in zigzag order —
          {{ ((1 - wholeImage.zigzagSymbolBits / wholeImage.rasterSymbolBits) * 100).toFixed(0) }}%,
          bought with no arithmetic at all.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.zigzag {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.top {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.grid-panel {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.grid-panel canvas {
  border-radius: 4px;
  image-rendering: pixelated;
  width: 300px;
  height: 300px;
}

.grid-controls {
  display: flex;
  gap: 0.3rem;
}

.chip {
  padding: 0.18rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.strips {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.strip-block h3 {
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.strip {
  position: relative;
  display: grid;
  grid-template-columns: repeat(32, 1fr);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.cell {
  height: 1.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 0.62rem;
  color: var(--text);
  border-right: 1px solid rgba(0, 0, 0, 0.35);
}

.cell.zero {
  color: #44445a;
}

/* Runs of zeros drawn over the strip: the thing RLE is about to collapse. */
.run {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
  border-radius: 2px;
}

.run.raster {
  background: rgba(251, 191, 36, 0.16);
  border: 1px solid rgba(251, 191, 36, 0.5);
}

.run.zig {
  background: rgba(74, 222, 128, 0.16);
  border: 1px solid rgba(74, 222, 128, 0.5);
}

.tally {
  font-size: 0.62rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  font-variant-numeric: tabular-nums;
}

.runs {
  font-family: monospace;
  letter-spacing: 0.05em;
}

/* What the strip could not show at a readable size, as a count. */
.tail {
  margin-left: 0.5rem;
  font-style: italic;
  opacity: 0.75;
}

.good {
  color: var(--positive);
}

.verdict {
  font-size: 0.66rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 56rem;
  margin: 0 auto;
}
</style>
