<script setup lang="ts">
/**
 * Consistent content area for every slide. Slides render their own content here and
 * nothing else — the title, navigation, controls and stats all belong to DeckShell.
 *
 * The optional `notes` slot lands in the same place on every slide.
 */
defineProps<{
  /** Stack content in a column instead of a row. */
  column?: boolean
}>()
</script>

<template>
  <div class="slide-layout">
    <div class="slide-content" :class="{ column }">
      <slot />
    </div>
    <aside v-if="$slots.notes" class="slide-notes">
      <slot name="notes" />
    </aside>
  </div>
</template>

<style scoped>
.slide-layout {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.slide-content {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.slide-content.column {
  flex-direction: column;
}

.slide-notes {
  position: absolute;
  bottom: 0;
  right: 0;
  max-width: 460px;
  max-height: 38%;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
