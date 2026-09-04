<script setup lang="ts">
import { computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { useDeck } from '../../deck/useDeck'
import { POINTS } from '../../content/points'

/**
 * The narrative slides — the ones carrying an argument rather than a demo — share this
 * one component and read their words from src/content/points.ts. Six slides that look
 * identical beat six bespoke layouts that nearly do.
 */
const deck = useDeck()
const content = computed(() => POINTS[deck.slide.value.id] ?? { cards: [] })
</script>

<template>
  <SlideLayout column>
    <div class="points">
      <p v-if="content.lead" class="lead">{{ content.lead }}</p>

      <div class="cards" :class="`n-${content.cards.length}`">
        <!-- Cards reveal one per build step, so the room reads them one at a time. -->
        <Fragment v-for="(card, i) in content.cards" :key="card.title" :index="i" class="card-slot">
          <article class="card" :class="card.tone ?? 'neutral'">
            <header>
              <h3>{{ card.title }}</h3>
              <span v-if="card.tag" class="tag">{{ card.tag }}</span>
            </header>
            <p>{{ card.body }}</p>
          </article>
        </Fragment>
      </div>

      <Fragment v-if="content.punchline" :index="content.cards.length">
        <p class="punchline">{{ content.punchline }}</p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.points {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  height: 100%;
}

.lead {
  font-size: 0.85rem;
  color: var(--text);
  text-align: center;
  max-width: 46rem;
}

.cards {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  max-width: 60rem;
  align-items: stretch;
}

.n-2 { grid-template-columns: repeat(2, 1fr); }
.n-3 { grid-template-columns: repeat(3, 1fr); }
.n-4 { grid-template-columns: repeat(2, 1fr); }

.card-slot {
  display: flex;
}

.card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: 10px;
  background: var(--bg-surface);
}

.card.good { border-left-color: var(--positive); }
.card.warn { border-left-color: var(--warning); }
.card.bad { border-left-color: var(--negative); }
.card.neutral { border-left-color: var(--accent-dim); }

.card header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.card h3 {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.tag {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.card p {
  font-size: 0.68rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.punchline {
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  max-width: 46rem;
  color: var(--accent);
}
</style>
