<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { channelToImageData } from '../../engine/jpeg/colorspace'
import { ZIGZAG_ORDER } from '../../engine/jpeg/zigzag'
import { partialInverseDCT } from '../../engine/jpeg/dct'

const pipeline = inject(PIPELINE_KEY)!

type DetailTab = 'pixels' | 'dct' | 'quantized' | 'scan' | 'build'
const activeTab = ref<DetailTab>('pixels')
const buildCount = ref(64)

const gridCanvas = ref<HTMLCanvasElement>()
const detailCanvas = ref<HTMLCanvasElement>()

const GRID_SIZE = 360
const CELL = GRID_SIZE / 8


const blockCount = computed(() => {
  const b = pipeline.allBlocks.value
  return b ? b.y.blocks.length : 0
})

const blocksPerRow = computed(() => {
  const b = pipeline.allBlocks.value
  return b ? b.y.blocksPerRow : 0
})

const zeroCount = computed(() => {
  const q = pipeline.selectedQuantized.value
  if (!q) return 0
  let n = 0
  for (const row of q) for (const v of row) if (v === 0) n++
  return n
})

// --- Grid drawing ---
function drawGrid() {
  const b = pipeline.allBlocks.value
  const ycbcr = pipeline.ycbcr.value
  const canvas = gridCanvas.value
  if (!b || !ycbcr || !canvas) return

  const { y, width, height } = ycbcr
  const imgData = channelToImageData(y, width, height)

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imgData, 0, 0)

  ctx.strokeStyle = 'rgba(108, 140, 255, 0.3)'
  ctx.lineWidth = 1
  for (let x = 0; x <= width; x += 8) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke()
  }
  for (let yy = 0; yy <= height; yy += 8) {
    ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(width, yy + 0.5); ctx.stroke()
  }

  const si = pipeline.selectedBlockIndex.value
  const bx = si % b.y.blocksPerRow
  const by = Math.floor(si / b.y.blocksPerRow)
  ctx.strokeStyle = 'rgba(108, 140, 255, 0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(bx * 8, by * 8, 8, 8)
}

// --- Detail panel drawing ---
function drawDetail() {
  const canvas = detailCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE)

  switch (activeTab.value) {
    case 'pixels': drawPixels(ctx); break
    case 'dct': drawCoeffs(ctx, pipeline.selectedDCT.value, false); break
    case 'quantized': drawCoeffs(ctx, pipeline.selectedQuantized.value, true); break
    case 'scan': drawScan(ctx); break
    case 'build': drawBuild(ctx); break
  }
}

function drawPixels(ctx: CanvasRenderingContext2D) {
  const block = pipeline.selectedBlock.value
  if (!block) return

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = Math.max(0, Math.min(255, Math.round(block[r][c])))
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
      ctx.fillStyle = v > 128 ? '#000' : '#fff'
      ctx.font = `${CELL * 0.38}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(Math.round(block[r][c]).toString(), c * CELL + CELL / 2, r * CELL + CELL / 2)
    }
  }
}

function drawCoeffs(ctx: CanvasRenderingContext2D, block: number[][] | null, isQuantized: boolean) {
  if (!block) return

  let maxAbs = 1
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      maxAbs = Math.max(maxAbs, Math.abs(block[r][c]))

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = block[r][c]
      const norm = val / maxAbs

      if (isQuantized && val === 0) ctx.fillStyle = '#1a1a2a'
      else if (norm >= 0) ctx.fillStyle = `rgb(${Math.round(norm * 220)}, 30, 30)`
      else ctx.fillStyle = `rgb(30, 30, ${Math.round(-norm * 220)})`

      ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
      ctx.fillStyle = isQuantized && val === 0 ? '#444' : '#fff'
      ctx.font = `${CELL * 0.35}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(Math.round(val).toString(), c * CELL + CELL / 2, r * CELL + CELL / 2)
    }
  }
}

