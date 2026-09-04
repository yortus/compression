<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { entropyBits, symbolStats, flatBits } from '../../engine/codecs/entropy'
import { useStat } from '../../stats/useStats'

const PRESETS = [
  { name: 'Repetitive', text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbaaaaaaaaaa' },
  { name: 'English', text: 'the quick brown fox jumps over the lazy dog' },
  { name: 'Near-random', text: 'q7#Kz2$vP9!mX4&bR6@wL8*nT3^cJ5%hY1?dG0+sF' },
]

const text = ref(PRESETS[1].text)
const symbols = computed(() => [...text.value].map(c => c.charCodeAt(0)))

const h = computed(() => entropyBits(symbols.value))
const stats = computed(() => symbolStats(symbols.value).slice(0, 14))
const maxProb = computed(() => stats.value[0]?.probability ?? 1)

const storedBits = computed(() => symbols.value.length * 8)
const floorBits = computed(() => Math.ceil(h.value * symbols.value.length))
const flat = computed(() => flatBits(symbols.value))

useStat('info-theory', () => {
  if (!symbols.value.length) return null
  return {
    label: 'Entropy floor · this text',
    rawBits: storedBits.value,
    encodedBits: floorBits.value,
    overheadBits: 0,
    lossy: false,
    note: `${h.value.toFixed(2)} bits/symbol`,
  }
})

function display(code: number) {
  const ch = String.fromCharCode(code)
  return ch === ' ' ? '␣' : ch
}
</script>

<template>
  <SlideLayout column>
    <div class="info-theory">
      <div class="controls">
        <button
          v-for="p in PRESETS" :key="p.name"
          :class="{ active: text === p.text }"
          @click="text = p.text"
        >{{ p.name }}</button>
        <input v-model="text" class="editor" spellcheck="false" />
      </div>

      <div class="body">
        <div class="histogram">
          <h3>How often each symbol appears</h3>
          <div v-for="s in stats" :key="s.symbol" class="row">
            <span class="sym">{{ display(s.symbol) }}</span>
            <div class="track">
              <div class="fill" :style="{ width: (s.probability / maxProb) * 100 + '%' }" />
            </div>
            <span class="ideal">{{ s.idealBits.toFixed(1) }} bits</span>
          </div>
          <p class="note">
            A symbol that appears often deserves a short code; a rare one can afford a long one.
            Shannon's insight is that this exchange rate is fixed by the data.
          </p>
        </div>

        <div class="numbers">
          <div class="headline">
            <span class="value">{{ h.toFixed(2) }}</span>
            <span class="unit">bits per symbol</span>
            <span class="caption">entropy — the floor</span>
          </div>

          <div class="compare">
            <div class="cmp">
              <span class="k">Stored as plain text</span>
              <span class="v">{{ (storedBits / 8).toFixed(0) }} B</span>
              <span class="sub">8 bits every symbol</span>
            </div>
            <div class="cmp">
              <span class="k">Fixed-width codes</span>
              <span class="v">{{ Math.ceil(flat * symbols.length / 8) }} B</span>
              <span class="sub">{{ flat }} bits every symbol</span>
            </div>
            <div class="cmp best">
              <span class="k">At the entropy floor</span>
              <span class="v">{{ Math.ceil(floorBits / 8) }} B</span>
              <span class="sub">{{ h.toFixed(2) }} bits on average</span>
            </div>
          </div>

          <Fragment :index="1">
            <p class="verdict">
              No lossless encoder can beat that floor — it is a property of the message, not of
              anyone's cleverness. Everything that follows in this talk is an attempt to get
              close to it, or to change the data so the floor itself drops.
            </p>
          </Fragment>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.info-theory {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: 100%;
  height: 100%;
  align-items: center;
}

.controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  width: 100%;
  max-width: 52rem;
}

.editor {
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 0.7rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
}

.body {
  display: flex;
  gap: 2.5rem;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

h3 {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.histogram {
  width: 24rem;
}

.row {
  display: grid;
  grid-template-columns: 1.2rem 1fr 3.4rem;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 0.12rem;
}

.sym {
  font-family: monospace;
  font-size: 0.68rem;
  text-align: center;
}

.track {
  height: 0.55rem;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}

.ideal {
  font-size: 0.55rem;
  color: var(--text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.note {
  margin-top: 0.5rem;
  font-size: 0.62rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.numbers {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-width: 22rem;
}

.headline {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.headline .value {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.unit {
  font-size: 0.75rem;
  color: var(--text);
}

.headline .caption {
  width: 100%;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.compare {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cmp {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.2rem 0.8rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.68rem;
}

.cmp.best {
  border-color: var(--positive);
}

.cmp .k {
  color: var(--text);
}

.cmp .v {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cmp.best .v {
  color: var(--positive);
}

.cmp .sub {
  grid-column: 1 / -1;
  font-size: 0.55rem;
  color: var(--text-secondary);
}

.verdict {
  font-size: 0.68rem;
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
