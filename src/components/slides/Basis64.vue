<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { basisFunction, inverseDCT } from '../../engine/jpeg/dct'
import { ZIGZAG_ORDER, zigzagIndex } from '../../engine/jpeg/zigzag'
import type { Block } from '../../engine/jpeg/types'
import { useStat } from '../../stats/useStats'

/**
 * The 64 patterns every 8x8 block is made of, added back one at a time.
 *
 * `dct-1d` showed a signal as a sum of waves; this is the same claim in two dimensions,
 * against a real block from the image on screen. The build-up runs in zigzag order — the
 * order JPEG will later care about — but individual patterns can be clicked in and out,
 * which is where the accounting gets interesting: an arbitrary subset needs a 64-bit map
 * telling the decoder which ones you sent, while a prefix needs only a count.
 */

const pipeline = inject(PIPELINE_KEY)!

/** Selected by (row * 8 + col) in coefficient space. */
const chosen = ref<boolean[]>(prefix(6))
const playing = ref(false)
let timer: number | undefined

function prefix(n: number): boolean[] {
  const out = new Array<boolean>(64).fill(false)
  for (let i = 0; i < Math.min(64, n); i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    out[r * 8 + c] = true
  }
  return out
}

const count = computed(() => chosen.value.filter(Boolean).length)

/** True when the selection is the first N in zigzag order — the cheap case to describe. */
const isPrefix = computed(() => {
  for (let i = 0; i < 64; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    if (chosen.value[r * 8 + c] !== i < count.value) return false
  }
  return true
})

const dct = computed(() => pipeline.selectedDCT.value)

const maxAbs = computed(() => {
  const d = dct.value
  if (!d) return 1
  let m = 1e-6
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) m = Math.max(m, Math.abs(d[r][c]))
  return m
})

const reconstruction = computed<Block | null>(() => {
  const d = dct.value
  if (!d) return null
  const partial: Block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (chosen.value[r * 8 + c]) partial[r][c] = d[r][c]
    }
  }
  return inverseDCT(partial)
})

/** Largest per-pixel difference from the real block — measured, not asserted. */
const maxError = computed(() => {
  const original = pipeline.selectedBlock.value
  const recon = reconstruction.value
  if (!original || !recon) return 0
  let m = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) m = Math.max(m, Math.abs(original[r][c] - recon[r][c]))
  }
  return m
})

useStat('basis-64', () => {
  if (!dct.value) return null
  return {
    label: `${count.value} of 64 patterns · block ${pipeline.selectedBlockIndex.value}`,
    rawBits: 64 * 8,
    encodedBits: count.value * 8,
    // A prefix needs a length; any other subset needs a map of which 64 you sent.
    overheadBits: isPrefix.value ? 6 : 64,
    lossy: maxError.value > 0,
    note: maxError.value > 0
      ? `max pixel error ${Math.round(maxError.value)}/255${isPrefix.value ? '' : ' · needs a 64-bit map'}`
      : 'exact — all 64 patterns present',
  }
})

// --- Drawing ----------------------------------------------------------------

const tiles: HTMLCanvasElement[] = []
function setTile(el: unknown, i: number) {
  if (el instanceof HTMLCanvasElement) tiles[i] = el
}

function drawTiles() {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const canvas = tiles[r * 8 + c]
      if (!canvas) continue
      canvas.width = 8
      canvas.height = 8
      const ctx = canvas.getContext('2d')!
      const bf = basisFunction(r, c)
      const img = ctx.createImageData(8, 8)
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const v = Math.max(0, Math.min(255, Math.round(bf[x][y])))
          const o = (x * 8 + y) * 4
          img.data[o] = img.data[o + 1] = img.data[o + 2] = v
          img.data[o + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }
  }
}

const reconCanvas = ref<HTMLCanvasElement>()
const sourceCanvas = ref<HTMLCanvasElement>()

