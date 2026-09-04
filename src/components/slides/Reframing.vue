<script setup lang="ts">
import { inject, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { STATS_KEY } from '../../stats/useStats'
import { derive } from '../../stats/types'

/**
 * The thesis, paid off. Each row is a reframing the audience watched happen, with the
 * live number from the slide that produced it wherever the deck has recorded one.
 */
const stats = inject(STATS_KEY)!

const REFRAMES = [
  { from: 'Colours', to: 'Indices', enabled: 'Neighbours finally repeat, so runs exist to collapse', slide: 'rle-palette' },
  { from: 'Interleaved bytes', to: 'Colour planes', enabled: 'Nothing discarded — only the visiting order changed', slide: 'rle-planes' },
  { from: 'Red, green, blue', to: 'Brightness and colour', enabled: 'The two can now be treated differently, because we see them differently', slide: 'chroma-subsample' },
  { from: 'Pixels', to: 'Frequencies', enabled: 'Energy gathers into a few coefficients; the rest can go', slide: 'quantisation' },
  { from: 'Raster order', to: 'Zigzag order', enabled: 'The zeros end up adjacent, which is the only reason RLE pays', slide: 'zigzag' },
]

const rows = computed(() =>
  REFRAMES.map(r => {
    const sample = stats.scoreboard.value.get(r.slide)
    return { ...r, ratio: sample ? derive(sample).ratio : null }
  }))
</script>

<template>
  <SlideLayout column>
    <div class="reframing">
      <p class="lead">Every win in this talk came from the same move.</p>

      <div class="rows">
        <div v-for="r in rows" :key="r.slide" class="row">
          <span class="from">{{ r.from }}</span>
          <span class="arrow">→</span>
          <span class="to">{{ r.to }}</span>
          <span class="enabled">{{ r.enabled }}</span>
          <span class="ratio" :class="{ dim: r.ratio === null }">
            {{ r.ratio === null ? '—' : r.ratio.toFixed(1) + ':1' }}
          </span>
        </div>
      </div>

      <Fragment :index="1">
        <div class="thesis">
          <p>
            Not one of those made the encoder cleverer. Run-length encoding on the last slide is
            the same run-length encoding from the first. What changed every time was
            <strong>what the numbers meant</strong> — and a simple encoder, pointed at data in the
            right shape, beat a clever one pointed at data in the wrong shape.
          </p>
          <p class="beat">
            Which is not really a fact about compression.
          </p>
        </div>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.reframing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
  width: 100%;
  height: 100%;
}

.lead {
  font-size: 0.85rem;
  color: var(--text);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  max-width: 56rem;
}

.row {
  display: grid;
  grid-template-columns: 9rem 1rem 11rem 1fr 4rem;
  gap: 0.6rem;
  align-items: baseline;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: var(--bg-surface);
  font-size: 0.68rem;
}

.from {
  color: var(--text-secondary);
  text-align: right;
}

.arrow {
  color: var(--accent);
  text-align: center;
}

.to {
  font-weight: 700;
}

.enabled {
  color: var(--text-secondary);
  font-size: 0.62rem;
  line-height: 1.35;
}

.ratio {
  text-align: right;
  font-weight: 700;
  color: var(--positive);
  font-variant-numeric: tabular-nums;
}

.ratio.dim {
  color: var(--text-secondary);
  font-weight: 400;
}

.thesis {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 48rem;
  text-align: center;
}

.thesis p {
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--text-secondary);
}

.beat {
  font-size: 0.95rem !important;
  font-weight: 600;
  color: var(--accent) !important;
}
</style>
