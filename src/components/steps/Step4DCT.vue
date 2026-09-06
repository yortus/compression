<script setup lang="ts">
import { inject, ref, computed, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ZIGZAG_ORDER } from '../../engine/jpeg/zigzag'

/**
 * The transform itself: 64 pixel values in, 64 coefficients out, nothing lost and
 * nothing yet gained. The build-up from individual patterns is the next slide's job.
 */
const pipeline = inject(PIPELINE_KEY)!

const spatialCanvas = ref<HTMLCanvasElement>()
const freqCanvas = ref<HTMLCanvasElement>()

/**
 * Share of the block's energy sitting in the first eight coefficients — the number that
 * makes the DCT worth doing, and it is a fact about the image, not about the transform.
 */
const compaction = computed(() => {
  const dct = pipeline.selectedDCT.value
  if (!dct) return 0
  let head = 0
  let total = 0
  for (let i = 0; i < 64; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    const e = dct[r][c] ** 2
    total += e
    if (i < 8) head += e
  }
  return total > 0 ? head / total : 0
})

function drawSpatial() {
  const block = pipeline.selectedBlock.value
  const canvas = spatialCanvas.value
  if (!block || !canvas) return

  const size = 320
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cellSize = size / 8

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = Math.max(0, Math.min(255, Math.round(block[r][c])))
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
    }
  }
}

function drawFreq() {
  const dct = pipeline.selectedDCT.value
  const canvas = freqCanvas.value
  if (!dct || !canvas) return

  const size = 320
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cellSize = size / 8

  let maxAbs = 1
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      maxAbs = Math.max(maxAbs, Math.abs(dct[r][c]))

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = dct[r][c]
      const norm = val / maxAbs

      if (norm >= 0) {
        ctx.fillStyle = `rgb(${Math.round(norm * 255)}, 0, 0)`
      } else {
        ctx.fillStyle = `rgb(0, 0, ${Math.round(-norm * 255)})`
      }
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)

      ctx.fillStyle = '#fff'
      ctx.font = `${cellSize * 0.35}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(Math.round(val).toString(), c * cellSize + cellSize / 2, r * cellSize + cellSize / 2)
    }
  }
}

function drawAll() {
  drawSpatial()
  drawFreq()
}

watch([() => pipeline.selectedBlock.value, () => pipeline.selectedDCT.value], drawAll)
onMounted(drawAll)
</script>

<template>
  <SlideLayout>
    <div class="dct-step">
      <div class="panel">
        <h3>8×8 pixels</h3>
        <canvas ref="spatialCanvas" />
      </div>
      <div class="arrow">→</div>
      <div class="panel">
        <h3>64 DCT coefficients</h3>
        <canvas ref="freqCanvas" />
        <p class="compaction">
          <strong>{{ (compaction * 100).toFixed(0) }}%</strong> of this block's energy is in the
          first 8 coefficients
        </p>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.dct-step {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.panel h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.panel canvas {
  border-radius: 4px;
  image-rendering: pixelated;
}

.arrow {
  font-size: 2rem;
  color: var(--accent);
}

.compaction {
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.compaction strong {
  color: var(--positive);
}
</style>
