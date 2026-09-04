<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import ExpandablePanel from '../ExpandablePanel.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { unpackSymbol } from '../../engine/jpeg/huffman'
import { useStat } from '../../stats/useStats'

const pipeline = inject(PIPELINE_KEY)!

const showTree = ref(true)
const highlightedCode = ref<string | null>(null)

const huffman = computed(() => pipeline.selectedHuffman.value)

// The decoder cannot do anything with the bitstream unless it also has the code
// table, so the table is counted as primer rather than pretended away. On a single
// block it dominates — which is the point.
useStat('huffman-codes', () => {
  const h = huffman.value
  if (!h) return null
  let tableBits = 0
  for (const [, code] of h.codes) tableBits += 16 + 4 + code.length
  return {
    label: `Huffman · block ${pipeline.selectedBlockIndex.value}`,
    rawBits: h.originalBits,
    encodedBits: h.totalBits,
    overheadBits: tableBits,
    lossy: false,
    note: 'single block',
  }
})

const codeEntries = computed(() => {
  if (!huffman.value) return []
  const entries: { symbol: number; label: string; code: string; frequency: number }[] = []
  for (const [symbol, code] of huffman.value.codes) {
    const { runLength, value } = unpackSymbol(symbol)
    const label = runLength === 0 && value === 0 ? 'EOB' : `(${runLength},${value})`
    entries.push({ symbol, label, code, frequency: 0 })
  }
  return entries.sort((a, b) => a.code.length - b.code.length)
})
</script>

<template>
  <SlideLayout>
    <div class="huffman-step">
      <div class="section">
        <h3>Code Table</h3>
        <div class="code-table">
          <div class="header-row">
            <span>Symbol</span>
            <span>Bits</span>
            <span>Code</span>
          </div>
          <div
            v-for="entry in codeEntries" :key="entry.symbol"
            :class="['code-row', { active: highlightedCode === entry.code }]"
            @mouseenter="highlightedCode = entry.code"
            @mouseleave="highlightedCode = null"
          >
            <span class="symbol">{{ entry.label }}</span>
            <span class="bits">{{ entry.code.length }}</span>
            <span class="code">{{ entry.code }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Encoded bitstream</h3>
        <div v-if="huffman" class="bitstream">
          <span v-for="(bit, i) in huffman.bitstring" :key="i" :class="['bit', bit === '1' ? 'one' : 'zero']">{{ bit }}</span>
        </div>
        <div v-if="huffman" class="stats">
          <span>{{ huffman.totalBits }} bits encoded</span>
          <span>vs {{ huffman.originalBits }} bits raw</span>
          <span class="savings">{{ Math.round((1 - huffman.totalBits / huffman.originalBits) * 100) }}% savings</span>
        </div>
      </div>
    </div>
    <template #notes>
      <ExpandablePanel label="How it works">
        <p>Huffman coding assigns shorter bit patterns to more frequent symbols and longer patterns to rare ones.</p>
        <p style="margin-top:0.5rem">JPEG uses Huffman coding (or arithmetic coding) as the final lossless compression step. Frequent RLE pairs like EOB and small-value coefficients get very short codes.</p>
      </ExpandablePanel>
    </template>
  </SlideLayout>
</template>

<style scoped>
.huffman-step {
  display: flex;
  gap: 2rem;
  width: 100%;
  overflow-y: auto;
}

.section {
  flex: 1;
}

.section h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.code-table {
  font-family: monospace;
  font-size: 0.8rem;
}

.header-row {
  display: grid;
  grid-template-columns: 80px 40px 1fr;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.code-row {
  display: grid;
  grid-template-columns: 80px 40px 1fr;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  transition: background 0.1s;
}

.code-row:hover, .code-row.active {
  background: var(--bg-elevated);
}

.code {
  color: var(--accent);
  word-break: break-all;
}

.bitstream {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  max-height: 300px;
  overflow-y: auto;
}

.bit {
  width: 18px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 0.8rem;
  border-radius: 2px;
}

.bit.one {
  background: var(--accent);
  color: #fff;
}

.bit.zero {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.savings {
  color: var(--positive);
  font-weight: 600;
}
</style>
