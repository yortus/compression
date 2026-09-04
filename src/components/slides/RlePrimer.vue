<script setup lang="ts">
import { ref, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { encodeEscape, decodeEscape, ESCAPE_THRESHOLD } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

// Two inputs: one where the escape byte is innocuous, one where the data is full of it.
const PRESETS = [
  { name: 'Plain text', text: 'aaaaaaaa bbbb cccccccccccc dd eeeeeeee' },
  { name: 'Contains #', text: 'aaaaaaaa #### hash # marks ##### everywhere #' },
]

const text = ref(PRESETS[0].text)
const escChar = ref('#')

const escByte = computed(() => escChar.value.charCodeAt(0) || 35)
const symbols = computed(() => [...text.value].map(c => c.charCodeAt(0)))
const encoded = computed(() => encodeEscape(symbols.value, escByte.value))
const decoded = computed(() => decodeEscape(encoded.value, escByte.value))
const roundTrips = computed(() =>
  decoded.value.length === symbols.value.length &&
  decoded.value.every((c, i) => c === symbols.value[i]))

const rawBits = computed(() => symbols.value.length * 8)
const payloadBits = computed(() => encoded.value.length * 8)

// How many escape bytes exist only because a literal collided with the marker.
const collisions = computed(() => symbols.value.filter(c => c === escByte.value).length)

useStat('rle-primer', () => {
  if (!symbols.value.length) return null
  return {
    label: 'RLE · escape marker',
    rawBits: rawBits.value,
    encodedBits: payloadBits.value,
    // The escape byte is a real primer: one byte both sides must agree on in advance.
    overheadBits: 8,
    lossy: !roundTrips.value,
  }
})

/** Tag each output byte so the escapes and their arguments can be coloured. */
const tagged = computed(() => {
  const out: { text: string; kind: 'literal' | 'esc' | 'count' | 'value' }[] = []
  const e = encoded.value
  let i = 0
  while (i < e.length) {
    if (e[i] === escByte.value) {
      const count = e[i + 1]
      out.push({ text: String.fromCharCode(escByte.value), kind: 'esc' })
      if (count === 0) {
        out.push({ text: '0', kind: 'count' })
        i += 2
      } else {
        out.push({ text: String(count), kind: 'count' })
        out.push({ text: String.fromCharCode(e[i + 2]), kind: 'value' })
        i += 3
      }
    } else {
      out.push({ text: String.fromCharCode(e[i]), kind: 'literal' })
      i++
    }
  }
  return out
})
</script>

<template>
  <SlideLayout column>
    <div class="primer">
      <div class="controls">
        <button
          v-for="p in PRESETS" :key="p.name"
          :class="{ active: text === p.text }"
          @click="text = p.text"
        >{{ p.name }}</button>
        <label class="esc-label">
          escape byte
          <input v-model="escChar" maxlength="1" class="esc-input" spellcheck="false" />
        </label>
      </div>

      <input v-model="text" class="editor" spellcheck="false" />

      <div class="rule">
        Runs of {{ ESCAPE_THRESHOLD }} or more become
        <span class="esc">{{ escChar }}</span><span class="count">n</span><span class="value">c</span>.
        Everything else passes through as a literal.
      </div>

      <div class="output">
        <span v-for="(t, i) in tagged" :key="i" :class="['byte', t.kind]">{{ t.text }}</span>
      </div>

      <div class="tally">
        <span>{{ symbols.length }} bytes in</span>
        <span class="sep">→</span>
        <span :class="payloadBits > rawBits ? 'bad' : 'good'">{{ encoded.length }} bytes out</span>
        <span class="sep">+</span>
        <span class="primer-cost">1 byte of shared primer</span>
      </div>

      <Fragment :index="1">
        <p class="verdict" :class="{ bad: collisions > 0 }">
          <template v-if="collisions > 0">
            The data contains the escape byte {{ collisions }} times. Each one has to be escaped
            itself, so the marker costs <strong>two bytes</strong> where an ordinary byte costs one.
            Pick the marker badly and the encoder makes things worse.
          </template>
          <template v-else>
            Neither side can read this stream without already knowing which byte is the marker.
            That agreement is the primer — cheap here, but never free, and the palette on the next
            slides costs a great deal more.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.primer {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
  width: 100%;
}

.controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.esc-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
  margin-left: 0.6rem;
}

.esc-input {
  width: 2rem;
  text-align: center;
  font-family: monospace;
  font-size: 0.75rem;
  padding: 0.2rem;
  border-radius: 4px;
  border: 1px solid var(--warning);
  background: var(--bg-elevated);
  color: var(--warning);
}

.editor {
  width: 100%;
  max-width: 40rem;
  font-family: monospace;
  font-size: 0.72rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
}

.rule {
  font-size: 0.68rem;
  color: var(--text-secondary);
}

.rule .esc, .rule .count, .rule .value {
  font-family: monospace;
  padding: 0 0.15rem;
  border-radius: 2px;
}

.output {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  max-width: 50rem;
}

.byte {
  min-width: 0.85rem;
  height: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.15rem;
  font-family: monospace;
  font-size: 0.68rem;
  border-radius: 2px;
  background: var(--bg-elevated);
}

.esc {
  background: var(--warning);
  color: #000;
  font-weight: 700;
}

.count {
  background: var(--accent);
  color: #fff;
}

.value {
  background: var(--accent-dim);
}

.tally {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sep {
  color: var(--text-secondary);
}

.primer-cost {
  color: var(--warning);
}

.good {
  color: var(--positive);
  font-weight: 600;
}

.bad {
  color: var(--negative);
}

.verdict {
  font-size: 0.75rem;
  max-width: 42rem;
  text-align: center;
  line-height: 1.45;
  color: var(--text-secondary);
}

.verdict.bad {
  color: var(--text);
}
</style>
