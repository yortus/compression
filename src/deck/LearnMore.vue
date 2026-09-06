<script setup lang="ts">
import { inject, computed } from 'vue'
import { DECK_KEY } from './useDeck'
import { LEARN_MORE_KEY } from './useLearnMore'
import { proseFor } from '../content'

/**
 * The detail panel: one button, same place on every slide, and everything a slide knows
 * that did not earn a place on the stage.
 *
 * Three layers, in the order someone reads them: the paragraph that used to be learn
 * mode's, then the written detail behind it, then whatever the slide has measured for the
 * picker and slider positions currently on screen. Read at reading distance rather than
 * from the back of a room, so it is set smaller than a slide — but it is still the deck,
 * so it stays above the floor.
 */

const deck = inject(DECK_KEY)!
const registry = inject(LEARN_MORE_KEY)!

const prose = computed(() => proseFor(deck.slide.value.id))
const entry = computed(() => prose.value?.more ?? null)
const facts = computed(() => registry.facts.value)

defineEmits<{ close: [] }>()
</script>

<template>
  <div class="scrim" @click="$emit('close')">
    <article class="panel" @click.stop>
      <header>
        <h2>{{ deck.slide.value.title }}</h2>
        <button class="close" title="Close (Esc)" @click="$emit('close')">✕</button>
      </header>

      <div class="body">
        <p v-if="prose" class="lead">{{ prose.learner }}</p>

        <h3 v-if="entry?.title" class="section">{{ entry.title }}</h3>
        <template v-for="(block, i) in entry?.blocks ?? []" :key="i">
          <p v-if="block.kind === 'para'">{{ block.text }}</p>
          <ul v-else-if="block.kind === 'list'">
            <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
          </ul>
          <p v-else class="link">
            <a :href="block.href" target="_blank" rel="noreferrer">{{ block.label }}</a>
          </p>
        </template>

        <!-- Measured, not written: whatever the slide has computed for the picker and
             slider positions currently on screen. -->
        <section v-if="facts.length" class="facts">
          <h3>On what is on screen right now</h3>
          <div v-for="(f, i) in facts" :key="i" class="fact">
            <span class="label">{{ f.label }}</span>
            <span class="value">{{ f.value }}</span>
            <span v-if="f.note" class="note">{{ f.note }}</span>
          </div>
        </section>

        <p v-if="!prose && !entry && !facts.length" class="empty">
          Nothing written for this slide yet.
        </p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.panel {
  width: min(46rem, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.2rem 0.6rem;
  border-bottom: 1px solid var(--border);
}

h2 {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.close {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  color: var(--text-secondary);
}

/* The one scrolling surface in the deck: a panel read at reading distance may run long. */
.body {
  min-height: 0;
  overflow-y: auto;
  padding: 0.9rem 1.2rem 1.2rem;
}

.body p {
  font-size: 0.68rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0 0 0.7rem;
}

/* The slide's own paragraph, and the reason most slides have a panel at all. */
.lead {
  color: var(--text) !important;
}

.section {
  margin: 1rem 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text);
}

.body ul {
  margin: 0 0 0.7rem;
  padding-left: 1rem;
}

.body li {
  font-size: 0.68rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.link a {
  color: var(--accent);
}

.facts {
  margin-top: 0.4rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border);
}

.facts h3 {
  margin: 0 0 0.5rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-weight: 600;
}

.fact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border);
}

.fact .label {
  font-size: 0.68rem;
  color: var(--text);
}

.fact .value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.fact .note {
  grid-column: 1 / -1;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.empty {
  font-style: italic;
}
</style>
