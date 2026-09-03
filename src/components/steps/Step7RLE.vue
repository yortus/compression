<script setup lang="ts">
import { inject, ref, watch, onMounted, computed } from 'vue'
import StepShell from '../StepShell.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'

const pipeline = inject(PIPELINE_KEY)!

const highlightedPair = ref<number | null>(null)

const zigzag = computed(() => pipeline.selectedZigzag.value)
const rle = computed(() => pipeline.selectedRLE.value)

// Map each RLE pair back to the range of zigzag indices it covers
const pairRanges = computed(() => {
  const pairs = rle.value
  if (!pairs) return []
  const ranges: { start: number; end: number }[] = []
  let pos = 0
  for (const pair of pairs) {
    const start = pos
    if (pair.runLength === 0 && pair.value === 0 && pos > 0) {
      // EOB — covers rest
      ranges.push({ start: pos, end: 63 })
      break
    }
    pos += pair.runLength
    const end = pos
    pos++
    ranges.push({ start, end })
  }
  return ranges
})

function isHighlighted(zigzagIdx: number): boolean {
  if (highlightedPair.value === null) return false
  const range = pairRanges.value[highlightedPair.value]
  if (!range) return false
  return zigzagIdx >= range.start && zigzagIdx <= range.end
}
</script>

<template>
  <StepShell title="Run-Length Encoding" subtitle="Compressing zero runs">
    <div class="rle-step">
      <div class="section">
        <h3>Zigzag sequence (64 values)</h3>
        <div class="sequence">
          <span
            v-for="(val, i) in zigzag" :key="i"
            :class="['cell', { zero: val === 0, highlighted: isHighlighted(i) }]"
          >{{ val }}</span>
        </div>
      </div>

      <div class="arrow">↓ RLE</div>

      <div class="section">
        <h3>RLE pairs (skip, value)</h3>
        <div class="pairs">
          <span
            v-for="(pair, i) in rle" :key="i"
            :class="['pair', { eob: pair.runLength === 0 && pair.value === 0 && i > 0, active: highlightedPair === i }]"
            @mouseenter="highlightedPair = i"
            @mouseleave="highlightedPair = null"
          >
            <template v-if="pair.runLength === 0 && pair.value === 0 && i > 0">
              EOB
            </template>
            <template v-else>
              ({{ pair.runLength }}, {{ pair.value }})
            </template>
          </span>
        </div>
      </div>

      <div v-if="rle && zigzag" class="stats">
        <span>{{ zigzag.length }} values → {{ rle.length }} RLE pairs</span>
        <span class="savings">{{ Math.round((1 - rle.length / zigzag.length) * 100) }}% reduction</span>
      </div>
    </div>
    <template #detail>
      <ExpandablePanel label="How it works">
        <p>JPEG's RLE encodes each non-zero AC coefficient as a pair: <strong>(skip, value)</strong> where skip = number of preceding zeros.</p>
        <p style="margin-top:0.5rem">The special <strong>EOB</strong> (End of Block) symbol means "all remaining values are zero" — a very efficient shorthand for the long zero tail.</p>
      </ExpandablePanel>
    </template>
  </StepShell>
</template>

<style scoped>
.rle-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  overflow-y: auto;
}

.section h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.cell {
  width: 40px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-family: monospace;
  background: var(--bg-elevated);
  border-radius: 3px;
  transition: background 0.15s;
}

.cell.zero {
  color: #555;
}

.cell.highlighted {
  background: var(--accent);
  color: #fff;
}

.arrow {
  font-size: 1.2rem;
  color: var(--accent);
  text-align: center;
}

.pairs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pair {
  padding: 0.3rem 0.6rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.pair:hover, .pair.active {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.pair.eob {
  background: var(--positive);
  color: #000;
  border-color: var(--positive);
  font-weight: 700;
}

.stats {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.savings {
  color: var(--positive);
  font-weight: 600;
}
</style>
