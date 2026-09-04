<script setup lang="ts">
import { inject, ref, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { channelToImageData } from '../../engine/jpeg/colorspace'

const pipeline = inject(PIPELINE_KEY)!

type Channel = 'rgb' | 'y' | 'cb' | 'cr'
const activeChannel = ref<Channel>('rgb')

const canvasRef = ref<HTMLCanvasElement>()

function draw() {
  const ycbcr = pipeline.ycbcr.value
  const src = pipeline.sourceImageData.value
  const canvas = canvasRef.value
  if (!canvas || !ycbcr || !src) return

  const { y, cb, cr, width, height } = ycbcr
  let imgData: ImageData

  switch (activeChannel.value) {
    case 'y':
      imgData = channelToImageData(y, width, height)
      break
    case 'cb':
      imgData = channelToImageData(cb, width, height)
      break
    case 'cr':
      imgData = channelToImageData(cr, width, height)
      break
    default:
      imgData = src
  }

  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.putImageData(imgData, 0, 0)
}

watch([() => pipeline.ycbcr.value, activeChannel], draw)
onMounted(draw)
</script>

<template>
  <SlideLayout>
    <div class="color-step">
      <div class="controls">
        <button v-for="ch in (['rgb', 'y', 'cb', 'cr'] as const)" :key="ch"
          :class="{ active: activeChannel === ch }"
          @click="activeChannel = ch"
        >
          {{ ch.toUpperCase() }}
        </button>
      </div>
      <div class="canvas-wrap">
        <canvas ref="canvasRef" />
      </div>
    </div>
    <template #notes>
      <ExpandablePanel label="How it works">
        <p>JPEG converts RGB pixels to YCbCr: <strong>Y</strong> (luminance), <strong>Cb</strong> (blue-difference chroma), <strong>Cr</strong> (red-difference chroma).</p>
        <p style="margin-top:0.5rem">Human vision is more sensitive to brightness than colour, so we can compress the chroma channels more aggressively.</p>
        <pre style="margin-top:0.5rem;font-size:0.75rem">Y  =  0.299R + 0.587G + 0.114B
Cb = -0.169R - 0.331G + 0.500B + 128
Cr =  0.500R - 0.419G - 0.081B + 128</pre>
      </ExpandablePanel>
    </template>
  </SlideLayout>
</template>

<style scoped>
.color-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  align-items: center;
}

.controls {
  display: flex;
  gap: 0.25rem;
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
