<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'
import { compareImages } from '../../engine/compare'
import { useStat } from '../../stats/useStats'

/**
 * Opens with our own measured numbers rather than borrowed statistics: the raw pixel
 * count of the image actually on screen, against what the pipeline gets it down to.
 *
 * The canvas shows the *reconstructed* image by default, not the original. The slide's
 * claim is that you were not meant to notice the loss, and that only works if what you
 * are looking at is the compressed version — otherwise there is nothing to not notice.
 * The loupe is where the cost becomes visible, and the toggle is there for the moment
 * someone doubts it.
 */
const pipeline = inject(PIPELINE_KEY)!
const canvasRef = ref<HTMLCanvasElement>()
const showOriginal = ref(false)

const rawBytes = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? src.width * src.height * 3 : 0
})

const compressedBytes = computed(() => {
  const cache = pipeline.cache.value
  return cache ? Math.ceil(estimateEncodedBits(cache) / 8) : 0
})

const diff = computed(() => {
  const src = pipeline.sourceImageData.value
  const recon = pipeline.reconstructed.value
  return src && recon ? compareImages(src, recon) : null
})

// The slide with the deck's most quotable numbers should not be the one slide whose
// stats bar reads "no data".
useStat('why-care', () => {
  if (!compressedBytes.value) return null
  return {
    label: 'JPEG · whole image',
    rawBits: rawBytes.value * 8,
    encodedBits: compressedBytes.value * 8,
    overheadBits: 0,
    lossy: !diff.value?.identical,
    note: diff.value?.identical
      ? `Q=${pipeline.quality.value} · bit-identical`
      : `idealised · Q=${pipeline.quality.value}`,
  }
})

function draw() {
  const img = showOriginal.value ? pipeline.sourceImageData.value : pipeline.reconstructed.value
  const canvas = canvasRef.value
  if (!img || !canvas) return
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d')!.putImageData(img, 0, 0)
}

watch(
  [() => pipeline.sourceImageData.value, () => pipeline.reconstructed.value, showOriginal],
  () => nextTick(draw),
)
onMounted(draw)
</script>

<template>
  <SlideLayout>
    <div class="why">
      <div class="visual">
        <canvas ref="canvasRef" v-loupe />
        <div class="view">
          <button :class="{ active: !showOriginal }" @click="showOriginal = false">Compressed</button>
          <button :class="{ active: showOriginal }" @click="showOriginal = true">Original</button>
          <span class="hint">hover to magnify</span>
        </div>
      </div>

      <div class="argument">
        <div class="figure">
          <span class="value big">{{ (rawBytes / 1024).toFixed(0) }} KB</span>
          <span class="label">of raw pixels — three bytes each, no cleverness</span>
        </div>

        <div class="figure">
          <span class="value big accent">{{ (compressedBytes / 1024).toFixed(0) }} KB</span>
          <span class="label">what actually travels — and what you are looking at</span>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.why {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  width: 100%;
  height: 100%;
}

.visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.visual canvas {
  max-height: 56vh;
  max-width: 100%;
  border-radius: 6px;
}

.view {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.view button {
  padding: 0.2rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.hint {
  margin-left: 0.4rem;
  font-size: 0.62rem;
  font-style: italic;
  color: var(--text-secondary);
  opacity: 0.7;
}

.argument {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-width: 24rem;
}

.figure {
  display: flex;
  flex-direction: column;
}

.value.big {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.accent {
  color: var(--accent);
}

.label {
  font-size: 0.65rem;
  color: var(--text-secondary);
}
</style>
