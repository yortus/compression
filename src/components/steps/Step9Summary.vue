<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { useStat } from '../../stats/useStats'
import { formatBytes } from '../../stats/types'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'
import { compareImages } from '../../engine/compare'

const pipeline = inject(PIPELINE_KEY)!

type ViewMode = 'side-by-side' | 'diff'
const viewMode = ref<ViewMode>('side-by-side')

const origCanvas = ref<HTMLCanvasElement>()
const reconCanvas = ref<HTMLCanvasElement>()
const diffCanvas = ref<HTMLCanvasElement>()

const kb = (bytes: number) => formatBytes(bytes * 8)

const compressionRatio = computed(() => {
  const src = pipeline.sourceImageData.value
  const cache = pipeline.cache.value
  if (!src || !cache) return null
  const rawBytes = src.width * src.height * 3
  const estimatedBytes = Math.ceil(estimateEncodedBits(cache) / 8)
  return {
    rawBytes,
    estimatedBytes,
    ratio: (rawBytes / estimatedBytes).toFixed(1),
    percent: Math.round((1 - estimatedBytes / rawBytes) * 100),
  }
})

// Whether this run actually lost anything is a measurement, not a property of the
// format: at Q100 with no chroma subsampling some images survive untouched.
const diff = computed(() => {
  const src = pipeline.sourceImageData.value
  const recon = pipeline.reconstructed.value
  return src && recon ? compareImages(src, recon) : null
})

useStat('jpeg-result', () => {
  const r = compressionRatio.value
  if (!r) return null
  return {
    label: 'JPEG · whole image',
    rawBits: r.rawBytes * 8,
    encodedBits: r.estimatedBytes * 8,
    overheadBits: 0,
    lossy: !diff.value?.identical,
    note: diff.value?.identical
      ? `Q=${pipeline.quality.value} · reconstruction is bit-identical`
      : `idealised · Q=${pipeline.quality.value} · max error ${diff.value?.maxChannelError ?? 0}/255`,
  }
})

function drawOriginal() {
  const src = pipeline.sourceImageData.value
  const canvas = origCanvas.value
  if (!src || !canvas) return
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d')!.putImageData(src, 0, 0)
}

function drawRecon() {
  const recon = pipeline.reconstructed.value
  const canvas = reconCanvas.value
  if (!recon || !canvas) return
  canvas.width = recon.width
  canvas.height = recon.height
  canvas.getContext('2d')!.putImageData(recon, 0, 0)
}

function drawDiff() {
  const src = pipeline.sourceImageData.value
  const recon = pipeline.reconstructed.value
  const canvas = diffCanvas.value
  if (!src || !recon || !canvas) return

  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')!
  const diff = ctx.createImageData(src.width, src.height)

  for (let i = 0; i < src.data.length; i += 4) {
    const dr = Math.abs(src.data[i] - recon.data[i])
    const dg = Math.abs(src.data[i + 1] - recon.data[i + 1])
    const db = Math.abs(src.data[i + 2] - recon.data[i + 2])
    const scale = 4
    diff.data[i] = Math.min(255, dr * scale)
    diff.data[i + 1] = Math.min(255, dg * scale)
    diff.data[i + 2] = Math.min(255, db * scale)
    diff.data[i + 3] = 255
  }

  ctx.putImageData(diff, 0, 0)
}

function drawAll() {
  drawOriginal()
  drawRecon()
  if (viewMode.value === 'diff') drawDiff()
}

watch([() => pipeline.sourceImageData.value, () => pipeline.reconstructed.value, viewMode], drawAll)
onMounted(drawAll)
</script>

<template>
  <SlideLayout>
    <div class="summary-step">
      <div class="controls">
        <button :class="{ active: viewMode === 'side-by-side' }" @click="viewMode = 'side-by-side'">Side by Side</button>
        <button :class="{ active: viewMode === 'diff' }" @click="viewMode = 'diff'">Diff View</button>
      </div>

      <div class="canvases" v-if="viewMode === 'side-by-side'">
        <div class="canvas-col">
          <h3>Original</h3>
          <div class="canvas-wrap">
            <canvas ref="origCanvas" v-loupe />
          </div>
        </div>
        <div class="canvas-col">
          <h3>Reconstructed (Q={{ pipeline.quality.value }})</h3>
          <div class="canvas-wrap">
            <canvas ref="reconCanvas" v-loupe />
          </div>
        </div>
      </div>

      <div class="canvases" v-else>
        <div class="canvas-col">
          <h3>Difference (×4 amplified)</h3>
          <div class="canvas-wrap">
            <canvas ref="diffCanvas" v-loupe />
          </div>
        </div>
      </div>

      <!-- The finale's one number. It used to live in the shell's stats strip; the slide
           computes it either way, and this is where the audience is already looking. -->
      <div v-if="compressionRatio" class="result">
        <span class="ratio">{{ compressionRatio.ratio }}:1</span>
        <span class="sizes">
          {{ kb(compressionRatio.rawBytes) }} → {{ kb(compressionRatio.estimatedBytes) }}
          <span class="saved">−{{ compressionRatio.percent }}%</span>
        </span>
        <span class="verdict" :class="diff?.identical ? 'lossless' : 'lossy'">
          {{ diff?.identical
            ? 'bit-identical'
            : `max error ${diff?.maxChannelError ?? 0}/255` }}
        </span>
      </div>
    </div>

  </SlideLayout>
</template>

<style scoped>
.summary-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-shrink: 0;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.controls input[type="range"] {
  width: 150px;
}

.canvases {
  display: flex;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.canvas-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}

.canvas-col h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-wrap canvas {
  cursor: crosshair;
}

.canvas-wrap canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

/* One row, read from the back of the room: the ratio big, the arithmetic behind it
   next to it, and the measured verdict last. */
.result {
  display: flex;
  align-items: baseline;
  gap: 1.4rem;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.result .ratio {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--positive);
}

.result .sizes {
  font-size: 0.95rem;
  color: var(--text);
}

.result .saved {
  color: var(--text-secondary);
}

.result .verdict {
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.result .verdict.lossy {
  color: var(--warning);
  border-color: var(--warning);
}

.result .verdict.lossless {
  color: var(--positive);
  border-color: var(--positive);
}

</style>