function drawBlock(canvas: HTMLCanvasElement | undefined, block: Block | null) {
  if (!canvas || !block) return
  canvas.width = 8
  canvas.height = 8
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(8, 8)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = Math.max(0, Math.min(255, Math.round(block[r][c])))
      const o = (r * 8 + c) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function redraw() {
  drawBlock(reconCanvas.value, reconstruction.value)
  drawBlock(sourceCanvas.value, pipeline.selectedBlock.value)
}

watch([reconstruction, () => pipeline.selectedBlock.value], redraw)
onMounted(() => { drawTiles(); redraw() })

// --- Controls ---------------------------------------------------------------

function toggle(index: number) {
  stop()
  const next = [...chosen.value]
  next[index] = !next[index]
  chosen.value = next
}

function setCount(n: number) {
  stop()
  chosen.value = prefix(n)
}

function stop() {
  playing.value = false
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}

function play() {
  stop()
  let n = 0
  chosen.value = prefix(0)
  playing.value = true
  timer = window.setInterval(() => {
    n++
    chosen.value = prefix(n)
    if (n >= 64) stop()
  }, 90)
}

onUnmounted(stop)

/** Magnitude of this pattern's coefficient, 0..1 — which ones actually carry the block. */
function share(r: number, c: number) {
  const d = dct.value
  return d ? Math.abs(d[r][c]) / maxAbs.value : 0
}

const CELLS = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8, i }))
</script>

<template>
  <SlideLayout>
    <div class="basis">
      <div class="grid-col">
        <h3>The 64 patterns — click to add or remove one</h3>
        <div class="grid">
          <button
            v-for="cell in CELLS" :key="cell.i"
            class="tile"
            :class="{ on: chosen[cell.i] }"
            :title="`(${cell.r},${cell.c}) · zigzag #${zigzagIndex(cell.r, cell.c)}`"
            @click="toggle(cell.i)"
          >
            <canvas :ref="el => setTile(el, cell.i)" />
            <span class="mag" :style="{ opacity: share(cell.r, cell.c) }" />
          </button>
        </div>
        <p class="grid-note">
          Brightness of the bar under each pattern is how much of it this block contains — nearly
          all of it is in the top-left corner.
        </p>
      </div>

      <div class="out-col">
        <div class="pair">
          <div class="shot">
            <canvas ref="reconCanvas" class="big" />
            <span class="cap">{{ count }} patterns</span>
          </div>
          <div class="shot">
            <canvas ref="sourceCanvas" class="big" />
            <span class="cap">the real block</span>
          </div>
        </div>

        <p class="error" :class="maxError === 0 ? 'good' : 'warn'">
          max pixel error {{ Math.round(maxError) }} / 255
        </p>

        <label class="slider">
          <span>zigzag order</span>
          <input type="range" min="0" max="64" :value="count" @input="setCount(+($event.target as HTMLInputElement).value)" />
          <span class="value">{{ count }} / 64</span>
        </label>

        <div class="buttons">
          <button class="chip" @click="playing ? stop() : play()">{{ playing ? '⏸ stop' : '▶ build up' }}</button>
          <button class="chip" @click="setCount(0)">none</button>
          <button class="chip" @click="setCount(64)">all 64</button>
        </div>

        <Fragment :index="1">
          <p class="verdict">
            A handful of patterns already looks like the block; the remaining sixty are correcting
            detail nobody will look for. Keeping a <em>prefix</em> costs one small count to describe,
            which is why JPEG throws away the tail rather than cherry-picking — an arbitrary
            selection would need a 64-bit map explaining itself.
          </p>
        </Fragment>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.basis {
  display: flex;
  gap: 1.5rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

.grid-col, .out-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.grid-col {
  flex: none;
}

.out-col {
  flex: 1;
  align-items: center;
  justify-content: center;
}

h3 {
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(8, 2.1rem);
  grid-auto-rows: 2.1rem;
  gap: 2px;
}

.tile {
  position: relative;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: hidden;
  background: none;
  opacity: 0.4;
  transition: opacity 0.12s, border-color 0.12s;
}

.tile:hover {
  border-color: var(--accent);
  background: none;
}

/* Included patterns are the ones being added up on the right. */
.tile.on {
  opacity: 1;
  border-color: var(--accent);
}

.tile canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}

.mag {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  background: var(--accent);
}

.grid-note {
  font-size: 0.52rem;
  color: var(--text-secondary);
  max-width: 18rem;
  line-height: 1.4;
}

.pair {
  display: flex;
  gap: 1rem;
}

.shot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.big {
  width: 9rem;
  height: 9rem;
  image-rendering: pixelated;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.cap {
  font-size: 0.55rem;
  color: var(--text-secondary);
}

.error {
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}

.error.good { color: var(--positive); }
.error.warn { color: var(--warning); }

.slider {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.slider input {
  width: 12rem;
}

.slider .value {
  font-variant-numeric: tabular-nums;
  min-width: 3.5rem;
}

.buttons {
  display: flex;
  gap: 0.4rem;
}

.chip {
  padding: 0.18rem 0.5rem;
  font-size: 0.6rem;
  border-radius: 4px;
}

.verdict {
  font-size: 0.64rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  max-width: 26rem;
}
</style>
