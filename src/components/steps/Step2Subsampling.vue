<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { useStat } from '../../stats/useStats'

const pipeline = inject(PIPELINE_KEY)!

const canvasRef = ref<HTMLCanvasElement>()

// Three full-resolution planes in, one full plus two reduced planes out.
useStat('chroma-subsample', () => {
  const sub = pipeline.subsampled.value
  if (!sub) return null
  const rawSamples = sub.yWidth * sub.yHeight * 3
  const keptSamples = sub.yWidth * sub.yHeight + 2 * sub.chromaWidth * sub.chromaHeight
  return {
    label: `Chroma subsampling · ${sub.mode}`,
    rawBits: rawSamples * 8,
    encodedBits: keptSamples * 8,
    overheadBits: 0,
    lossy: sub.mode !== '4:4:4',
  }
})

const savings = computed(() => {
  const m = pipeline.subsamplingMode.value
  if (m === '4:4:4') return '0%'
  if (m === '4:2:2') return '33%'
  return '50%'
})

function draw() {
  const sub = pipeline.subsampled.value
  const canvas = canvasRef.value
  if (!sub || !canvas) return

  const { y, cb, cr, yWidth, yHeight, chromaWidth, chromaHeight } = sub
  canvas.width = yWidth
  canvas.height = yHeight
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(yWidth, yHeight)

  // Reconstruct with nearest-neighbour upsample for visualisation
  for (let row = 0; row < yHeight; row++) {
    const cRow = Math.min(Math.floor(row * chromaHeight / yHeight), chromaHeight - 1)
    for (let col = 0; col < yWidth; col++) {
      const cCol = Math.min(Math.floor(col * chromaWidth / yWidth), chromaWidth - 1)
      const yVal = y[row * yWidth + col]
      const cbVal = cb[cRow * chromaWidth + cCol]
      const crVal = cr[cRow * chromaWidth + cCol]
      const r = yVal + 1.402 * (crVal - 128)
      const g = yVal - 0.344136 * (cbVal - 128) - 0.714136 * (crVal - 128)
      const b = yVal + 1.772 * (cbVal - 128)
      const off = (row * yWidth + col) * 4
      imgData.data[off] = Math.max(0, Math.min(255, Math.round(r)))
      imgData.data[off + 1] = Math.max(0, Math.min(255, Math.round(g)))
      imgData.data[off + 2] = Math.max(0, Math.min(255, Math.round(b)))
      imgData.data[off + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
}

watch(() => pipeline.subsampled.value, draw)
onMounted(draw)
</script>

<template>
  <SlideLayout>
    <div class="sub-step">
      <div class="controls">
        <span class="mode">{{ pipeline.subsamplingMode.value }}</span>
        <span class="savings">{{ savings }} data reduction</span>
      </div>
      <div class="canvas-wrap">
        <canvas ref="canvasRef" v-loupe />
      </div>
    </div>
    <template #notes>
      <ExpandablePanel label="How it works">
        <p><strong>4:4:4</strong> — no subsampling. Full chroma resolution.</p>
        <p><strong>4:2:2</strong> — chroma halved horizontally.</p>
        <p><strong>4:2:0</strong> — chroma halved in both dimensions. Most common in JPEG.</p>
      </ExpandablePanel>
    </template>
  </SlideLayout>
</template>

<style scoped>
.sub-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  align-items: center;
}

.controls {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.mode {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.savings {
  margin-left: 1rem;
  font-size: 0.85rem;
  color: var(--positive);
}

.canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.canvas-wrap canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: 4px;
}
</style>
