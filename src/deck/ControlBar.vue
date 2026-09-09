<script setup lang="ts">
import { inject, ref, onMounted } from 'vue'
import { useDeck } from './useDeck'
import ImagePicker from '../components/ImagePicker.vue'
import { PIPELINE_KEY } from '../composables/useJpegPipeline'
import type { SubsamplingMode } from '../engine/jpeg/types'

/**
 * The global controls, rendered once and always in the same place. A slide that does
 * not use a control gets it disabled rather than removed, so nothing ever shifts.
 */
const deck = useDeck()
const pipeline = inject(PIPELINE_KEY)!

const picker = ref<InstanceType<typeof ImagePicker>>()
const MODES: SubsamplingMode[] = ['4:4:4', '4:2:2', '4:2:0']

onMounted(() => {
  if (!pipeline.sourceImageData.value) picker.value?.loadDefault()
})
</script>

<template>
  <div class="control-bar">
    <div class="control" :class="{ off: !deck.controlEnabled('image') }">
      <span class="key">Image</span>
      <ImagePicker
        ref="picker"
        :disabled="!deck.controlEnabled('image')"
        @load="pipeline.loadImage($event)"
      />
    </div>

    <div class="control" :class="{ off: !deck.controlEnabled('quality') }">
      <span class="key">Quality</span>
      <input
        type="range" min="1" max="100"
        :disabled="!deck.controlEnabled('quality')"
        v-model.number="pipeline.quality.value"
      />
      <span class="value">{{ pipeline.quality.value }}</span>
    </div>

    <div class="control" :class="{ off: !deck.controlEnabled('subsampling') }">
      <span class="key">Chroma</span>
      <button
        v-for="m in MODES" :key="m"
        class="chip"
        :class="{ active: pipeline.subsamplingMode.value === m }"
        :disabled="!deck.controlEnabled('subsampling')"
        @click="pipeline.subsamplingMode.value = m"
      >{{ m }}</button>
    </div>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  height: 100%;
  padding: 0 1rem;
  flex: none;
}

.control {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: opacity 0.2s;
}

/* Disabled controls stay put and stay legible — they just recede. */
.control.off {
  opacity: 0.28;
}

.key {
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.value {
  font-size: 0.65rem;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  min-width: 1.6em;
  text-align: center;
}

.chip {
  padding: 0.2rem 0.45rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

input[type="range"] {
  width: 110px;
}

@media (max-width: 1500px) {
  .control-bar {
    gap: 0.5rem;
    padding: 0 0.5rem;
  }

  .control {
    gap: 0.2rem;
  }

  input[type="range"] {
    width: 62px;
  }

  .key {
    font-size: 0.5rem;
  }

  .chip {
    padding: 0.18rem 0.32rem;
    font-size: 0.55rem;
  }

  .value {
    font-size: 0.55rem;
  }
}

button:disabled {
  cursor: default;
}

button:disabled:hover {
  background: var(--bg-elevated);
  border-color: var(--border);
}
</style>
