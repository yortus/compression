<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { useStat } from '../../stats/useStats'
import {
  buildHuffman,
  countSymbols,
  payloadBits,
  codeTableBits,
  encodeSymbols,
  decodeBits,
  type HuffNode,
} from '../../engine/codecs/huffman'

/**
 * Huffman built one merge at a time, over whatever the audience types.
 *
 * The tree is the knob: stepping through the merges is the algorithm, and every step
 * changes the code lengths and therefore the numbers in the HUD. The point to land is
 * that nothing here is clever — take the two rarest things, glue them together, repeat —
 * and that the resulting code table is itself a cost.
 */

const PRESETS = [
  { name: 'Lopsided', text: 'aaaaaaaaaaaaaaaabbbbbbbbccccddee' },
  { name: 'English', text: 'the sooner the better' },
  { name: 'Flat', text: 'abcdefghabcdefgh' },
]

const text = ref(PRESETS[0].text)
const step = ref(0)
const playing = ref(false)
let timer: number | undefined

const symbols = computed(() => [...text.value])
const counts = computed(() => countSymbols(symbols.value))
const build = computed(() => buildHuffman(counts.value))
const totalSteps = computed(() => build.value.steps.length)

/** The forest as it stands after `step` merges — a row of roots, not yet one tree. */
const pool = computed<HuffNode<string>[]>(() => {
  const s = build.value.steps
  if (s.length === 0) return build.value.leaves
  if (step.value <= 0) return [...build.value.leaves].sort((a, b) => a.weight - b.weight || a.id - b.id)
  return s[Math.min(step.value, s.length) - 1].pool
})

const complete = computed(() => step.value >= totalSteps.value)
const lastMerge = computed(() =>
  step.value > 0 ? build.value.steps[Math.min(step.value, totalSteps.value) - 1] : null)

// Codes only exist once the tree is one tree; before that the slide shows the forest.
const codes = computed(() => (complete.value ? build.value.codes : new Map<string, string>()))

const bitstring = computed(() => (complete.value ? encodeSymbols(symbols.value, codes.value) : ''))
const encoded = computed(() => (complete.value ? payloadBits(counts.value, codes.value) : 0))
const tableBits = computed(() => (complete.value ? codeTableBits(codes.value, 8) : 0))
const rawBits = computed(() => symbols.value.length * 8)

/** Decode the bits back rather than assert the code works. */
const roundTrips = computed(() => {
  const tree = build.value.tree
  if (!complete.value || !tree) return false
  return decodeBits(tree, bitstring.value).join('') === text.value
})

useStat('huffman-build', () => {
  if (!complete.value || !symbols.value.length) return null
  return {
    label: `Huffman · ${symbols.value.length} characters`,
    rawBits: rawBits.value,
    encodedBits: encoded.value,
    overheadBits: tableBits.value,
    lossy: !roundTrips.value,
    note: `${codes.value.size} symbols · ${(encoded.value / symbols.value.length).toFixed(2)} bits/char`,
  }
})

const rows = computed(() =>
  [...counts.value]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([symbol, count]) => ({
      symbol,
      count,
      code: codes.value.get(symbol) ?? '',
    })))

// --- Layout -----------------------------------------------------------------
// Leaves sit on a common baseline and merges rise above them, so a half-built forest
// reads as "these are still loose" rather than as several unrelated diagrams.

interface Placed {
  node: HuffNode<string>
  x: number
  y: number
}
interface Edge {
  x1: number; y1: number; x2: number; y2: number; bit: string
}

function heightOf(node: HuffNode<string>): number {
  if (node.symbol !== undefined) return 0
  return 1 + Math.max(heightOf(node.left!), heightOf(node.right!))
}

const layout = computed(() => {
  const roots = pool.value
  const maxH = Math.max(1, ...roots.map(heightOf))
  const nodes: Placed[] = []
  const edges: Edge[] = []
  let leafX = 0

  function place(node: HuffNode<string>): number {
    const y = maxH - heightOf(node)
    if (node.symbol !== undefined) {
      const x = leafX++
      nodes.push({ node, x, y })
      return x
    }
    const lx = place(node.left!)
    const rx = place(node.right!)
    const x = (lx + rx) / 2
    nodes.push({ node, x, y })
    edges.push({ x1: x, y1: y, x2: lx, y2: maxH - heightOf(node.left!), bit: '0' })
    edges.push({ x1: x, y1: y, x2: rx, y2: maxH - heightOf(node.right!), bit: '1' })
    return x
  }

  for (const root of roots) {
    place(root)
    leafX += 0.6 // breathing room between the roots still on the table
  }

  return { nodes, edges, width: Math.max(1, leafX), height: maxH }
})

const COL = 34
const ROW = 40
function px(x: number) { return x * COL + COL / 2 }
function py(y: number) { return y * ROW + 22 }

function display(ch: string) {
  return ch === ' ' ? '␣' : ch
}

function isNew(node: HuffNode<string>) {
  return lastMerge.value?.parent.id === node.id
}

function stop() {
  playing.value = false
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}

function play() {
  stop()
  if (totalSteps.value === 0) return
  step.value = 0
  playing.value = true
  timer = window.setInterval(() => {
    if (step.value >= totalSteps.value) stop()
    else step.value++
  }, 550)
}

