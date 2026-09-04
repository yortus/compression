<script setup lang="ts">
import { inject, ref, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { basisFunction, partialInverseDCT } from '../../engine/jpeg/dct'
import { ZIGZAG_ORDER } from '../../engine/jpeg/zigzag'

const pipeline = inject(PIPELINE_KEY)!

const spatialCanvas = ref<HTMLCanvasElement>()
const freqCanvas = ref<HTMLCanvasElement>()
const basisCanvas = ref<HTMLCanvasElement>()

const showBasis = ref(false)
const buildCount = ref(64)

function drawSpatial() {
  const dct = pipeline.selectedDCT.value
  const canvas = spatialCanvas.value
  if (!dct || !canvas) return

  const recon = partialInverseDCT(dct, buildCount.value)

  const size = 320
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cellSize = size / 8

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = Math.max(0, Math.min(255, Math.round(recon[r][c])))
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

  // Dim coefficients beyond buildCount
  for (let i = buildCount.value; i < 64; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
  }
}

function drawBasis() {
  const canvas = basisCanvas.value
  if (!canvas) return
  const total = 320
  canvas.width = total
  canvas.height = total
  const ctx = canvas.getContext('2d')!
  const cell = total / 8

  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      const bf = basisFunction(u, v)
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const val = Math.max(0, Math.min(255, Math.round(bf[x][y])))
          ctx.fillStyle = `rgb(${val},${val},${val})`
          const px = v * cell + y * (cell / 8)
          const py = u * cell + x * (cell / 8)
          ctx.fillRect(px, py, cell / 8 + 0.5, cell / 8 + 0.5)
        }
      }
    }
  }
}

function drawAll() {
  drawSpatial()
  drawFreq()
  if (showBasis.value) drawBasis()
}

watch([() => pipeline.selectedBlock.value, () => pipeline.selectedDCT.value, showBasis, buildCount], drawAll)
onMounted(drawAll)
</script>

<template>
  <SlideLayout>
    <div class="dct-step">
      <div class="panel">
        <h3>Reconstruction ({{ buildCount }}/64 coefficients)</h3>
        <canvas ref="spatialCanvas" />
      </div>
      <div class="arrow">←</div>
      <div class="panel">
        <h3>Frequency (DCT coefficients)</h3>
        <canvas ref="freqCanvas" />
      </div>
      <div v-if="showBasis" class="panel">
        <h3>Basis functions</h3>
        <canvas ref="basisCanvas" />
      </div>
    </div>
    <div class="toolbar">
      <label class="build-slider">
        Coefficients: {{ buildCount }}/64
        <input type="range" min="0" max="64" v-model.number="buildCount" />
      </label>
      <button :class="{ active: showBasis }" @click="showBasis = !showBasis">
        {{ showBasis ? 'Hide' : 'Show' }} Basis Functions
      </button>
    </div>
    <template #notes>
      <ExpandablePanel label="How it works">
        <p>The DCT transforms an 8×8 block of pixel values into 8×8 frequency coefficients.</p>
        <p style="margin-top:0.5rem">The top-left coefficient (DC) is the average brightness. Moving right/down increases horizontal/vertical frequency. Most image energy concentrates in the low-frequency (top-left) coefficients.</p>
      </ExpandablePanel>
    </template>
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

.toolbar {
  position: absolute;
  top: 1.5rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.build-slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.build-slider input[type="range"] {
  width: 140px;
}
</style>
