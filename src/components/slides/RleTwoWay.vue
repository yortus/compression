<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { pairRLE } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

const text = ref('WWWWWWBBWWWWWWWWWWWWBBBWWWWWW')

const symbols = computed(() => [...text.value].map(c => c.charCodeAt(0)))
const encoded = computed(() => pairRLE.encode(symbols.value))
const decoded = computed(() => pairRLE.decode(encoded.value))
const decodedText = computed(() => decoded.value.map(c => String.fromCharCode(c)).join(''))

// The claim on this slide is that the transform is invertible, so check it rather
// than assert it: the badge is computed from the actual decoded output.
const roundTrips = computed(() =>
  decoded.value.length === symbols.value.length &&
  decoded.value.every((c, i) => c === symbols.value[i]))

useStat('rle-two-way', () => {
  if (!symbols.value.length) return null
  return {
    label: 'RLE · round trip',
    rawBits: pairRLE.rawBits(symbols.value),
    encodedBits: encoded.value.payloadBits,
    overheadBits: encoded.value.primerBits,
    lossy: !roundTrips.value,
  }
})
</script>

<template>
  <SlideLayout column>
    <div class="two-way">
      <input v-model="text" class="editor" spellcheck="false" />

      <div class="flow">
        <div class="stage">
          <h3>Original</h3>
          <div class="mono">{{ text }}</div>
          <span class="meta">{{ symbols.length }} bytes</span>
        </div>

        <div class="op">
          <span class="op-name">encode</span>
          <span class="op-arrow">→</span>
        </div>

        <div class="stage">
          <h3>Encoded</h3>
          <div class="mono pairs">
            <span v-for="(p, i) in encoded.data" :key="i" class="pair">
              {{ p.count }}{{ String.fromCharCode(p.value) }}
            </span>
          </div>
          <span class="meta">{{ encoded.payloadBits / 8 }} bytes</span>
        </div>

        <div class="op">
          <span class="op-name">decode</span>
          <span class="op-arrow">→</span>
        </div>

        <div class="stage">
          <h3>Decoded</h3>
          <div class="mono">{{ decodedText }}</div>
          <span class="meta">{{ decoded.length }} bytes</span>
        </div>
      </div>

      <Fragment :index="1">
        <div class="check" :class="{ ok: roundTrips }">
          <span class="tick">{{ roundTrips ? '✓' : '✗' }}</span>
          <span v-if="roundTrips">
            Decoded output is byte-for-byte identical to the input. Nothing was lost —
            the transform runs in both directions.
          </span>
          <span v-else>Round trip failed — the decoder did not reproduce the input.</span>
        </div>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.two-way {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: center;
  width: 100%;
}

.editor {
  width: 100%;
  max-width: 34rem;
  font-family: monospace;
  font-size: 0.72rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
}

.flow {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  max-width: 16rem;
}

.stage h3 {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.mono {
  font-family: monospace;
  font-size: 0.72rem;
  word-break: break-all;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  line-height: 1.5;
}

.pairs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.pair {
  background: var(--accent-dim);
  border-radius: 3px;
  padding: 0 0.25rem;
}

.meta {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.op {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--accent);
}

.op-name {
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.op-arrow {
  font-size: 1.1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 38rem;
  font-size: 0.75rem;
  line-height: 1.4;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--negative);
  color: var(--negative);
}

.check.ok {
  border-color: var(--positive);
  color: var(--positive);
}

.tick {
  font-size: 1.1rem;
  font-weight: 700;
}
</style>
