<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { visible, cursorX, cursorY, sourceX, sourceY, source, LOUPE_SIZE, LOUPE_SRC } from './loupe'

const canvasRef = ref<HTMLCanvasElement>()

// Flip to the left of the cursor near the right edge, so the loupe never runs off screen.
const style = computed(() => {
  const offset = 20
  const flip = cursorX.value + offset + LOUPE_SIZE > window.innerWidth
  return {
    left: `${flip ? cursorX.value - offset - LOUPE_SIZE : cursorX.value + offset}px`,
    top: `${Math.max(4, Math.min(window.innerHeight - LOUPE_SIZE - 4, cursorY.value - LOUPE_SIZE / 2))}px`,
  }
})

function draw() {
  const lc = canvasRef.value
  const src = source.value
  if (!lc || !src || !visible.value) return

  lc.width = LOUPE_SIZE
  lc.height = LOUPE_SIZE
  const ctx = lc.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const half = LOUPE_SRC / 2
  ctx.drawImage(
    src,
    Math.round(sourceX.value - half), Math.round(sourceY.value - half), LOUPE_SRC, LOUPE_SRC,
    0, 0, LOUPE_SIZE, LOUPE_SIZE,
  )

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LOUPE_SIZE / 2, 0)
  ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE)
  ctx.moveTo(0, LOUPE_SIZE / 2)
  ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2)
  ctx.stroke()
}

watch([visible, sourceX, sourceY, source], () => requestAnimationFrame(draw))
</script>

<template>
  <div v-if="visible" class="loupe" :style="style">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.loupe {
  position: fixed;
  z-index: 900;
  pointer-events: none;
  border: 2px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
  line-height: 0;
}

.loupe canvas {
  display: block;
  image-rendering: pixelated;
}
</style>