// Typing rebuilds the tree; show it finished rather than snapping back to nothing.
watch(totalSteps, n => { stop(); step.value = n }, { immediate: true })
onUnmounted(stop)
</script>

<template>
  <SlideLayout column>
    <div class="huff">
      <div class="input-row">
        <button
          v-for="p in PRESETS" :key="p.name"
          :class="{ active: text === p.text }"
          @click="text = p.text"
        >{{ p.name }}</button>
        <input v-model="text" class="editor" spellcheck="false" maxlength="64" />
      </div>

      <div class="body">
        <div class="table-col">
          <div class="table-head">
            <span>sym</span><span>n</span><span>code</span>
          </div>
          <div v-for="r in rows" :key="r.symbol" class="table-row">
            <span class="sym">{{ display(r.symbol) }}</span>
            <span class="count">{{ r.count }}</span>
            <span class="code">{{ r.code || '—' }}</span>
          </div>
        </div>

        <div class="tree-col">
          <svg
            class="tree"
            :viewBox="`0 0 ${layout.width * COL} ${(layout.height + 1) * ROW + 12}`"
            preserveAspectRatio="xMidYMid meet"
          >
            <g class="edges">
              <template v-for="(e, i) in layout.edges" :key="i">
                <line :x1="px(e.x1)" :y1="py(e.y1)" :x2="px(e.x2)" :y2="py(e.y2)" />
                <text class="bit" :x="(px(e.x1) + px(e.x2)) / 2" :y="(py(e.y1) + py(e.y2)) / 2">{{ e.bit }}</text>
              </template>
            </g>
            <g v-for="p in layout.nodes" :key="p.node.id" :class="['node', { leaf: p.node.symbol !== undefined, fresh: isNew(p.node) }]">
              <circle :cx="px(p.x)" :cy="py(p.y)" :r="p.node.symbol !== undefined ? 13 : 11" />
              <text class="label" :x="px(p.x)" :y="py(p.y) + 4">
                {{ p.node.symbol !== undefined ? display(p.node.symbol) : p.node.weight }}
              </text>
              <text v-if="p.node.symbol !== undefined" class="weight" :x="px(p.x)" :y="py(p.y) + 26">{{ p.node.weight }}</text>
            </g>
          </svg>

          <div class="playbar">
            <button class="chip" @click="step = Math.max(0, step - 1)" :disabled="step === 0">◀</button>
            <span class="progress">merge {{ step }} / {{ totalSteps }}</span>
            <button class="chip" @click="step = Math.min(totalSteps, step + 1)" :disabled="complete">▶</button>
            <button class="chip" @click="playing ? stop() : play()">{{ playing ? '⏸ stop' : '↻ replay' }}</button>
            <span v-if="lastMerge && !complete" class="merge-note">
              combined {{ lastMerge.left.weight }} + {{ lastMerge.right.weight }} — always the two lightest
            </span>
            <span v-else-if="complete" class="merge-note done">
              one tree · every symbol a leaf · decode verified {{ roundTrips ? '✓' : '✗' }}
            </span>
          </div>
        </div>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          <template v-if="complete">
            {{ symbols.length }} characters in {{ encoded }} bits — <strong>{{ (encoded / symbols.length).toFixed(2) }}
            bits each</strong> against a flat 8 — but the decoder cannot read a single one of them
            without the table, and that costs another {{ tableBits }} bits. On a message this short
            the primer is the bigger half; on a megabyte of the same text it disappears.
          </template>
          <template v-else>
            Step through to the end to see the codes.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.huff {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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

.editor {
  width: 22rem;
  font-family: monospace;
  font-size: 0.7rem;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 1.2rem;
  align-items: stretch;
}

.table-col {
  flex: none;
  width: 8rem;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.62rem;
}

.table-head, .table-row {
  display: grid;
  grid-template-columns: 1.6rem 1.4rem 1fr;
  gap: 0.3rem;
  padding: 0.1rem 0.2rem;
}

.table-head {
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.2rem;
}

.sym {
  color: var(--text);
}

.count {
  color: var(--text-secondary);
  text-align: right;
}

.code {
  color: var(--accent);
}

.tree-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.tree {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.edges line {
  stroke: var(--border);
  stroke-width: 1.5;
}

.bit {
  fill: var(--text-secondary);
  font-size: 11px;
  font-family: monospace;
  text-anchor: middle;
}

.node circle {
  fill: var(--bg-elevated);
  stroke: var(--border);
  stroke-width: 1.5;
}

.node.leaf circle {
  fill: var(--accent-dim);
  stroke: var(--accent);
}

/* The pair just combined, so the eye can follow a replay without narration. */
.node.fresh circle {
  stroke: var(--warning);
  stroke-width: 2.5;
}

.label {
  fill: var(--text);
  font-size: 12px;
  font-family: monospace;
  text-anchor: middle;
}

.weight {
  fill: var(--text-secondary);
  font-size: 10px;
  font-family: monospace;
  text-anchor: middle;
}

.playbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: center;
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.chip {
  padding: 0.15rem 0.45rem;
  font-size: 0.6rem;
  border-radius: 4px;
}

.progress {
  font-variant-numeric: tabular-nums;
  min-width: 6rem;
  text-align: center;
}

.merge-note {
  font-style: italic;
}

.merge-note.done {
  color: var(--positive);
  font-style: normal;
}

.verdict {
  font-size: 0.68rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 52rem;
  margin: 0 auto;
}
</style>
