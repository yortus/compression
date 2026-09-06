<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import SignalPad from './SignalPad.vue'
import { useStat } from '../../stats/useStats'
import { SIGNAL_PRESETS, SIGNAL_LENGTH, dct1d, idct1d, rmse, energyRank } from '../../engine/signal'

/**
 * The same decomposition as the previous slide, now with a price on it.
 *
 * Two knobs, because the two lossy decisions in a transform codec are genuinely
 * different: *how many* coefficients you keep, and *how precisely* you store the ones you
 * keep. Quantisation is the second one, met here in one dimension before it arrives as an
 * 8x8 table.
 */

const signal = ref([...SIGNAL_PRESETS[0].samples])
const keep = ref(8)
const bits = ref(8)
const activePreset = ref<string | null>(SIGNAL_PRESETS[0].name)

const coeffs = computed(() => dct1d(signal.value))
const maxAbs = computed(() => Math.max(...coeffs.value.map(Math.abs), 1e-9))

/** Coefficients as actually stored: the first `keep`, each rounded to `bits` of precision. */
const stored = computed(() => {
  const levels = 2 ** (bits.value - 1) - 1
  const q = maxAbs.value / levels
  return coeffs.value.map((c, k) => (k < keep.value ? Math.round(c / q) * q : 0))
})

const reconstruction = computed(() => idct1d(stored.value))
const error = computed(() => rmse(signal.value, reconstruction.value))
const enough = computed(() => energyRank(coeffs.value, 0.99))

const rawBits = SIGNAL_LENGTH * 8
const encodedBits = computed(() => keep.value * bits.value)

useStat('dct-1d', () => ({
  label: `DCT-II · ${keep.value} coefficients × ${bits.value} bits`,
  rawBits,
  encodedBits: encodedBits.value,
  // The scale factor the decoder needs to undo the rounding travels with the data.
  overheadBits: keep.value > 0 ? 8 : 0,
  lossy: error.value > 0.0005,
  note: `error ${(error.value * 100).toFixed(1)}% of full scale`,
}))

function usePreset(name: string, samples: number[]) {
  signal.value = [...samples]
  activePreset.value = name
}

function onDraw(next: number[]) {
  signal.value = next
  activePreset.value = null
}

/** Bar height as a share of the tallest coefficient, so shape survives any signal. */
function barHeight(c: number) {
  return (Math.abs(c) / maxAbs.value) * 100
}
</script>

<template>
  <SlideLayout column>
    <div class="dct1d">
      <div class="input-row">
        <button
          v-for="p in SIGNAL_PRESETS" :key="p.name"
          :class="{ active: activePreset === p.name }"
          @click="usePreset(p.name, p.samples)"
        >{{ p.name }}</button>
        <span class="hint">{{ SIGNAL_PRESETS.find(p => p.name === activePreset)?.hint ?? 'your own signal' }}</span>
      </div>

      <div class="panes">
        <div class="pane">
          <h3>Signal, and what comes back</h3>
          <SignalPad :model-value="signal" :overlay="reconstruction" @update:model-value="onDraw" :height="160" />
          <div class="legend">
            <span class="key sig">original</span>
            <span class="key rec">reconstructed from {{ keep }}</span>
            <span class="err" :class="error < 0.02 ? 'good' : 'warn'">error {{ (error * 100).toFixed(1) }}%</span>
          </div>
        </div>

        <div class="pane">
          <h3>Coefficients — click to keep that many</h3>
          <div class="bars">
            <span
              v-for="(c, k) in coeffs" :key="k"
              class="bar"
              :class="{ dropped: k >= keep, negative: c < 0 }"
              :style="{ height: Math.max(1, barHeight(c)) + '%' }"
              :title="`k=${k}: ${c.toFixed(3)}`"
              @click="keep = k + 1"
            />
          </div>
          <div class="axis">
            <span>flat</span>
            <span>→ finer detail →</span>
            <span>{{ SIGNAL_LENGTH - 1 }}</span>
          </div>
        </div>
      </div>

      <div class="knobs">
        <label class="slider">
          <span>keep</span>
          <input type="range" min="0" :max="SIGNAL_LENGTH" v-model.number="keep" />
          <span class="value">{{ keep }} / {{ SIGNAL_LENGTH }}</span>
        </label>
        <label class="slider">
          <span>precision</span>
          <input type="range" min="2" max="12" v-model.number="bits" />
          <span class="value">{{ bits }} bits each</span>
        </label>
        <span class="budget">
          {{ rawBits }} bits → <strong :class="encodedBits < rawBits ? 'good' : 'warn'">{{ encodedBits }}</strong>
        </span>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Dropping the tail costs almost nothing <em>when the tail is small</em> —
          {{ enough }} of {{ SIGNAL_LENGTH }} coefficients already hold 99% of this signal.
          That is a fact about the data, not about the transform: on the spike preset the
          coefficients are all the same size and there is no tail to drop. JPEG runs this exact
          transform — DCT-II — in two dimensions over 8×8 blocks, and it works for the same reason:
          real images are mostly smooth, so the fine coefficients are mostly small.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.dct1d {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.input-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
}

.input-row button {
  font-size: 0.62rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.hint {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-left: 0.4rem;
}

/* Fixed height rather than flex: the signal pad has a fixed height of its own, and
   letting the bars stretch to fill the slide left the two panes obviously mismatched. */
.panes {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.pane h3 {
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.legend {
  display: flex;
  gap: 0.9rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.key::before {
  content: '';
  display: inline-block;
  width: 0.7rem;
  height: 2px;
  margin-right: 0.3rem;
  vertical-align: middle;
}

.key.sig::before { background: var(--text-secondary); }
.key.rec::before { background: var(--accent); }

.err.good { color: var(--positive); }
.err.warn { color: var(--warning); }

.bars {
  height: 160px;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  padding: 0.3rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.bar {
  flex: 1;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
  cursor: pointer;
  transition: opacity 0.15s;
}

/* Sign matters — a negative coefficient subtracts its wave rather than adding it. */
.bar.negative {
  background: var(--warning);
}

.bar.dropped {
  opacity: 0.18;
}

.axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.knobs {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.slider input {
  width: 10rem;
}

.slider .value {
  font-variant-numeric: tabular-nums;
  min-width: 5rem;
}

.budget {
  font-variant-numeric: tabular-nums;
}

.good { color: var(--positive); }
.warn { color: var(--negative); }

.verdict {
  font-size: 0.66rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 54rem;
  margin: 0 auto;
}
</style>
