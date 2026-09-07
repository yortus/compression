<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { useStat } from '../../stats/useStats'
import {
  GRID, SHAPE_PRESETS,
  dct2d, partialReconstruct2d, energyRank2d, rmse2d,
} from '../../engine/signal2d'
import { drawHeightfield } from '../../rendering/heightfield'

/**
 * `waves-intro`, lifted into two dimensions. Four panels, left to right: the target as
 * pixels, the target as a height surface, the reconstruction as a surface, the
 * reconstruction as pixels — the 1-D slide's own two view-types (a pixel strip and a
 * graph) generalised, and shown for both the shape and its sum of waves.
 */

const TARGET = '#aecbf5'
const SUM = '#a7f3d0'
const COUNT = GRID * GRID

const grid = ref<number[][]>(SHAPE_PRESETS[0].grid.map(r => r.slice()))
const waves = ref(10)
const activePreset = ref<string | null>(SHAPE_PRESETS[0].name)

const coeffs = computed(() => dct2d(grid.value))
const sum = computed(() => partialReconstruct2d(coeffs.value, waves.value))
const error = computed(() => rmse2d(grid.value, sum.value))
const enough = computed(() => energyRank2d(coeffs.value, 0.99))

useStat('waves-2d', () => ({
  label: `${waves.value} of ${COUNT} patterns`,
  rawBits: COUNT * 8,
  encodedBits: waves.value * 8,
  overheadBits: 0,
  lossy: error.value > 0.004,
  note: error.value > 0.004
    ? `error ${(error.value * 100).toFixed(1)}% of full scale`
    : 'every pattern kept — exact',
}))

function usePreset(p: typeof SHAPE_PRESETS[number]) {
  grid.value = p.grid.map(r => r.slice())
  activePreset.value = p.name
}

// --- Canvases ----------------------------------------------------------------

const PIX = 340
const SURF = 340

const targetPixels = ref<HTMLCanvasElement>()
const targetSurface = ref<HTMLCanvasElement>()
const sumSurface = ref<HTMLCanvasElement>()
const sumPixels = ref<HTMLCanvasElement>()
const thumbs = ref<HTMLCanvasElement[]>([])

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** One square per cell, base hue at an intensity equal to the cell's height. */
function drawPixels(cv: HTMLCanvasElement | undefined, g: number[][], hue: string, size = PIX) {
  if (!cv) return
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = cssVar('--bg-elevated')
  ctx.fillRect(0, 0, size, size)
  const cell = size / GRID
  ctx.fillStyle = hue
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      ctx.globalAlpha = clamp(g[i][j])
      ctx.fillRect(j * cell, i * cell, cell - 1, cell - 1)
    }
  }
  ctx.globalAlpha = 1
}

function drawSurface(cv: HTMLCanvasElement | undefined, g: number[][], hue: string) {
  if (!cv) return
  cv.width = SURF
  cv.height = SURF
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = cssVar('--bg-elevated')
  ctx.fillRect(0, 0, SURF, SURF)
  drawHeightfield(ctx, g, { cx: SURF / 2, cy: 128, ax: 21, hz: 96, colour: hue })
}

function redraw() {
  drawPixels(targetPixels.value, grid.value, TARGET)
  drawSurface(targetSurface.value, grid.value, TARGET)
  drawSurface(sumSurface.value, sum.value, SUM)
  drawPixels(sumPixels.value, sum.value, SUM)
}

function drawThumbs() {
  SHAPE_PRESETS.forEach((p, k) => drawPixels(thumbs.value[k], p.grid, TARGET, 48))
}

watch([grid, sum], redraw, { deep: true })
onMounted(() => { drawThumbs(); redraw() })

// --- Drawing on the target ---------------------------------------------------

let painting = 0

function cellAt(e: MouseEvent) {
  const cv = targetPixels.value!
  const rect = cv.getBoundingClientRect()
  const j = Math.floor(((e.clientX - rect.left) / rect.width) * GRID)
  const i = Math.floor(((e.clientY - rect.top) / rect.height) * GRID)
  return { i, j, ok: i >= 0 && i < GRID && j >= 0 && j < GRID }
}

function paint(e: MouseEvent) {
  const { i, j, ok } = cellAt(e)
  if (!ok) return
  const next = grid.value.map(r => r.slice())
  next[i][j] = painting > 0 ? 1 : 0
  grid.value = next
  activePreset.value = null
}

function onDown(e: MouseEvent) {
  e.preventDefault()
  painting = e.button === 2 ? -1 : 1
  paint(e)
  window.addEventListener('mousemove', paint)
  window.addEventListener('mouseup', onUp)
}

function onUp() {
  window.removeEventListener('mousemove', paint)
  window.removeEventListener('mouseup', onUp)
}

onUnmounted(onUp)
</script>

<template>
  <SlideLayout column>
    <div class="waves2d">
      <div class="input-row">
        <button
          v-for="(p, k) in SHAPE_PRESETS" :key="p.name"
          :class="{ active: activePreset === p.name }"
          :title="p.name"
          @click="usePreset(p)"
        >
          <canvas class="thumb" :ref="el => { if (el) thumbs[k] = el as HTMLCanvasElement }" />
        </button>
        <span class="hint">{{ activePreset ? activePreset.toLowerCase() : 'or drag on the first panel to draw' }}</span>
      </div>

      <div class="panels">
        <figure>
          <canvas ref="targetPixels" class="pad draw" @mousedown="onDown" @contextmenu.prevent />
          <figcaption class="blue">target</figcaption>
        </figure>
        <figure>
          <canvas ref="targetSurface" class="pad" />
          <figcaption class="blue">target as waves</figcaption>
        </figure>
        <figure>
          <canvas ref="sumSurface" class="pad" />
          <figcaption class="green">sum of waves</figcaption>
        </figure>
        <figure>
          <canvas ref="sumPixels" class="pad" />
          <figcaption class="green">reconstruction</figcaption>
        </figure>
      </div>

      <div class="controls">
        <label class="slider">
          <span>waves</span>
          <input type="range" min="0" :max="COUNT" v-model.number="waves" />
          <span class="value">{{ waves }} / {{ COUNT }}</span>
        </label>
        <span class="err" :class="{ tiny: error < 0.02 }">error {{ (error * 100).toFixed(1) }}%</span>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Exactly the one-dimensional story, one axis richer: a 2-D shape is a sum of fixed
          cosine <em>patterns</em>, and for this one <strong>{{ enough }} of {{ COUNT }}</strong>
          hold 99% of the energy. Keep fewer and the surface blurs; a hard diagonal or a checker
          needs nearly all of them. This is precisely what JPEG does to every 8×8 block.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.waves2d {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.input-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
}

.input-row button {
  padding: 0.25rem;
  border-radius: 5px;
  line-height: 0;
}

.thumb {
  display: block;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 3px;
}

.hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-left: 0.4rem;
}

.panels {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: center;
  min-height: 0;
}

figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  max-width: 26rem;
}

.pad {
  width: 100%;
  height: auto;
  border-radius: 6px;
  border: 1px solid var(--border);
  display: block;
}

.pad.draw {
  cursor: crosshair;
}

figcaption {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

figcaption.blue { color: #aecbf5; }
figcaption.green { color: #a7f3d0; }

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.slider input {
  width: 18rem;
}

.slider .value {
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
}

.err {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--warning);
}

.err.tiny {
  color: var(--positive);
}

.verdict {
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 54rem;
  margin: 0 auto;
}
</style>
