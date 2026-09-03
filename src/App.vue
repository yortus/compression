<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import ProgressBar from './components/ProgressBar.vue'
import Step0Source from './components/steps/Step0Source.vue'
import Step1ColorSpace from './components/steps/Step1ColorSpace.vue'
import Step2Subsampling from './components/steps/Step2Subsampling.vue'
import Step3Blocks from './components/steps/Step3Blocks.vue'
import Step4DCT from './components/steps/Step4DCT.vue'
import Step5Quantization from './components/steps/Step5Quantization.vue'
import Step6Zigzag from './components/steps/Step6Zigzag.vue'
import Step7RLE from './components/steps/Step7RLE.vue'
import Step8Huffman from './components/steps/Step8Huffman.vue'
import Step9Summary from './components/steps/Step9Summary.vue'
import { createJpegPipeline, PIPELINE_KEY } from './composables/useJpegPipeline'

const pipeline = createJpegPipeline()
provide(PIPELINE_KEY, pipeline)

const steps = [
  { component: Step0Source, title: 'Source Image' },
  { component: Step1ColorSpace, title: 'Color Space' },
  { component: Step2Subsampling, title: 'Chroma Subsampling' },
  { component: Step3Blocks, title: '8×8 Blocks' },
  { component: Step4DCT, title: 'DCT' },
  { component: Step5Quantization, title: 'Quantization' },
  { component: Step6Zigzag, title: 'Zigzag Scan' },
  { component: Step7RLE, title: 'Run-Length Encoding' },
  { component: Step8Huffman, title: 'Huffman Coding' },
  { component: Step9Summary, title: 'Reconstruction' },
]

const currentStep = ref(0)
const showHelp = ref(false)
const currentStepDef = computed(() => steps[currentStep.value])

function goTo(index: number) {
  currentStep.value = Math.max(0, Math.min(steps.length - 1, index))
}

function onKeydown(e: KeyboardEvent) {
  // Don't hijack arrow keys when a range input is focused
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    goTo(currentStep.value + 1)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    goTo(currentStep.value - 1)
  } else if (e.key === '?') {
    showHelp.value = !showHelp.value
  } else if (e.key === 'Escape') {
    showHelp.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app">
    <component :is="currentStepDef.component" :key="currentStep" />

    <ProgressBar
      :current="currentStep"
      :total="steps.length"
      :title="currentStepDef.title"
      @go-to="goTo"
    />

    <div v-if="showHelp" class="help-overlay" @click="showHelp = false">
      <div class="help-content" @click.stop>
        <h2>Keyboard Shortcuts</h2>
        <dl>
          <dt>← →</dt><dd>Previous / Next step</dd>
          <dt>?</dt><dd>Toggle this help</dd>
          <dt>Esc</dt><dd>Close overlays</dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  position: relative;
}

.help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-content {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
}

.help-content h2 {
  margin: 0 0 1rem;
}

.help-content dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.help-content dt {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
}

.help-content dd {
  margin: 0;
  color: var(--text-secondary);
}
</style>
