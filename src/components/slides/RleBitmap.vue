<script setup lang="ts">
import { inject, ref, computed, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { interleavedBytes } from '../../engine/codecs/planes'
import { countRuns, runLengthHistogram } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

const pipeline = inject(PIPELINE_KEY)!
const canvasRef = ref<HTMLCanvasElement>()

const bytes = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? interleavedBytes(src) : null
})

const runs = computed(() => (bytes.value ? countRuns(bytes.value) : 0))
const histogram = computed(() => (bytes.value ? runLengthHistogram(bytes.value) : []))
const histogramMax = computed(() => Math.max(1, ...histogram.value))

const rawBits = computed(() => (bytes.value?.length ?? 0) * 8)
const encodedBits = computed(() => runs.value * 16)
const expanded = computed(() => encodedBits.value > rawBits.value)
const meanRun = computed(() => (runs.value ? (bytes.value!.length / runs.value) : 0))

useStat('rle-bitmap', () => {
  if (!bytes.value) return null
  return {
    label: 'RLE · interleaved RGB',
    rawBits: rawBits.value,
    encodedBits: encodedBits.value,
    overheadBits: 0,
    lossy: false,
    note: 'every byte, in pixel order',
  }
})

function draw() {
  const src = pipeline.sourceImageData.value
  const canvas = canvasRef.value
  if (!src || !canvas) return
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d')!.putImageData(src, 0, 0)
}

watch(() => pipeline.sourceImageData.value, draw)
onMounted(draw)

const BUCKET_LABELS = ['1', '2–3', '4–7', '8–15', '16–31', '32–63', '64–127', '128+']
</script>

<template>
  <SlideLayout>
    <div class="bitmap-slide">
      <div class="panel">
        <canvas ref="canvasRef" v-loupe />
        <p class="caption">
          {{ (bytes?.length ?? 0).toLocaleString() }} bytes of R, G, B — in that order, pixel by pixel
        </p>
      </div>

      <div class="panel wide">
        <h3>How long are the runs?</h3>
        <div class="histogram">
          <div v-for="(n, i) in histogram" :key="i" class="bar-row">
            <span class="bucket">{{ BUCKET_LABELS[i] }}</span>
            <div class="bar-track">
              <div class="bar" :class="{ hot: i === 0 }" :style="{ width: (n / histogramMax) * 100 + '%' }" />
            </div>
            <span class="bar-count">{{ n.toLocaleString() }}</span>
          </div>
        </div>

        <div class="numbers">
          <div class="stat">
            <span class="k">Runs</span>
            <span class="v">{{ runs.toLocaleString() }}</span>
          </div>
          <div class="stat">
            <span class="k">Mean run length</span>
            <span class="v">{{ meanRun.toFixed(2) }}</span>
          </div>
          <div class="stat">
            <span class="k">After RLE</span>
            <span class="v" :class="expanded ? 'bad' : 'good'">
              {{ (encodedBits / 8 / 1024).toFixed(0) }} KB
              vs {{ (rawBits / 8 / 1024).toFixed(0) }} KB
            </span>
          </div>
        </div>

        <Fragment :index="1">
          <p class="verdict" :class="expanded ? 'bad' : 'good'">
            <template v-if="expanded">
              Almost every run is length 1, so almost every byte turns into two.
              RLE made the image <strong>{{ Math.round((encodedBits / rawBits - 1) * 100) }}% bigger</strong>.
              The encoder is fine — the data is in the wrong shape for it.
            </template>
            <template v-else-if="encodedBits / rawBits > 0.85">
              Flat regions save this one from disaster, but only just —
              <strong>{{ Math.round((1 - encodedBits / rawBits) * 100) }}% smaller</strong> is
              close to no compression at all. Try the photo to watch the same encoder lose outright.
            </template>
            <template v-else>
              This image has enough flat regions for RLE to win outright:
              <strong>{{ Math.round((1 - encodedBits / rawBits) * 100) }}% smaller</strong>.
              Try the photo to see the same encoder fail.
            </template>
          </p>
        </Fragment>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.bitmap-slide {
  display: flex;
  gap: 2rem;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.panel.wide {
  align-items: stretch;
  max-width: 26rem;
}

.panel canvas {
  max-width: 100%;
  max-height: 52vh;
  border-radius: 4px;
}

.caption {
  font-size: 0.62rem;
  color: var(--text-secondary);
}

h3 {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.histogram {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bar-row {
  display: grid;
  grid-template-columns: 3rem 1fr 4rem;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.bucket {
  color: var(--text-secondary);
  text-align: right;
}

.bar-track {
  height: 0.6rem;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}

/* Runs of one are where RLE loses money. */
.bar.hot {
  background: var(--negative);
}

.bar-count {
  color: var(--text-secondary);
}

.numbers {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.4rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.k {
  color: var(--text-secondary);
}

.good {
  color: var(--positive);
  font-weight: 600;
}

.bad {
  color: var(--negative);
  font-weight: 600;
}

.verdict {
  margin-top: 0.5rem;
  font-size: 0.7rem;
  line-height: 1.45;
  color: var(--text-secondary);
}
</style>
