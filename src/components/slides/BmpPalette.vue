<script setup lang="ts">
import { inject, ref, computed, watch, onMounted } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { palettise, paletteToImageData } from '../../engine/codecs/palette'
import { describeVariants, encodeRle8, decodeRle8 } from '../../engine/formats/bmp'
import { useStat } from '../../stats/useStats'

/**
 * The same picture written three ways, as three real BMP files.
 *
 * Nothing about the encoder changes between the rows — what changes is what the pixels
 * *are*. Once they are indices rather than colours, neighbouring pixels start being
 * exactly equal, and the run-length mode the format reserved for exactly this case
 * finally has something to collapse.
 */

const pipeline = inject(PIPELINE_KEY)!

// Powers of two, so bits-per-index is always a clean answer.
const SIZES = [4, 8, 16, 32, 64, 256]
const paletteSize = ref(16)

const canvasRef = ref<HTMLCanvasElement>()

const source = computed(() => pipeline.sourceImageData.value)

const result = computed(() => {
  const src = source.value
  return src ? palettise(src, paletteSize.value) : null
})

const variants = computed(() => {
  const r = result.value
  if (!r) return null
  return describeVariants(r.width, r.height, r.indices, r.palette.length, r.lossy)
})

const rgbVariant = computed(() => variants.value?.[0] ?? null)
const rleVariant = computed(() => variants.value?.[2] ?? null)

/** Decode the run-length data back rather than take the format's word for it. */
const roundTrips = computed(() => {
  const r = result.value
  if (!r) return false
  const back = decodeRle8(encodeRle8(r.indices, r.width, r.height), r.width, r.height)
  if (back.length !== r.indices.length) return false
  for (let i = 0; i < back.length; i++) if (back[i] !== r.indices[i]) return false
  return true
})

useStat('bmp-palette', () => {
  const rle = rleVariant.value
  const rgb = rgbVariant.value
  if (!rle || !rgb) return null
  return {
    label: `BMP · ${rle.label}`,
    rawBits: rgb.bytes * 8,
    encodedBits: (rle.bytes - rle.overheadBytes) * 8,
    overheadBits: rle.overheadBytes * 8,
    lossy: rle.lossy,
    note: `${result.value?.palette.length} colours · round trip ${roundTrips.value ? 'verified' : 'FAILED'}`,
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

function kb(b: number) {
  return (b / 1024).toFixed(1) + ' KB'
}

function ratio(v: { bytes: number }) {
  const base = rgbVariant.value?.bytes ?? 0
  return base ? base / v.bytes : 0
}

/** Widest bar is the uncompressed 24-bit file, which is always the biggest. */
function width(v: { bytes: number }) {
  const base = rgbVariant.value?.bytes ?? 1
  return (v.bytes / base) * 100
}
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
        <div class="sizes">
          <span class="k">Palette</span>
          <button
            v-for="s in SIZES" :key="s"
            :class="{ active: paletteSize === s }"
            @click="paletteSize = s"
          >{{ s }}</button>
        </div>
      </div>

      <div class="panel side">
        <h3>The same image, three ways BMP can store it</h3>

        <div v-for="(v, i) in variants ?? []" :key="v.label" class="variant" :class="{ best: i === 2 }">
          <div class="head">
            <code>{{ v.label }}</code>
            <span class="size">{{ kb(v.bytes) }}</span>
            <span class="ratio" :class="{ dim: i === 0 }">{{ ratio(v).toFixed(2) }}:1</span>
          </div>
          <div class="track">
            <span class="fill" :style="{ width: width(v) + '%' }" />
          </div>
          <p class="note">
            {{ v.note }}
            <span v-if="v.lossy" class="tag lossy">lossy</span>
            <span v-else class="tag lossless">lossless</span>
          </p>
        </div>

        <Fragment :index="1">
          <p class="verdict">
            The encoder never changed — the <em>data</em> did. Pixels became indices, indices repeat
            wherever colours repeat, and the runs RLE needs finally exist. Note that the middle row
            already did most of the work for free: going from three bytes a pixel to one is exactly
            3:1 before any compression happens at all.
          </p>
          <p class="verdict aside">
            And if the run-length pass makes things worse — try the photo at 256 colours — a real
            encoder simply writes <code>BI_RGB</code> instead. Its worst case is bounded by
            <em>choosing not to</em>, which is a design decision, not luck.
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
  max-width: 27rem;
  gap: 0.5rem;
}

.panel canvas {
  max-width: 100%;
  max-height: 42vh;
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

h3 {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.variant {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
}

/* The row the act is heading towards. */
.variant.best {
  border-color: var(--positive);
}

.head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content max-content;
  gap: 0.6rem;
  align-items: baseline;
}

code {
  font-size: 0.65rem;
  color: var(--accent);
}

.size, .ratio {
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.ratio {
  color: var(--positive);
  min-width: 3.6rem;
  text-align: right;
}

.ratio.dim {
  color: var(--text-secondary);
  font-weight: 400;
}

.track {
  height: 0.4rem;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.25s ease;
}

.variant.best .fill {
  background: var(--positive);
}

.note {
  font-size: 0.55rem;
  color: var(--text-secondary);
}

.tag {
  font-size: 0.48rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0 0.15rem;
  margin-left: 0.25rem;
}

.tag.lossy {
  color: var(--warning);
}

.tag.lossless {
  color: var(--positive);
}

.verdict {
  font-size: 0.66rem;
  line-height: 1.45;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

.verdict.aside {
  margin-top: 0.3rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--border);
  font-size: 0.62rem;
}
</style>
