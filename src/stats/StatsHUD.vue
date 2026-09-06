<script setup lang="ts">
import { inject, computed } from 'vue'
import { STATS_KEY } from './useStats'
import { formatBytes } from './types'

const stats = inject(STATS_KEY)!
const s = computed(() => stats.current.value)

// Payload and primer as a share of the raw size, so "compression" that expands
// the data runs past 100% and is visibly wrong rather than quietly rescaled.
const payloadPct = computed(() => (s.value ? Math.min(100, (s.value.encodedBits / s.value.rawBits) * 100) : 0))
const primerPct = computed(() => (s.value ? Math.min(100 - payloadPct.value, (s.value.overheadBits / s.value.rawBits) * 100) : 0))
</script>

<template>
  <div class="stats-hud" :class="{ empty: !s }">
    <template v-if="s">
      <!-- Numbers on top, context underneath: two short lines never truncate the way
           one long line does once the ToC rail has taken its width. -->
      <div class="line numbers">
        <div class="bar" :class="{ expanded: s.expanded }">
          <div class="seg payload" :style="{ width: payloadPct + '%' }" />
          <div class="seg primer" :style="{ width: primerPct + '%' }" />
        </div>

        <span class="sizes">
          {{ formatBytes(s.rawBits) }} → {{ formatBytes(s.totalBits) }}
        </span>

        <span class="ratio" :class="{ bad: s.expanded }">
          {{ s.ratio.toFixed(2) }}:1
          <span class="pct">{{ s.savedPercent >= 0 ? '−' : '+' }}{{ Math.abs(s.savedPercent).toFixed(0) }}%</span>
        </span>

        <span class="tag" :class="s.lossy ? 'lossy' : 'lossless'">{{ s.lossy ? 'lossy' : 'lossless' }}</span>
      </div>

      <div class="line context">
        <span class="label">{{ s.label }}</span>
        <span v-if="s.overheadBits > 0" class="primer-note">
          incl. {{ formatBytes(s.overheadBits) }} primer
        </span>
        <span v-if="s.note" class="note">· {{ s.note }}</span>
      </div>
    </template>

    <!-- Placeholder keeps the chrome exactly the same height on slides with no data. -->
    <span v-else class="label muted">no data on this slide</span>
  </div>
</template>

<style scoped>
.stats-hud {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  gap: 0.1rem;
  font-size: 0.65rem;
  white-space: nowrap;
  /* Never squeezed below its own content — that is what made it spill over the title.
     The overflow guard means that if it ever is, it clips instead of spilling. */
  min-width: max-content;
  overflow: hidden;
}

.line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.context {
  font-size: 0.52rem;
  color: var(--text-secondary);
  gap: 0.35rem;
}

.label {
  color: var(--text-secondary);
}

.muted {
  opacity: 0.5;
}

.bar {
  width: 120px;
  height: 8px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  display: flex;
  overflow: hidden;
  flex: none;
}

.seg {
  height: 100%;
  transition: width 0.2s ease;
}

.payload {
  background: var(--accent);
}

/* The shared primer gets its own slice — it is part of what you must transmit. */
.primer {
  background: var(--warning);
}

.bar.expanded .payload {
  background: var(--negative);
}

.sizes {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.primer-note {
  color: var(--warning);
}

.ratio {
  color: var(--positive);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ratio.bad {
  color: var(--negative);
}

.pct {
  opacity: 0.75;
  font-weight: 400;
}

.tag {
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

/* Both halves are coloured, because "lossless" is a result worth reading, not the
   absence of one. Same two colours as the on-stage badge in `rendering/lossBadge.ts`. */
.tag.lossy {
  color: var(--warning);
  border-color: var(--warning);
}

.tag.lossless {
  color: var(--positive);
  border-color: var(--positive);
}

.note {
  opacity: 0.8;
  font-style: italic;
}
</style>
