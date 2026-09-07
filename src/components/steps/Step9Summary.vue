<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { useStat } from '../../stats/useStats'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'
import { compareImages } from '../../engine/compare'
import { ratioVerdict } from '../../rendering/stamp'

const pipeline = inject(PIPELINE_KEY)!

const origCanvas = ref<HTMLCanvasElement>()
const reconCanvas = ref<HTMLCanvasElement>()
const diffCanvas = ref<HTMLCanvasElement>()

const compressionRatio = computed(() => {
  const src = pipeline.sourceImageData.value
  const cache = pipeline.cache.value
  if (!src || !cache) return null
  const rawBytes = src.width * src.height * 3
  const estimatedBytes = Math.ceil(estimateEncodedBits(cache) / 8)
  return {
    rawBytes,
    estimatedBytes,
    ratio: rawBytes / estimatedBytes,
  }
})

// The deck words every ratio the same way, so the badge borrows the stamp's verdict.
const verdict = computed(() => {
  const r = compressionRatio.value
  return r ? ratioVerdict(r.ratio) : null
})

// Whether this run actually lost anything is a measurement, not a property of the
// format: at Q100 with no chroma subsampling some images survive untouched.
const diff = computed(() => {
  const src = pipeline.sourceImageData.value
  const recon = pipeline.reconstructed.value
  return src && recon ? compareImages(src, recon) : null
})

// RMSE as a share of the full 0-255 range: an average "how far off" that reads more
// honestly than the single worst pixel maxChannelError reports.
const errorLevel = computed(() => {
  const d = diff.value
  if (!d || d.identical) return null
  const pct = (d.rmse / 255) * 100
  return pct < 1 ? '<1% average error' : `~${Math.round(pct)}% average error`
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
  drawDiff()
}

watch([() => pipeline.sourceImageData.value, () => pipeline.reconstructed.value], drawAll)
onMounted(drawAll)
</script>

<template>
  <SlideLayout>
    <div class="summary-step">
      <div class="canvases">
        <div class="canvas-col">
          <div class="canvas-wrap">
            <h3>Original</h3>
            <canvas ref="origCanvas" v-loupe />
            <!-- Invisible twin of a badge, so all three images share one baseline. -->
            <span class="badge spacer" aria-hidden="true">—</span>
          </div>
        </div>
        <div class="canvas-col">
          <div class="canvas-wrap">
            <h3>Reconstructed (Q={{ pipeline.quality.value }})</h3>
            <canvas ref="reconCanvas" v-loupe />
            <span v-if="verdict" class="badge" :class="verdict.better ? 'smaller' : 'bigger'">{{ verdict.text }}</span>
          </div>
        </div>
        <div class="canvas-col">
          <div class="canvas-wrap">
            <h3>Difference (×4 amplified)</h3>
            <canvas ref="diffCanvas" v-loupe />
            <span class="verdict" :class="diff?.identical ? 'lossless' : 'lossy'">
              {{ diff?.identical ? 'bit-identical' : errorLevel }}
            </span>
          </div>
        </div>
      </div>
    </div>

  </SlideLayout>
</template>

<style scoped>
.summary-step {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
  min-height: 0;
}

.canvas-col h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
  text-align: center;
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
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

/* The win under the reconstruction, the error rating under the difference, each read
   from the back of the room. */
.canvas-wrap .badge,
.canvas-wrap .verdict {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  padding: 0.2rem 0.7rem;
  border-radius: 6px;
  border: 2px solid var(--positive);
  color: var(--positive);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.canvas-wrap .badge.spacer {
  visibility: hidden;
}

.canvas-wrap .badge.bigger {
  border-color: var(--warning);
  color: var(--warning);
}

.canvas-wrap .verdict.lossy {
  color: var(--warning);
  border-color: var(--warning);
}

.canvas-wrap .verdict.lossless {
  color: var(--positive);
  border-color: var(--positive);
}

</style>
