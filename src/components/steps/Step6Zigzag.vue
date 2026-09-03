<script setup lang="ts">
import { inject, ref, watch, onMounted, onUnmounted, computed } from 'vue'
import StepShell from '../StepShell.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ZIGZAG_ORDER } from '../../engine/zigzag'
import gsap from 'gsap'

const pipeline = inject(PIPELINE_KEY)!

const gridCanvas = ref<HTMLCanvasElement>()
const arrayCanvas = ref<HTMLCanvasElement>()

const animIndex = ref(64)
const isPlaying = ref(false)
let tween: gsap.core.Tween | null = null

const zigzag = computed(() => pipeline.selectedZigzag.value)

function play() {
  stop()
  animIndex.value = 0
  isPlaying.value = true
  tween = gsap.to(animIndex, {
    value: 64,
    duration: 3,
    ease: 'none',
    onUpdate: () => {
      animIndex.value = Math.round(animIndex.value)
      draw()
    },
    onComplete: () => { isPlaying.value = false },
  })
}

function stop() {
  tween?.kill()
  tween = null
  isPlaying.value = false
}

function reset() {
  stop()
  animIndex.value = 64
  draw()
}

function draw() {
  drawGrid()
  drawArray()
}

function drawGrid() {
  const q = pipeline.selectedQuantized.value
  const canvas = gridCanvas.value
  if (!q || !canvas) return

  const size = 320
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cell = size / 8

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = q[r][c]
      ctx.fillStyle = val === 0 ? '#1a1a2a' : '#2a2a4a'
      ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1)

      ctx.fillStyle = val === 0 ? '#444' : '#ddd'
      ctx.font = `${cell * 0.35}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(val.toString(), c * cell + cell / 2, r * cell + cell / 2)
    }
  }

  // Draw zigzag path up to animIndex
  ctx.strokeStyle = 'var(--accent)'
  ctx.lineWidth = 2
  ctx.beginPath()
  const limit = Math.min(animIndex.value, 64)
  for (let i = 0; i < limit; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    const x = c * cell + cell / 2
    const y = r * cell + cell / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Dot at current position
  if (limit > 0 && limit <= 64) {
    const [r, c] = ZIGZAG_ORDER[limit - 1]
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(c * cell + cell / 2, r * cell + cell / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawArray() {
  const z = zigzag.value
  const canvas = arrayCanvas.value
  if (!z || !canvas) return

  const w = 640
  const h = 48
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const cellW = w / 64

  for (let i = 0; i < 64; i++) {
    const revealed = i < animIndex.value
    ctx.fillStyle = !revealed ? '#111' : z[i] === 0 ? '#1a1a2a' : '#2a2a4a'
    ctx.fillRect(i * cellW, 0, cellW - 0.5, h)

    if (revealed) {
      ctx.fillStyle = z[i] === 0 ? '#444' : '#ddd'
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(z[i].toString(), i * cellW + cellW / 2, h / 2)
    }
  }
}

watch([() => pipeline.selectedQuantized.value, () => pipeline.selectedZigzag.value], () => { reset() })
onMounted(draw)
onUnmounted(stop)
</script>

<template>
  <StepShell title="Zigzag Scan" subtitle="2D → 1D ordering">
    <div class="zigzag-step">
      <div class="top-row">
        <div class="panel">
          <h3>8×8 quantized coefficients</h3>
          <canvas ref="gridCanvas" />
        </div>
        <div class="controls-col">
          <button @click="play" :disabled="isPlaying">▶ Play</button>
          <button @click="stop" :disabled="!isPlaying">⏸ Pause</button>
          <button @click="reset">↺ Reset</button>
        </div>
      </div>
      <div class="bottom">
        <h3>1D output (zigzag order)</h3>
        <canvas ref="arrayCanvas" />
        <p class="hint">Zeros cluster at the end — great for RLE compression</p>
      </div>
    </div>
    <template #detail>
      <ExpandablePanel label="How it works">
        <p>The zigzag scan reads the 8×8 coefficient matrix in a diagonal pattern, starting from the top-left (DC) and ending at the bottom-right (highest frequency).</p>
        <p style="margin-top:0.5rem">Since quantization zeros out most high-frequency coefficients, the zigzag order groups those zeros at the end of the 1D sequence — perfect for run-length encoding.</p>
      </ExpandablePanel>
    </template>
  </StepShell>
</template>

<style scoped>
.zigzag-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.top-row {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
}

.panel h3, .bottom h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.panel canvas {
  border-radius: 4px;
  image-rendering: pixelated;
}

.controls-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bottom canvas {
  border-radius: 4px;
}

.hint {
  font-size: 0.8rem;
  color: var(--positive);
  margin-top: 0.5rem;
}
</style>
