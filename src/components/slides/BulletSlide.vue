<script setup lang="ts">
import { computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { useDeck } from '../../deck/useDeck'
import { OUTRO } from '../../content/outro'

/**
 * The outro's low-density bullet slides: one idea, a handful of short lines, no build.
 * Everything is on screen at once; the elaboration lives behind Learn More.
 */
const deck = useDeck()
const content = computed(() => OUTRO[deck.slide.value.id] ?? { groups: [] })
</script>

<template>
  <SlideLayout column>
    <div class="bullets">
      <p v-if="content.lead" class="lead">{{ content.lead }}</p>

      <div class="groups">
        <section
          v-for="(g, i) in content.groups"
          :key="i"
          class="group"
          :class="[g.tone ?? 'neutral', { card: !!g.heading }]"
        >
          <h3 v-if="g.heading" class="heading">{{ g.heading }}</h3>
          <ul>
            <li v-for="item in g.items" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.bullets {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  width: 100%;
  height: 100%;
  padding: 0 1rem;
}

.lead {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  max-width: 40rem;
}

.groups {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 1.4rem;
  width: 100%;
  max-width: 46rem;
}

/* A group with a heading is a card; a heading-less one is a plain centred column. */
.group {
  flex: 1 1 16rem;
  max-width: 21rem;
}

.group:not(.card) {
  flex-basis: 100%;
  max-width: 34rem;
}

.group.card {
  padding: 1rem 1.2rem 1.2rem;
  border: 1px solid var(--border);
  border-top-width: 3px;
  border-radius: 10px;
  background: var(--bg-surface);
}

.group.card.good {
  border-top-color: var(--positive);
}

.group.card.warn {
  border-top-color: var(--warning);
}

/* A lone card hugs its content, so each bullet stays on one line on a wide screen. */
.group.card:only-child {
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
}

.heading {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.9rem;
}

.group.good .heading {
  color: var(--positive);
}

.group.warn .heading {
  color: var(--warning);
}

ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

li {
  position: relative;
  padding-left: 1.3rem;
  font-size: 0.92rem;
  line-height: 1.4;
  color: var(--text);
}

li::before {
  content: '›';
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 700;
}
</style>
