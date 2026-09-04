<script setup lang="ts">
import { computed } from 'vue'
import { useDeck } from './useDeck'

const props = defineProps<{
  /** Reveal step this content belongs to. Fragment 0 is visible immediately. */
  index: number
}>()

const deck = useDeck()
const shown = computed(() => deck.isRevealed(props.index))
</script>

<template>
  <!-- Space stays reserved so the slide does not reflow as the build advances. -->
  <div class="fragment" :class="{ shown }">
    <slot />
  </div>
</template>

<style scoped>
.fragment {
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.fragment.shown {
  opacity: 1;
  pointer-events: auto;
}
</style>
