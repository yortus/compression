<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import SignalPad from './SignalPad.vue'
import { useStat } from '../../stats/useStats'
import {
  SIGNAL_PRESETS,
  SIGNAL_LENGTH,
  dct1d,
  component,
  partialReconstruct,
  rmse,
  energyRank,
} from '../../engine/signal'

/**
 * Superposition, before any of it is about compression.
 *
 * One signal, and the cosine waves it is made of, added back one at a time. No bits are
 * saved here and none are claimed to be — the stat prices the honest thing (one byte per
 * wave you keep) so that the next slide has somewhere to start.
 */

const signal = ref([...SIGNAL_PRESETS[0].samples])
const waves = ref(4)
const activePreset = ref<string | null>(SIGNAL_PRESETS[0].name)

const coeffs = computed(() => dct1d(signal.value))
const sum = computed(() => partialReconstruct(coeffs.value, waves.value))
const error = computed(() => rmse(signal.value, sum.value))

/** How many waves it takes to hold 99% of the signal's energy. */
const enough = computed(() => energyRank(coeffs.value, 0.99))

const SHOWN = 8
const parts = computed(() =>
  Array.from({ length: SHOWN }, (_, k) => ({
    k,
    wave: component(coeffs.value, k),
    amplitude: Math.abs(coeffs.value[k]),
  })))

const maxAmplitude = computed(() => Math.max(...parts.value.map(p => p.amplitude), 1e-6))

useStat('waves-intro', () => ({
  label: `${waves.value} of ${SIGNAL_LENGTH} waves`,
  rawBits: SIGNAL_LENGTH * 8,
  encodedBits: waves.value * 8,
  overheadBits: 0,
  lossy: error.value > 0.0005,
  note: error.value > 0.0005
    ? `error ${(error.value * 100).toFixed(1)}% of full scale`
    : 'every wave kept — exact',
}))

function usePreset(name: string, samples: number[]) {
  signal.value = [...samples]
  activePreset.value = name
}

function onDraw(next: number[]) {
  signal.value = next
  activePreset.value = null
}
</script>

<template>
  <SlideLayout column>
    <div class="waves">
      <div class="input-row">
        <button
          v-for="p in SIGNAL_PRESETS" :key="p.name"
          :class="{ active: activePreset === p.name }"
          @click="usePreset(p.name, p.samples)"
        >{{ p.name }}</button>
        <span class="hint">or drag on the signal to draw your own</span>
      </div>

      <div class="main-pad">
        <SignalPad :model-value="signal" :overlay="sum" @update:model-value="onDraw" />
        <div class="pad-legend">
          <span class="key sig">the signal — 64 numbers</span>
          <span class="key sum">the first {{ waves }} waves, added up</span>
          <span class="err" :class="{ tiny: error < 0.02 }">error {{ (error * 100).toFixed(1) }}%</span>
        </div>
      </div>

      <label class="slider">
        <span>waves</span>
        <input type="range" min="0" :max="SIGNAL_LENGTH" v-model.number="waves" />
        <span class="value">{{ waves }} / {{ SIGNAL_LENGTH }}</span>
      </label>

      <div class="parts">
        <div v-for="p in parts" :key="p.k" class="part" :class="{ off: p.k >= waves }">
          <SignalPad :model-value="p.wave" :editable="false" :height="66" centred />
          <span class="part-label">
            {{ p.k === 0 ? 'flat' : `${p.k}×` }}
            <span class="bar" :style="{ width: (p.amplitude / maxAmplitude) * 100 + '%' }" />
          </span>
        </div>
        <div class="more">…and {{ SIGNAL_LENGTH - SHOWN }} finer ones</div>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Any signal at all is a sum of these fixed waves — the only thing that changes from
          signal to signal is <em>how much</em> of each. For this one,
          <strong>{{ enough }} waves</strong> hold 99% of the energy, and the other
          {{ SIGNAL_LENGTH - enough }} are rounding.
          <template v-if="enough > SIGNAL_LENGTH / 2">
            That is the awkward case: a sharp edge or a spike needs nearly all of them, because a
            corner is built out of every frequency at once.
          </template>
          <template v-else>
            Nothing has been thrown away yet, and nothing saved — but the numbers are now sorted by
            how much they matter, which is a different thing from being sorted by position.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.waves {
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
  font-size: 0.6rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.hint {
  font-size: 0.58rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-left: 0.4rem;
}

.main-pad {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pad-legend {
  display: flex;
  gap: 1rem;
  font-size: 0.55rem;
  color: var(--text-secondary);
  justify-content: center;
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
.key.sum::before { background: var(--accent); }

.err {
  font-variant-numeric: tabular-nums;
  color: var(--warning);
}

.err.tiny {
  color: var(--positive);
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.slider input {
  width: 18rem;
}

.slider .value {
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
}

.parts {
  display: flex;
  gap: 0.35rem;
  align-items: flex-end;
}

.part {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: opacity 0.2s;
}

/*
 * The canvas is 900px wide internally and only about a ninth of the row on screen, so
 * without an explicit height it collapses to a ten-pixel smear. Fixing the height stretches
 * the drawing vertically, which is fine: every component is stretched by the same factor,
 * so their relative amplitudes — the thing the slide is comparing — still read correctly.
 */
.part :deep(.signal-pad) {
  height: 3.2rem;
}

/* Waves past the slider are still drawn — the audience should see what is being left out. */
.part.off {
  opacity: 0.25;
}

.part-label {
  position: relative;
  font-size: 0.5rem;
  color: var(--text-secondary);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* How much of this wave the signal actually contains. */
.bar {
  display: block;
  height: 2px;
  background: var(--accent);
  margin: 0.1rem auto 0;
  border-radius: 1px;
}

.more {
  flex: none;
  width: 4rem;
  font-size: 0.5rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  padding-bottom: 0.8rem;
}

.verdict {
  font-size: 0.66rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 54rem;
  margin: 0 auto;
}
</style>
