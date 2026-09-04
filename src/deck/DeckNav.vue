<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useDeck } from './useDeck'
import { slidesByAct } from './slides'

/**
 * Table of contents down the left edge: every slide title visible and clickable,
 * grouped by act. It scrolls with the wheel like any list — no paging buttons.
 */
const deck = useDeck()
const groups = computed(() => slidesByAct())

const scroller = ref<HTMLElement>()

function indexOf(id: string) {
  return deck.slides.findIndex(s => s.id === id)
}

// Keep the current slide in view as the deck advances, without yanking the whole list.
async function revealCurrent() {
  await nextTick()
  scroller.value
    ?.querySelector<HTMLElement>(`[data-slide="${deck.slide.value.id}"]`)
    ?.scrollIntoView({ block: 'nearest' })
}

watch(() => deck.slide.value.id, revealCurrent)
onMounted(revealCurrent)
</script>

<template>
  <nav class="deck-nav">
    <div ref="scroller" class="scroller">
      <section v-for="group in groups" :key="group.act.id" class="act-group">
        <h2 class="act-label" :class="{ current: group.act.id === deck.act.value.id }">
          {{ group.act.label }}
        </h2>
        <button
          v-for="s in group.slides"
          :key="s.id"
          :data-slide="s.id"
          class="entry"
          :class="{
            active: s.id === deck.slide.value.id,
            visited: indexOf(s.id) < deck.index.value,
            optional: s.tag === 'optional',
          }"
          :title="s.subtitle ?? s.title"
          @click="deck.goToId(s.id)"
        >
          <span class="marker" />
          <span class="entry-title">{{ s.title }}</span>
        </button>
      </section>
    </div>

    <footer class="rail-footer">
      {{ deck.index.value + 1 }} / {{ deck.slides.length }}
    </footer>
  </nav>
</template>

<style scoped>
.deck-nav {
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 0;
}

.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.6rem 0 1rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.scroller::-webkit-scrollbar {
  width: 6px;
}

.scroller::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.act-group + .act-group {
  margin-top: 0.7rem;
}

.act-label {
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.7;
  padding: 0 0.7rem 0.25rem;
  margin: 0;
}

.act-label.current {
  color: var(--accent);
  opacity: 1;
}

.entry {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0;
  padding: 0.24rem 0.7rem;
  font-size: 0.62rem;
  line-height: 1.25;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
}

.entry:hover {
  background: var(--bg-elevated);
  border-color: transparent;
  border-left-color: var(--accent-dim);
  color: var(--text);
}

.entry.visited {
  color: var(--text);
  opacity: 0.65;
}

.entry.active {
  background: var(--bg-elevated);
  border-left-color: var(--accent);
  color: var(--text);
  font-weight: 600;
  opacity: 1;
}

.marker {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border);
}

.entry.visited .marker {
  background: var(--accent-dim);
}

.entry.active .marker {
  background: var(--accent);
}

/* Optional slides read as provisional — they are the first cut if the talk overruns. */
.entry.optional .entry-title {
  font-style: italic;
}

.entry.optional .marker {
  background: transparent;
  border: 1px solid var(--accent-dim);
}

.entry-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-footer {
  padding: 0.3rem 0.7rem;
  border-top: 1px solid var(--border);
  font-size: 0.55rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
