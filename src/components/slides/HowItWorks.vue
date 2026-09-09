<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'

/**
 * A teaser, not an explanation: one short phrase per act of the talk. It sets up the arc —
 * spot the repetition, reframe the data, exploit human weakness — without cashing any of
 * it in yet. All three land at once; the slide has no internal build.
 */
const hints = [
  'Spot the repetition',
  'Reframe the data',
  'Exploit human weakness',
]
</script>

<template>
  <SlideLayout column>
    <div class="hints">
      <div v-for="hint in hints" :key="hint" class="hint-row">
        <span class="marker">›</span>
        <span class="text">{{ hint }}</span>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.hints {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.hint-row {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.marker {
  color: var(--accent);
  font-weight: 700;
}

.text {
  color: var(--text);
}
</style>
