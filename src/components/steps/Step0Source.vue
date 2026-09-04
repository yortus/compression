<script setup lang="ts">
import { inject, ref, onMounted, watch } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'

const pipeline = inject(PIPELINE_KEY)!
const canvasRef = ref<HTMLCanvasElement>()

function draw() {
  const img = pipeline.sourceImageData.value
  const canvas = canvasRef.value
  if (!img || !canvas) return
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(img, 0, 0)
}

watch(() => pipeline.sourceImageData.value, draw)
onMounted(draw)
</script>

<template>
  <SlideLayout>
    <div class="source-step">
      <div class="canvas-wrap">
        <canvas ref="canvasRef" v-loupe />
        <p v-if="!pipeline.sourceImageData.value" class="placeholder">
          Choose an image or select a sample above
        </p>
      </div>
      <div v-if="pipeline.sourceImageData.value" class="info">
        {{ pipeline.sourceImageData.value.width }} × {{ pipeline.sourceImageData.value.height }} pixels
        · {{ (pipeline.sourceImageData.value.width * pipeline.sourceImageData.value.height * 3 / 1024).toFixed(0) }} KB uncompressed
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.source-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  align-items: center;
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
  image-rendering: auto;
  border-radius: 4px;
}

.placeholder {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.info {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
