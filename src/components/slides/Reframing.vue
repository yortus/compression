<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'

/**
 * The thesis, paid off. Each row is a reframing the audience watched happen — the same
 * simple encoder, pointed at data that had been reshaped until it worked.
 */
const REFRAMES = [
  { from: 'Colours', to: 'Indices', enabled: 'Neighbours finally repeat, so runs exist to collapse' },
  { from: 'Red, green, blue', to: 'Brightness and colour', enabled: 'The two can be treated differently, because we see them differently' },
  { from: 'Pixels', to: 'Frequencies', enabled: 'Energy gathers into a few coefficients; the rest can go' },
]
</script>

<template>
  <SlideLayout column>
    <div class="reframing">
      <p class="lead">Different perspectives create new possibilities</p>

      <div class="pane">
        <div v-for="r in REFRAMES" :key="r.to" class="row">
          <div class="headline">
            <span class="from">{{ r.from }}</span>
            <span class="arrow">→</span>
            <span class="to">{{ r.to }}</span>
          </div>
          <span class="enabled">{{ r.enabled }}</span>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.reframing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  width: 100%;
  height: 100%;
}

.lead {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  max-width: 40rem;
}

.pane {
  width: fit-content;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0.3rem 1.5rem;
  border: 1px solid var(--border);
  border-top: 3px solid var(--positive);
  border-radius: 10px;
  background: var(--bg-surface);
}

.row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0;
}

.row + .row {
  border-top: 1px solid var(--border);
}

/* From → To reads big; the reason sits under it as support, so a narrow screen
   stacks into one column instead of overflowing a fixed grid. */
.headline {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 1.05rem;
}

.from {
  color: var(--text-secondary);
}

.arrow {
  color: var(--accent);
}

.to {
  font-weight: 700;
  color: var(--text);
}

.enabled {
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.4;
}
</style>
