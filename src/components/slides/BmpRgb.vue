<script setup lang="ts">
import { inject, ref, computed, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { interleavedBytes } from '../../engine/codecs/planes'
import { countRuns, runLengthHistogram } from '../../engine/codecs/rle'
import { BMP_HEADER_BYTES, uncompressedSize } from '../../engine/formats/bmp'
import { useStat } from '../../stats/useStats'

/**
 * The same encoder from the last three slides, pointed at a real 24-bit bitmap.
 *
 * The payoff is a fact about the format rather than a claim of ours: BMP has `BI_RLE8`
 * and `BI_RLE4` and no 24-bit run-length mode at all. This slide is what that missing
 * mode looks like from the inside — nearly every run is length one, so nearly every byte
 * turns into two.
 */

const pipeline = inject(PIPELINE_KEY)!
const canvasRef = ref<HTMLCanvasElement>()

const source = computed(() => pipeline.sourceImageData.value)
const bytes = computed(() => (source.value ? interleavedBytes(source.value) : null))

const runs = computed(() => (bytes.value ? countRuns(bytes.value) : 0))
const histogram = computed(() => (bytes.value ? runLengthHistogram(bytes.value) : []))
const histogramMax = computed(() => Math.max(1, ...histogram.value))
const meanRun = computed(() => (runs.value ? bytes.value!.length / runs.value : 0))

/** The real file: 54 bytes of header and three bytes a pixel, rows padded to four. */
const fileBytes = computed(() =>
  source.value ? uncompressedSize(source.value.width, source.value.height, 24) : 0)

/** What a 24-bit RLE mode would cost, if the format had one. It does not. */
const rleBytes = computed(() => BMP_HEADER_BYTES + runs.value * 2)
const expanded = computed(() => rleBytes.value > fileBytes.value)
const change = computed(() =>
  fileBytes.value ? rleBytes.value / fileBytes.value - 1 : 0)

useStat('bmp-rgb', () => {
  if (!bytes.value) return null
  return {
    label: 'RLE over 24-bit BMP pixels',
    rawBits: fileBytes.value * 8,
    encodedBits: runs.value * 16,
    overheadBits: BMP_HEADER_BYTES * 8,
    lossy: false,
    note: 'hypothetical — BMP has no 24-bit RLE mode',
  }
})

function draw() {
  const src = source.value
  const canvas = canvasRef.value
  if (!src || !canvas) return
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d')!.putImageData(src, 0, 0)
}

watch(source, draw)
onMounted(draw)

function kb(b: number) {
  return (b / 1024).toFixed(0) + ' KB'
}

const BUCKET_LABELS = ['1', '2–3', '4–7', '8–15', '16–31', '32–63', '64–127', '128+']
</script>

<template>
  <SlideLayout>
    <div class="bitmap-slide">
      <div class="panel">
        <canvas ref="canvasRef" v-loupe />
        <p class="caption">
          <code>biBitCount = 24</code> · <code>biCompression = BI_RGB</code><br />
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
            <span class="k">Mean run length</span>
            <span class="v">{{ meanRun.toFixed(2) }}</span>
          </div>
          <div class="stat">
            <span class="k">The file as it stands</span>
            <span class="v">{{ kb(fileBytes) }}</span>
          </div>
          <div class="stat total">
            <span class="k">If we run-length coded it</span>
            <span class="v" :class="expanded ? 'bad' : 'good'">
              {{ kb(rleBytes) }}
              <span class="pct">{{ change > 0 ? '+' : '' }}{{ Math.round(change * 100) }}%</span>
            </span>
          </div>
        </div>

        <Fragment :index="1">
          <p class="verdict">
            <template v-if="expanded">
              Almost every run is length one, so almost every byte becomes two and the file gets
              <strong class="bad">{{ Math.round(change * 100) }}% bigger</strong>. The encoder is
              fine; the data is the wrong shape for it.
            </template>
            <template v-else>
              This image has enough flat area to survive —
              <strong class="good">{{ Math.round(-change * 100) }}% smaller</strong>. Switch to the
              photo and watch the same encoder lose outright.
            </template>
          </p>
          <p class="verdict aside">
            Which is why you cannot actually save this file that way. BMP offers
            <code>BI_RLE8</code> and <code>BI_RLE4</code> and no 24-bit run-length mode whatsoever —
            the format will only run-length code an image whose pixels have already been turned
            into something else.
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
  max-height: 48vh;
  border-radius: 4px;
}

.caption {
  font-size: 0.6rem;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

code {
  font-size: 0.92em;
  color: var(--accent);
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

.stat.total {
  border-top: 1px solid var(--border);
  padding-top: 0.3rem;
  font-weight: 600;
}

.k {
  color: var(--text-secondary);
  font-size: 0.62rem;
}

.pct {
  font-size: 0.85em;
}

.good {
  color: var(--positive);
}

.bad {
  color: var(--negative);
}

.verdict {
  margin-top: 0.5rem;
  font-size: 0.68rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.verdict.aside {
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border);
  font-size: 0.64rem;
}
</style>
