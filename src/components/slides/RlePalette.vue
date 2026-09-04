<script setup lang="ts">
import { inject, ref, computed, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { palettise, paletteToImageData, indexBits, paletteBits } from '../../engine/codecs/palette'
import { countRuns } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

const pipeline = inject(PIPELINE_KEY)!

// Powers of two, so the bits-per-index number is always a clean answer.
const SIZES = [4, 8, 16, 32, 64, 256]
const paletteSize = ref(16)

const canvasRef = ref<HTMLCanvasElement>()

const result = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? palettise(src, paletteSize.value) : null
})

const bits = computed(() => (result.value ? indexBits(result.value.palette.length) : 0))
const runs = computed(() => (result.value ? countRuns(result.value.indices) : 0))

const rawBits = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? src.width * src.height * 3 * 8 : 0
})
// Each run is a count byte plus one index, so narrower indices make runs cheaper too.
const payloadBits = computed(() => runs.value * (8 + bits.value))
const primerBits = computed(() => (result.value ? paletteBits(result.value.palette.length) : 0))

useStat('rle-palette', () => {
  const r = result.value
  if (!r) return null
  return {
    label: `Palette ${r.palette.length} + RLE`,
    rawBits: rawBits.value,
    encodedBits: payloadBits.value,
    overheadBits: primerBits.value,
    lossy: r.lossy,
    note: `${bits.value} bits per pixel`,
  }
})

function draw() {
  const r = result.value
  const canvas = canvasRef.value
  if (!r || !canvas) return
  canvas.width = r.width
  canvas.height = r.height
  canvas.getContext('2d')!.putImageData(paletteToImageData(r), 0, 0)
}

watch(result, draw)
onMounted(draw)
</script>

<template>
  <SlideLayout>
    <div class="palette-slide">
      <div class="panel">
        <canvas ref="canvasRef" v-loupe />
        <div class="swatches">
          <span
            v-for="(c, i) in result?.palette ?? []" :key="i"
            class="swatch"
            :style="{ background: `rgb(${c[0]},${c[1]},${c[2]})` }"
          />
        </div>
        <p class="caption">
          {{ result?.palette.length ?? 0 }} colours ·
          {{ (result?.sourceColors ?? 0).toLocaleString() }} in the original
        </p>
      </div>

      <div class="panel side">
        <div class="sizes">
          <span class="k">Palette</span>
          <button
            v-for="s in SIZES" :key="s"
            :class="{ active: paletteSize === s }"
            @click="paletteSize = s"
          >{{ s }}</button>
        </div>

        <div class="numbers">
          <div class="stat">
            <span class="k">Bits per pixel</span>
            <span class="v">{{ bits }} <span class="was">was 24</span></span>
          </div>
          <div class="stat">
            <span class="k">Runs in the index stream</span>
            <span class="v">{{ runs.toLocaleString() }}</span>
          </div>
          <div class="stat">
            <span class="k">Payload after RLE</span>
            <span class="v good">{{ (payloadBits / 8 / 1024).toFixed(0) }} KB</span>
          </div>
          <div class="stat">
            <span class="k">Palette (primer)</span>
            <span class="v primer">{{ Math.ceil(primerBits / 8) }} B</span>
          </div>
          <div class="stat total">
            <span class="k">Total vs raw</span>
            <span class="v good">
              {{ ((payloadBits + primerBits) / 8 / 1024).toFixed(0) }} KB
              vs {{ (rawBits / 8 / 1024).toFixed(0) }} KB
            </span>
          </div>
        </div>

        <Fragment :index="1">
          <p class="verdict">
            The encoder did not change — the <em>data</em> did. Pixels became indices, indices
            repeat where colours repeat, and the runs RLE needs finally exist.
            <span :class="result?.lossy ? 'lossy' : 'lossless'">
              {{ result?.lossy
                ? 'Reducing the colours threw information away: this step is lossy.'
                : 'This image had few enough colours to palettise exactly — no loss at all.' }}
            </span>
          </p>
        </Fragment>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.palette-slide {
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.panel.side {
  align-items: stretch;
  max-width: 24rem;
  gap: 0.8rem;
}

.panel canvas {
  max-width: 100%;
  max-height: 48vh;
  border-radius: 4px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 20rem;
  justify-content: center;
}

.swatch {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 2px;
}

.caption {
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.sizes {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sizes button {
  padding: 0.2rem 0.4rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.numbers {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.stat.total {
  border-top: 1px solid var(--border);
  padding-top: 0.3rem;
  font-weight: 600;
}

.k {
  color: var(--text-secondary);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.was {
  color: var(--text-secondary);
  text-decoration: line-through;
  font-size: 0.58rem;
}

.good {
  color: var(--positive);
}

.primer {
  color: var(--warning);
}

.verdict {
  font-size: 0.7rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.lossy {
  color: var(--warning);
}

.lossless {
  color: var(--positive);
}
</style>
