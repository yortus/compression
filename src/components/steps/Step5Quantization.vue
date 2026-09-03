<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import StepShell from '../StepShell.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { scaleQTable, LUMA_TABLE } from '../../engine/quantization'
import { inverseDCT } from '../../engine/dct'
import { dequantize } from '../../engine/quantization'

const pipeline = inject(PIPELINE_KEY)!

const rawCanvas = ref<HTMLCanvasElement>()
const quantCanvas = ref<HTMLCanvasElement>()
const reconCanvas = ref<HTMLCanvasElement>()

const qTable = computed(() => scaleQTable(LUMA_TABLE, pipeline.quality.value))

const zeroCount = computed(() => {
  const q = pipeline.selectedQuantized.value
  if (!q) return 0
  let count = 0
  for (const row of q) for (const v of row) if (v === 0) count++
  return count
})

function drawCoeffGrid(canvas: HTMLCanvasElement | undefined, block: number[][] | null, isQuantized: boolean) {
  if (!canvas || !block) return
  const size = 320
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cellSize = size / 8

  let maxAbs = 1
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      maxAbs = Math.max(maxAbs, Math.abs(block[r][c]))

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = block[r][c]
      const norm = val / maxAbs

      if (isQuantized && val === 0) {
        ctx.fillStyle = '#1a1a2a'
      } else if (norm >= 0) {
        ctx.fillStyle = `rgb(${Math.round(norm * 220)}, 30, 30)`
      } else {
        ctx.fillStyle = `rgb(30, 30, ${Math.round(-norm * 220)})`
      }
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)

      ctx.fillStyle = isQuantized && val === 0 ? '#333' : '#fff'
      ctx.font = `${cellSize * 0.35}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(Math.round(val).toString(), c * cellSize + cellSize / 2, r * cellSize + cellSize / 2)
    }
  }
}

function drawRecon() {
  const q = pipeline.selectedQuantized.value
  const canvas = reconCanvas.value
  if (!q || !canvas) return

  const dq = dequantize(q, qTable.value)
  const recon = inverseDCT(dq)

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

function drawAll() {
  drawCoeffGrid(rawCanvas.value, pipeline.selectedDCT.value, false)
  drawCoeffGrid(quantCanvas.value, pipeline.selectedQuantized.value, true)
  drawRecon()
}

watch([() => pipeline.selectedDCT.value, () => pipeline.selectedQuantized.value, () => pipeline.quality.value], drawAll)
onMounted(drawAll)
</script>

<template>
  <StepShell title="Quantization" subtitle="Controlled information loss">
    <div class="quant-step">
      <div class="panel">
        <h3>DCT coefficients</h3>
        <canvas ref="rawCanvas" />
      </div>
      <div class="arrow">÷ Q →</div>
      <div class="panel">
        <h3>Quantized</h3>
        <canvas ref="quantCanvas" />
        <span class="zero-count">{{ zeroCount }}/64 zeros</span>
      </div>
      <div class="panel">
        <h3>Reconstructed block</h3>
        <canvas ref="reconCanvas" />
      </div>
    </div>
    <div class="quality-control">
      <label>
        Quality: {{ pipeline.quality.value }}
        <input type="range" min="1" max="100" v-model.number="pipeline.quality.value" />
      </label>
    </div>
    <template #detail>
      <ExpandablePanel label="How it works">
        <p>Each DCT coefficient is divided by a value from the quantization table and rounded to the nearest integer. Higher-frequency coefficients get divided by larger numbers, often becoming zero.</p>
        <p style="margin-top:0.5rem">This is the <strong>only lossy step</strong> in JPEG. Lower quality = larger divisors = more zeros = smaller file but more artifacts.</p>
      </ExpandablePanel>
    </template>
  </StepShell>
</template>

<style scoped>
.quant-step {
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
  font-size: 1.2rem;
  color: var(--accent);
  white-space: nowrap;
}

.zero-count {
  font-size: 0.8rem;
  color: var(--positive);
}

.quality-control {
  position: absolute;
  top: 1.5rem;
  right: 2rem;
}

.quality-control label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.quality-control input[type="range"] {
  width: 150px;
}
</style>
