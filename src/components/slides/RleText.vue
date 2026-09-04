<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { encodePairs } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

const PRESETS = [
  { name: 'Runs', text: 'AAAAAAAAAAAABBBBBBBBCCCCCCCCCCCCCCCCDDDDAAAAAAAAAAAAAAAA' },
  { name: 'Prose', text: 'compression is a two-way transform' },
  { name: 'Scan line', text: '................########............########............' },
]

const text = ref(PRESETS[0].text)
const symbols = computed(() => [...text.value].map(c => c.charCodeAt(0)))
const pairs = computed(() => encodePairs(symbols.value))

const rawBits = computed(() => symbols.value.length * 8)
const encodedBits = computed(() => pairs.value.length * 16)
const expanded = computed(() => encodedBits.value > rawBits.value)

useStat('rle-text', () => {
  if (!symbols.value.length) return null
  return {
    label: 'RLE · text',
    rawBits: rawBits.value,
    encodedBits: encodedBits.value,
    // The (count, value) convention costs nothing to transmit — it is pure agreement.
    overheadBits: 0,
    lossy: false,
  }
})

function display(code: number) {
  const ch = String.fromCharCode(code)
  return ch === ' ' ? '␣' : ch
}
</script>

<template>
  <SlideLayout column>
    <div class="rle-text">
      <div class="input-row">
        <button
          v-for="p in PRESETS" :key="p.name"
          :class="{ active: text === p.text }"
          @click="text = p.text"
        >{{ p.name }}</button>
        <input v-model="text" class="editor" spellcheck="false" />
      </div>

      <div class="stream">
        <span v-for="(code, i) in symbols" :key="i" class="cell">{{ display(code) }}</span>
      </div>

      <div class="arrow">↓ replace each run with (count, value)</div>

      <div class="runs">
        <span
          v-for="(pair, i) in pairs" :key="i"
          class="run"
          :class="{ single: pair.count === 1 }"
          :style="{ minWidth: Math.min(pair.count, 12) * 0.55 + 'rem' }"
        >
          <span class="count">{{ pair.count }}</span>
          <span class="times">×</span>
          <span class="value">{{ display(pair.value) }}</span>
        </span>
      </div>

      <div class="tally">
        <span>{{ symbols.length }} symbols</span>
        <span class="sep">→</span>
        <span>{{ pairs.length }} pairs</span>
        <span class="sep">=</span>
        <span :class="expanded ? 'bad' : 'good'">
          {{ encodedBits / 8 }} bytes vs {{ rawBits / 8 }}
        </span>
      </div>

      <Fragment :index="1">
        <p class="verdict" :class="expanded ? 'bad' : 'good'">
          <template v-if="expanded">
            No runs to collapse — every symbol becomes a pair, and the output is
            <strong>{{ Math.round((encodedBits / rawBits - 1) * 100) }}% bigger</strong> than the input.
          </template>
          <template v-else>
            Long runs collapse to almost nothing —
            <strong>{{ Math.round((1 - encodedBits / rawBits) * 100) }}% smaller</strong>,
            with the same encoder that failed on prose.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.rle-text {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: 100%;
  align-items: center;
}

.input-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  width: 100%;
  max-width: 46rem;
}

.editor {
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 0.72rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
}

.stream, .runs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  max-width: 52rem;
}

.cell {
  width: 0.85rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 0.68rem;
  background: var(--bg-elevated);
  border-radius: 2px;
}

.arrow {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.run {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  height: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  background: var(--accent-dim);
  font-family: monospace;
  font-size: 0.7rem;
}

/* A run of one is RLE doing damage: two bytes spent to store one. */
.run.single {
  background: transparent;
  border: 1px solid var(--negative);
}

.count {
  font-weight: 700;
}

.times {
  opacity: 0.6;
}

.tally {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.sep {
  color: var(--text-secondary);
}

.good {
  color: var(--positive);
  font-weight: 600;
}

.bad {
  color: var(--negative);
  font-weight: 600;
}

.verdict {
  font-size: 0.8rem;
  max-width: 40rem;
  text-align: center;
  line-height: 1.4;
}
</style>
