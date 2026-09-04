<script setup lang="ts">
import { inject, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { STATS_KEY } from '../../stats/useStats'
import { derive, formatBytes } from '../../stats/types'
import { SLIDES } from '../../deck/slides'

/**
 * Reads back what the act actually measured rather than quoting numbers into a table:
 * every row here was recorded by the slide that produced it.
 */
const stats = inject(STATS_KEY)!

const ACT1_IDS = SLIDES.filter(s => s.act === 'simple').map(s => s.id)

const rows = computed(() =>
  ACT1_IDS
    .map(id => {
      const sample = stats.scoreboard.value.get(id)
      return sample ? { id, ...derive(sample) } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null))

const unvisited = computed(() => ACT1_IDS.length - rows.value.length - 1)
</script>

<template>
  <SlideLayout column>
    <div class="summary">
      <div class="families">
        <div class="family lossless">
          <h3>Lossless</h3>
          <p>Reversible. The original bytes come back exactly.</p>
          <ul>
            <li>Run-length encoding</li>
            <li>Splitting into colour planes</li>
            <li>Reordering of any kind</li>
          </ul>
        </div>
        <div class="family lossy">
          <h3>Lossy</h3>
          <p>Information is discarded on purpose. It does not come back.</p>
          <ul>
            <li>Reducing an image to a fixed palette</li>
            <li>Anything that decides what you will not miss</li>
          </ul>
        </div>
      </div>

      <div class="scoreboard">
        <div class="row header">
          <span>What we tried</span>
          <span>Size</span>
          <span>Ratio</span>
          <span>Kind</span>
        </div>
        <div v-for="r in rows" :key="r.id" class="row" :class="{ worse: r.expanded }">
          <span class="what">{{ r.label }}</span>
          <span class="size">{{ formatBytes(r.rawBits) }} → {{ formatBytes(r.totalBits) }}</span>
          <span class="ratio" :class="r.expanded ? 'bad' : 'good'">{{ r.ratio.toFixed(2) }}:1</span>
          <span class="kind" :class="r.lossy ? 'lossy-tag' : 'lossless-tag'">
            {{ r.lossy ? 'lossy' : 'lossless' }}
          </span>
        </div>
        <p v-if="unvisited > 0" class="hint">
          {{ unvisited }} more {{ unvisited === 1 ? 'result appears' : 'results appear' }}
          here once you have visited {{ unvisited === 1 ? 'that slide' : 'those slides' }}.
        </p>
      </div>

      <Fragment :index="1">
        <p class="thesis">
          The encoder never got cleverer. Every win in this act came from handing it
          <strong>differently shaped data</strong> — and the one lossy step was a decision about
          human perception, not about mathematics. Both of those ideas run all the way to JPEG.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.families {
  display: flex;
  gap: 1.2rem;
}

.family {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 1rem;
  max-width: 20rem;
}

.family.lossless {
  border-color: var(--positive);
}

.family.lossy {
  border-color: var(--warning);
}

.family h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.25rem;
}

.family.lossless h3 {
  color: var(--positive);
}

.family.lossy h3 {
  color: var(--warning);
}

.family p {
  font-size: 0.65rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.family ul {
  margin: 0.4rem 0 0 1rem;
  font-size: 0.65rem;
  line-height: 1.6;
}

.scoreboard {
  width: 100%;
  max-width: 42rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto 5rem 5rem;
  gap: 0.8rem;
  align-items: baseline;
  padding: 0.22rem 0.4rem;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  border-radius: 4px;
}

.row.header {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.row.worse {
  background: rgba(248, 113, 113, 0.08);
}

.size {
  color: var(--text-secondary);
}

.ratio {
  text-align: right;
  font-weight: 600;
}

.good {
  color: var(--positive);
}

.bad {
  color: var(--negative);
}

.kind {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: right;
}

.lossy-tag {
  color: var(--warning);
}

.lossless-tag {
  color: var(--text-secondary);
}

.hint {
  font-size: 0.6rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.4rem;
}

.thesis {
  font-size: 0.75rem;
  line-height: 1.5;
  max-width: 44rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
