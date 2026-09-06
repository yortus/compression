<script setup lang="ts">
import { computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { TIMELINE } from '../../content/timeline'

/**
 * A vertical spine rather than a horizontal axis.
 *
 * Positioning entries proportionally along a year axis is the obvious design and a bad
 * one: eleven of the twelve dates fall between 1948 and 2016, so they pile on top of one
 * another while 1822 sits alone in empty space. Even rows stay readable, and the gap that
 * proportional spacing was there to show is called out explicitly instead.
 */
const entries = computed(() =>
  TIMELINE.map((e, i) => ({
    ...e,
    // The one gap worth drawing attention to: everything else is within a lifetime.
    gapBefore: i > 0 ? e.year - TIMELINE[i - 1].year : 0,
  })))
</script>

<template>
  <SlideLayout column>
    <div class="timeline">
      <ol class="spine">
        <li
          v-for="e in entries" :key="e.year + e.who"
          class="entry"
          :class="{ keystone: e.keystone }"
        >
          <span v-if="e.gapBefore > 60" class="gap">{{ e.gapBefore }} years</span>
          <span class="dot" />
          <span class="year">{{ e.year }}</span>
          <span class="who">{{ e.who }}</span>
          <span class="what">{{ e.what }}</span>
        </li>
      </ol>

      <Fragment :index="1">
        <p class="verdict">
          The oldest idea in JPEG is <strong>170 years older</strong> than the standard, and none of
          the four load-bearing ones were invented for it. The 1992 spec is largely an act of
          assembly — which is what most engineering turns out to be, close up.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.spine {
  position: relative;
  list-style: none;
  width: 100%;
  max-width: 46rem;
  padding-left: 0.9rem;
  min-height: 0;
  overflow-y: auto;
}

/* The line itself, behind the dots. */
.spine::before {
  content: '';
  position: absolute;
  left: 0.25rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: linear-gradient(180deg, var(--border), var(--accent-dim), var(--accent));
}

.entry {
  position: relative;
  display: grid;
  grid-template-columns: 3.2rem 9.5rem 1fr;
  gap: 0.7rem;
  align-items: baseline;
  line-height: 1.3;
  padding: 0.12rem 0 0.12rem 0.7rem;
  border-radius: 5px;
}

.entry.keystone {
  background: var(--bg-surface);
}

.dot {
  position: absolute;
  left: -0.79rem;
  top: 0.42rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}

.entry.keystone .dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 140, 255, 0.2);
}

.year {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.entry.keystone .year {
  color: var(--accent);
}

.who {
  font-size: 0.68rem;
  font-weight: 600;
}

.what {
  font-size: 0.62rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

/* Marks the 126-year jump between Fourier and Shannon. */
.gap {
  grid-column: 1 / -1;
  margin: 0.05rem 0 0.1rem;
  font-size: 0.62rem;
  font-style: italic;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  opacity: 0.7;
}

.verdict {
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: center;
  max-width: 46rem;
  color: var(--text-secondary);
}
</style>
