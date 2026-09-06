<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { measureAllSamples, BENCHMARK_SAMPLES, type TechniqueRow } from '../../engine/benchmark'

/**
 * The answer to "why does RLE work on one image and not another?", shown as spread:
 * every technique run over every sample, bars grouped so brittleness reads as height
 * differences within a group rather than as a claim in prose.
 */
const rows = ref<TechniqueRow[] | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    rows.value = await measureAllSamples()
  } catch {
    failed.value = true
  }
})

// Log scale: the ratios span 0.5:1 to over 100:1, which no linear axis survives.
const MIN = 0.4
const MAX = 200
function height(ratio: number) {
  const clamped = Math.max(MIN, Math.min(MAX, ratio))
  return (Math.log(clamped / MIN) / Math.log(MAX / MIN)) * 100
}

const SAMPLE_COLORS = ['var(--negative)', 'var(--positive)', 'var(--accent)']

const mostBrittle = computed(() =>
  rows.value ? [...rows.value].sort((a, b) => b.spread - a.spread)[0] : null)

// Robust means "good whatever you feed it", so rank by worst case rather than by low
// variance — otherwise interleaved RLE wins for being reliably terrible.
const mostRobust = computed(() =>
  rows.value ? [...rows.value].sort((a, b) => b.worst - a.worst)[0] : null)
</script>

<template>
  <SlideLayout column>
    <div class="brittle">
      <p v-if="!rows && !failed" class="loading">measuring every technique on every sample…</p>
      <p v-else-if="failed" class="loading">could not load the sample images</p>

      <template v-else-if="rows">
        <div class="legend">
          <span v-for="(s, i) in BENCHMARK_SAMPLES" :key="s.name" class="legend-item">
            <span class="swatch" :style="{ background: SAMPLE_COLORS[i] }" />{{ s.name }}
          </span>
          <span class="axis-note">log scale · 1:1 is break-even · JPEG figures idealised, code tables excluded</span>
        </div>

        <div class="chart">
          <div v-for="row in rows" :key="row.technique" class="group">
            <div class="bars">
              <!-- Break-even line: bars below it made the file bigger. -->
              <div class="breakeven" :style="{ bottom: height(1) + '%' }" />
              <div
                v-for="(ratio, i) in row.ratios" :key="i"
                class="bar"
                :style="{ height: height(ratio) + '%', background: SAMPLE_COLORS[i] }"
              >
                <span class="value">{{ ratio < 1 ? ratio.toFixed(2) : ratio.toFixed(1) }}</span>
              </div>
            </div>
            <span class="name">{{ row.technique }}</span>
            <span class="stats">
              <span class="spread" :class="{ wide: row.spread > 5 }">{{ row.spread.toFixed(0) }}× spread</span>
              <span class="worst" :class="{ bad: row.worst < 1 }">worst {{ row.worst.toFixed(2) }}:1</span>
            </span>
          </div>
        </div>

        <Fragment :index="1">
          <p class="verdict">
            <strong>{{ mostBrittle?.technique }}</strong> swings
            {{ mostBrittle?.spread.toFixed(0) }}× depending on which image it meets.
            <strong>{{ mostRobust?.technique }}</strong> never drops below
            {{ mostRobust?.worst.toFixed(0) }}:1 whatever it is handed — and <em>that</em>, not low
            variance, is what robust means: RLE over interleaved RGB hardly varies either, but only
            because it is reliably useless.
          </p>
          <p class="verdict why">
            A lossless scheme that shortens some inputs <em>must</em> lengthen others, so every
            technique is a bet on the data it will meet. Brittle ones hard-code that bet; robust
            ones measure the data and adapt, paying for a model they then have to transmit.
            JPEG does not gamble at all — it manufactures the runs its coder needs.
          </p>
        </Fragment>
      </template>
    </div>
  </SlideLayout>
</template>

<style scoped>
.brittle {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.loading {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-style: italic;
}

.legend {
  display: flex;
  gap: 1rem;
  align-items: center;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.swatch {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 2px;
}

.axis-note {
  font-style: italic;
  opacity: 0.7;
}

.chart {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
}

.group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex: 1;
  max-width: 13rem;
}

.bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.35rem;
  height: 11rem;
  width: 100%;
  border-bottom: 1px solid var(--border);
}

.breakeven {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--text-secondary);
  opacity: 0.5;
}

.bar {
  position: relative;
  width: 1.6rem;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  transition: height 0.4s ease;
}

.value {
  position: absolute;
  top: -0.85rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.62rem;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.name {
  font-size: 0.62rem;
  text-align: center;
  line-height: 1.3;
}

.stats {
  display: flex;
  gap: 0.5rem;
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}

.spread, .worst {
  color: var(--text-secondary);
}

.worst.bad {
  color: var(--negative);
}

/* The whole point of the slide: a wide spread is the brittle ones. */
.spread.wide {
  color: var(--negative);
  font-weight: 700;
}

.verdict.why {
  font-size: 0.65rem;
  opacity: 0.85;
  margin-top: 0.3rem;
}

.verdict {
  font-size: 0.72rem;
  line-height: 1.5;
  max-width: 50rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
