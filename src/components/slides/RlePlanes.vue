<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { splitPlanes, planeToImageData, interleavedBytes } from '../../engine/codecs/planes'
import { countRuns } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

const pipeline = inject(PIPELINE_KEY)!

// Tinting each plane into its own channel, versus the literal intensity reading.
const tinted = ref(true)

type PlaneKey = 'r' | 'g' | 'b'

// Function refs rather than a ref-per-plane: inside v-for, Vue collects plain refs
// into arrays, which is not what is wanted here.
const canvases: Partial<Record<PlaneKey, HTMLCanvasElement>> = {}
function setCanvas(key: PlaneKey, el: unknown) {
  canvases[key] = (el as HTMLCanvasElement) ?? undefined
}

const planes = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? splitPlanes(src) : null
})

const planeRuns = computed(() => {
  const p = planes.value
  if (!p) return null
  return { r: countRuns(p.r), g: countRuns(p.g), b: countRuns(p.b) }
})

const totalRuns = computed(() => {
  const r = planeRuns.value
  return r ? r.r + r.g + r.b : 0
})

// The same bytes visited in pixel order, for the direct comparison.
const interleavedRuns = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? countRuns(interleavedBytes(src)) : 0
})

const rawBits = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? src.width * src.height * 3 * 8 : 0
})
const encodedBits = computed(() => totalRuns.value * 16)
const interleavedBits = computed(() => interleavedRuns.value * 16)
const improvement = computed(() =>
  interleavedRuns.value ? 1 - totalRuns.value / interleavedRuns.value : 0)
// Reordering always removes runs, but on a photograph RLE still loses to raw —
// say so rather than claiming a win the numbers do not support.
const stillExpands = computed(() => encodedBits.value > rawBits.value)

useStat('rle-planes', () => {
  if (!planes.value) return null
  return {
    label: 'RLE · R/G/B planes',
    rawBits: rawBits.value,
    encodedBits: encodedBits.value,
    overheadBits: 0,
    // Reordering is exactly reversible — nothing is discarded here at all.
    lossy: false,
    note: 'same bytes, different order',
  }
})

function draw() {
  const p = planes.value
  if (!p) return
  for (const key of ['r', 'g', 'b'] as const) {
    const canvas = canvases[key]
    if (!canvas) continue
    canvas.width = p.width
    canvas.height = p.height
    canvas.getContext('2d')!.putImageData(
      planeToImageData(p[key], p.width, p.height, tinted.value ? key : undefined), 0, 0)
  }
}

watch([planes, tinted], () => nextTick(draw))
onMounted(draw)

const PLANE_META: { key: PlaneKey; label: string; color: string }[] = [
  { key: 'r', label: 'Red', color: 'var(--negative)' },
  { key: 'g', label: 'Green', color: 'var(--positive)' },
  { key: 'b', label: 'Blue', color: 'var(--accent)' },
]
</script>

<template>
  <SlideLayout column>
    <div class="planes-slide">
      <div class="view-toggle">
        <button :class="{ active: tinted }" @click="tinted = true">Colour</button>
        <button :class="{ active: !tinted }" @click="tinted = false">Greyscale</button>
      </div>

      <div class="planes">
        <div v-for="meta in PLANE_META" :key="meta.key" class="plane">
          <h3 :style="{ color: meta.color }">{{ meta.label }}</h3>
          <canvas :ref="el => setCanvas(meta.key, el)" v-loupe />
          <span class="runs">{{ (planeRuns?.[meta.key] ?? 0).toLocaleString() }} runs</span>
        </div>
      </div>

      <div class="compare">
        <div class="side">
          <span class="k">Interleaved R,G,B,R,G,B…</span>
          <span class="v">{{ interleavedRuns.toLocaleString() }} runs</span>
          <span class="sz">{{ (interleavedBits / 8 / 1024).toFixed(0) }} KB</span>
        </div>
        <div class="versus">vs</div>
        <div class="side win">
          <span class="k">Three separate planes</span>
          <span class="v">{{ totalRuns.toLocaleString() }} runs</span>
          <span class="sz">{{ (encodedBits / 8 / 1024).toFixed(0) }} KB</span>
        </div>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Not one byte was discarded and not one bit of cleverness was added to the encoder — the
          bytes were simply visited in a different order, and
          <strong :class="improvement > 0 ? 'good' : 'bad'">
            {{ improvement > 0
              ? Math.round(improvement * 100) + '% of the runs disappeared'
              : 'the runs did not improve on this image' }}</strong>.
          <template v-if="stillExpands">
            A photograph has so little exact repetition that RLE still loses to the raw bytes —
            but switch to <strong>Graphic</strong> or <strong>Gradient</strong> and the same
            reordering turns the same encoder from a loss into a win.
          </template>
          <template v-else>
            Reframing the data did all of it.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.planes-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.view-toggle {
  display: flex;
  gap: 0.25rem;
}

.view-toggle button {
  padding: 0.2rem 0.5rem;
  font-size: 0.6rem;
  border-radius: 4px;
}

.planes {
  display: flex;
  gap: 1.2rem;
  min-height: 0;
}

.plane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-height: 0;
}

.plane h3 {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.plane canvas {
  max-width: 100%;
  max-height: 38vh;
  border-radius: 4px;
}

.runs {
  font-size: 0.6rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.compare {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}

.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.side.win {
  border-color: var(--positive);
}

.k {
  font-size: 0.58rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.v {
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.side.win .v {
  color: var(--positive);
}

.sz {
  font-size: 0.6rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.versus {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.verdict {
  font-size: 0.72rem;
  line-height: 1.45;
  max-width: 44rem;
  text-align: center;
  color: var(--text-secondary);
}

.good {
  color: var(--positive);
}

.bad {
  color: var(--negative);
}
</style>
