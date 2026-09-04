<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { useStat } from '../../stats/useStats'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'

const pipeline = inject(PIPELINE_KEY)!

type ViewMode = 'side-by-side' | 'diff'
const viewMode = ref<ViewMode>('side-by-side')

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
    ratio: (rawBytes / estimatedBytes).toFixed(1),
    percent: Math.round((1 - estimatedBytes / rawBytes) * 100),
  }
})

useStat('jpeg-result', () => {
  const r = compressionRatio.value
  if (!r) return null
  return {
    label: 'JPEG · whole image',
    rawBits: r.rawBytes * 8,
    encodedBits: r.estimatedBytes * 8,
    overheadBits: 0,
    lossy: true,
    note: `idealised · Q=${pipeline.quality.value} · no code tables`,
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

    </div>

    <template #notes>
      <ExpandablePanel label="Full pipeline summary">
        <p>Decode reverses the pipeline: dequantize → inverse DCT → merge blocks → upsample chroma → YCbCr → RGB.</p>
        <p style="margin-top:0.5rem">The only information lost is in the quantization step. Everything else is reversible.</p>
      </ExpandablePanel>
    </template>
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

.stats {
  display: flex;
  gap: 2rem;
  flex-shrink: 0;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stat .value {
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat .value.accent {
  color: var(--positive);
}

</style>