function drawScan(ctx: CanvasRenderingContext2D) {
  // Draw quantized grid as background
  drawCoeffs(ctx, pipeline.selectedQuantized.value, true)

  // Overlay zigzag path
  ctx.strokeStyle = 'rgba(108, 140, 255, 0.8)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 64; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    const x = c * CELL + CELL / 2
    const y = r * CELL + CELL / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawBuild(ctx: CanvasRenderingContext2D) {
  const dct = pipeline.selectedDCT.value
  if (!dct) return

  const recon = partialInverseDCT(dct, buildCount.value)

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = Math.max(0, Math.min(255, Math.round(recon[r][c])))
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
      ctx.fillStyle = v > 128 ? '#000' : '#fff'
      ctx.font = `${CELL * 0.38}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(Math.round(recon[r][c]).toString(), c * CELL + CELL / 2, r * CELL + CELL / 2)
    }
  }
}

function onGridClick(e: MouseEvent) {
  const b = pipeline.allBlocks.value
  const canvas = gridCanvas.value
  if (!b || !canvas) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const px = (e.clientX - rect.left) * scaleX
  const py = (e.clientY - rect.top) * scaleY
  const bx = Math.floor(px / 8)
  const by = Math.floor(py / 8)
  const idx = by * b.y.blocksPerRow + bx
  if (idx >= 0 && idx < b.y.blocks.length) {
    pipeline.selectedBlockIndex.value = idx
  }
}

watch([
  () => pipeline.allBlocks.value,
  () => pipeline.selectedBlockIndex.value,
  () => pipeline.selectedDCT.value,
  () => pipeline.selectedQuantized.value,
  () => pipeline.quality.value,
  activeTab,
  buildCount,
], () => { drawGrid(); drawDetail() })

onMounted(() => { drawGrid(); drawDetail() })
</script>

<template>
  <SlideLayout>
    <div class="blocks-step">
      <div class="grid-panel">
        <p class="hint">Click a block to inspect it</p>
        <div class="canvas-wrap">
          <canvas ref="gridCanvas" v-loupe @click="onGridClick" />
        </div>
        <p class="meta">{{ blocksPerRow }} × {{ Math.ceil(blockCount / blocksPerRow) }} blocks ({{ blockCount }} total)</p>
      </div>

      <div class="detail-panel">
        <div class="detail-header">
          <h3>Block {{ pipeline.selectedBlockIndex.value }}</h3>
          <div class="tabs">
            <button v-for="tab in (['pixels', 'dct', 'quantized', 'scan', 'build'] as const)" :key="tab"
              :class="{ active: activeTab === tab }"
              @click="activeTab = tab"
            >{{ { pixels: 'Pixels', dct: 'DCT', quantized: 'Quantized', scan: 'Scan', build: 'Build' }[tab] }}</button>
          </div>
        </div>

        <canvas ref="detailCanvas" :width="GRID_SIZE" :height="GRID_SIZE" />

        <div class="detail-footer">
          <template v-if="activeTab === 'build'">
            <label class="quality-label">
              Coefficients: {{ buildCount }}/64
              <input type="range" min="0" max="64" v-model.number="buildCount" />
            </label>
          </template>
          <template v-else>
            <span class="zero-badge">{{ zeroCount }}/64 zeros</span>
          </template>
        </div>
      </div>
    </div>
    <template #notes>
      <ExpandablePanel label="How it works">
        <p>Each 8×8 block goes through the full JPEG pipeline independently: DCT → Quantize → Zigzag scan → RLE → Huffman.</p>
        <p style="margin-top:0.5rem">Use the tabs to walk through each stage for the selected block.</p>
      </ExpandablePanel>
    </template>
  </SlideLayout>
</template>

<style scoped>
.blocks-step {
  display: flex;
  gap: 2rem;
  width: 100%;
  height: 100%;
}

.grid-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
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
  image-rendering: pixelated;
}

.meta {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.detail-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detail-header h3 {
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
}

.tabs {
  display: flex;
  gap: 0.25rem;
}

.detail-panel canvas {
  width: 360px;
  height: 360px;
  border-radius: 4px;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.detail-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 1.5rem;
}

.quality-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.quality-label input[type="range"] {
  width: 120px;
}

.zero-badge {
  font-size: 0.85rem;
  color: var(--positive);
  font-weight: 600;
}

.tab-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
