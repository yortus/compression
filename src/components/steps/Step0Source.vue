<script setup lang="ts">
import { inject, ref, onMounted, watch } from 'vue'
import StepShell from '../StepShell.vue'
import ImagePicker from '../ImagePicker.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'

const pipeline = inject(PIPELINE_KEY)!
const canvasRef = ref<HTMLCanvasElement>()

function onLoad(imageData: ImageData) {
  pipeline.loadImage(imageData)
}

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
  <StepShell title="Source Image" subtitle="The starting point">
    <div class="source-step">
      <ImagePicker @load="onLoad" />
      <div class="canvas-wrap">
        <canvas ref="canvasRef" />
        <p v-if="!pipeline.sourceImageData.value" class="placeholder">
          Choose an image or select a sample above
        </p>
      </div>
      <div v-if="pipeline.sourceImageData.value" class="info">
        {{ pipeline.sourceImageData.value.width }} × {{ pipeline.sourceImageData.value.height }} pixels
        · {{ (pipeline.sourceImageData.value.width * pipeline.sourceImageData.value.height * 3 / 1024).toFixed(0) }} KB uncompressed
      </div>
    </div>
  </StepShell>
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
