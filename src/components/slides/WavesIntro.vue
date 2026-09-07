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

// The waves currently being summed, each centred on the pad's midline so they read as
// oscillations rather than sinking to the baseline the way a raw signed component would.
const ghostWaves = computed(() => {
  const out: number[][] = []
  for (let k = 0; k < waves.value; k++) {
    const comp = component(coeffs.value, k)
    const mean = comp.reduce((s, v) => s + v, 0) / comp.length
    out.push(comp.map(v => 0.5 + v - mean))
  }
  return out
})

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

// A preset's shape drawn small enough to sit on a button — a polyline in a 0..1 box.
const THUMB_W = 60
const THUMB_H = 30
function thumbPoints(samples: number[]) {
  const n = samples.length
  const pad = 3
  const w = THUMB_W - pad * 2
  const h = THUMB_H - pad * 2
  return samples
    .map((v, i) => `${(pad + (i / (n - 1)) * w).toFixed(1)},${(pad + (1 - v) * h).toFixed(1)}`)
    .join(' ')
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
          :title="p.name"
          @click="usePreset(p.name, p.samples)"
        >
          <svg class="thumb" :viewBox="`0 0 ${THUMB_W} ${THUMB_H}`" preserveAspectRatio="none">
            <polyline :points="thumbPoints(p.samples)" />
          </svg>
        </button>
        <span class="hint">{{ activePreset ? activePreset.toLowerCase() : 'or drag on the signal to draw your own' }}</span>
      </div>

      <div class="main-pad">
        <SignalPad :model-value="signal" :overlay="sum" :ghosts="ghostWaves" signal-color="#aecbf5" overlay-color="#a7f3d0" :overlay-width="4" ghost-color="var(--positive)" :ghost-alpha="0.85" :height="300" pixel-rows @update:model-value="onDraw" />
        <div class="pad-legend">
          <span class="key sig">target</span>
          <span class="key wave">component waves</span>
          <span class="key sum">sum of waves</span>
        </div>
      </div>

      <div class="controls">
        <label class="slider">
          <span>waves</span>
          <input type="range" min="0" :max="SIGNAL_LENGTH" v-model.number="waves" />
          <span class="value">{{ waves }} / {{ SIGNAL_LENGTH }}</span>
        </label>
        <span class="err" :class="{ tiny: error < 0.02 }">error {{ (error * 100).toFixed(1) }}%</span>
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
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
}

.input-row button {
  padding: 0.25rem;
  border-radius: 5px;
  line-height: 0;
}

.thumb {
  display: block;
  width: 3.2rem;
  height: 1.6rem;
}

.thumb polyline {
  fill: none;
  stroke: #aecbf5;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.hint {
  font-size: 0.62rem;
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
  gap: 1.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  justify-content: center;
}

.key::before {
  content: '';
  display: inline-block;
  width: 0.9rem;
  height: 3px;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.key.sig::before { background: #aecbf5; }
.key.sum::before { background: #a7f3d0; }
.key.wave::before { background: var(--positive); }

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.slider input {
  width: 18rem;
}

.slider .value {
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
}

.err {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--warning);
}

.err.tiny {
  color: var(--positive);
}

.verdict {
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 54rem;
  margin: 0 auto;
}
</style>
