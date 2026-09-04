<script setup lang="ts">
import { provide } from 'vue'
import DeckShell from './deck/DeckShell.vue'
import { createJpegPipeline, PIPELINE_KEY } from './composables/useJpegPipeline'

// The JPEG pipeline is shared by the whole deck: the global controls write to it,
// slides read from it. Deck navigation and stats are owned by DeckShell.
provide(PIPELINE_KEY, createJpegPipeline())
</script>

<template>
  <DeckShell />
</template>

<style scoped>
</style>
