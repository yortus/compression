<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ycbcrPlaneToImageData, ycbcrToRgb, type YcbcrChannel } from '../../engine/jpeg/colorspace'
import { useStat } from '../../stats/useStats'

/**
 * The act's payoff: two of the three planes get thrown away at reduced resolution.
 *
 * Same three-up as the two slides before it, with one change — the chroma canvases are
 * drawn and displayed at their *actual* reduced size. The previous slide's punchline was
 * that all three planes are the same size while only one of them carries the picture;
 * this one is that observation cashed in, and the shrinking rectangles are the whole
 * point. Rendering them scaled back up to full width would hide the only thing that
 * happened.
 *
 * The A/B toggle exists because the claim being made is about the viewer, not the data.
 * "You cannot see it" is only worth saying if the room gets to try.
 */

const pipeline = inject(PIPELINE_KEY)!

const showOriginal = ref(false)

const canvases: Partial<Record<YcbcrChannel, HTMLCanvasElement>> = {}
function setCanvas(key: YcbcrChannel, el: unknown) {
  canvases[key] = (el as HTMLCanvasElement) ?? undefined
}
const compareCanvas = ref<HTMLCanvasElement>()

const sub = computed(() => pipeline.subsampled.value)
const mode = computed(() => pipeline.subsamplingMode.value)

const sizes = computed(() => {
  const s = sub.value
  if (!s) return null
  const luma = s.yWidth * s.yHeight
  const chroma = s.chromaWidth * s.chromaHeight
  return {
    luma,
    chroma,
    total: luma + 2 * chroma,
    before: luma * 3,
    /** Chroma width as a share of luma width, for drawing the planes to scale. */
    scale: s.chromaWidth / s.yWidth,
  }
})

const savedPercent = computed(() => {
  const s = sizes.value
  return s ? (1 - s.total / s.before) * 100 : 0
})

useStat('chroma-subsample', () => {
  const s = sub.value
  const z = sizes.value
  if (!s || !z) return null
  return {
    label: `Chroma subsampling · ${s.mode}`,
    rawBits: z.before * 8,
    encodedBits: z.total * 8,
    overheadBits: 0,
    lossy: s.mode !== '4:4:4',
    note: s.mode === '4:4:4' ? 'nothing discarded' : 'exactly the same ratio on every image',
  }
})

function drawPlanes() {
  const s = sub.value
  if (!s) return
  const dims: Record<YcbcrChannel, [number, number]> = {
    y: [s.yWidth, s.yHeight],
    cb: [s.chromaWidth, s.chromaHeight],
    cr: [s.chromaWidth, s.chromaHeight],
  }
  for (const key of ['y', 'cb', 'cr'] as const) {
    const canvas = canvases[key]
    if (!canvas) continue
    const [w, h] = dims[key]
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.putImageData(ycbcrPlaneToImageData(s[key], w, h, key), 0, 0)
  }
}

function drawCompare() {
  const s = sub.value
  const canvas = compareCanvas.value
  if (!s || !canvas) return

  const src = pipeline.sourceImageData.value
  canvas.width = s.yWidth
  canvas.height = s.yHeight
  const ctx = canvas.getContext('2d')!

  if (showOriginal.value && src) {
    ctx.putImageData(src, 0, 0)
    return
  }

  const img = ctx.createImageData(s.yWidth, s.yHeight)
  // Nearest-neighbour upsample, which is what makes the colour fringing visible.
  for (let row = 0; row < s.yHeight; row++) {
    const cRow = Math.min(Math.floor((row * s.chromaHeight) / s.yHeight), s.chromaHeight - 1)
    for (let col = 0; col < s.yWidth; col++) {
      const cCol = Math.min(Math.floor((col * s.chromaWidth) / s.yWidth), s.chromaWidth - 1)
      const [r, g, b] = ycbcrToRgb(
        s.y[row * s.yWidth + col],
        s.cb[cRow * s.chromaWidth + cCol],
        s.cr[cRow * s.chromaWidth + cCol],
      )
      const off = (row * s.yWidth + col) * 4
      img.data[off] = r
      img.data[off + 1] = g
      img.data[off + 2] = b
      img.data[off + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function draw() {
  drawPlanes()
  drawCompare()
}

watch([sub, showOriginal], () => nextTick(draw))
onMounted(draw)

const PLANE_META: { key: YcbcrChannel; label: string }[] = [
  { key: 'y', label: 'Y' },
  { key: 'cb', label: 'Cb' },
  { key: 'cr', label: 'Cr' },
]

function kb(samples: number) {
  return (samples / 1024).toFixed(0) + ' KB'
}
</script>

<template>
  <SlideLayout>
    <div class="sub-slide">
      <div class="left">
        <h3>The three planes, drawn to scale</h3>
        <div class="planes">
          <div
            v-for="meta in PLANE_META" :key="meta.key"
            class="plane"
            :style="{ width: (meta.key === 'y' ? 1 : (sizes?.scale ?? 1)) * 9 + 'rem' }"
          >
            <span class="label">{{ meta.label }}</span>
            <canvas :ref="el => setCanvas(meta.key, el)" v-loupe />
            <span class="size">{{ kb(meta.key === 'y' ? (sizes?.luma ?? 0) : (sizes?.chroma ?? 0)) }}</span>
          </div>
        </div>

        <div class="tally">
          <span class="mode">{{ mode }}</span>
          <span class="arrow">{{ kb(sizes?.before ?? 0) }} → {{ kb(sizes?.total ?? 0) }}</span>
          <span class="saved" :class="{ none: savedPercent === 0 }">
            {{ savedPercent === 0 ? 'nothing discarded' : `−${savedPercent.toFixed(0)}%` }}
          </span>
        </div>
      </div>

      <div class="right">
        <div class="ab">
          <button :class="{ active: !showOriginal }" @click="showOriginal = false">As stored</button>
          <button :class="{ active: showOriginal }" @click="showOriginal = true">Original</button>
        </div>
        <canvas ref="compareCanvas" class="compare" v-loupe />
        <p class="caption">flick between them — and use the loupe on an edge where colour changes</p>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Two of the three planes are stored at a fraction of the resolution, and the third is left
          alone. At 4:2:0 that is exactly half the data, on
          <em>every image, every time</em> — no measuring, no adapting, no bet on the content. It
          works for one reason only: the plane holding the detail your eye is good at was the one we
          kept. Point the same trick at Y instead and the picture falls apart.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.sub-slide {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 1rem 2rem;
  width: 100%;
  height: 100%;
  align-items: center;
}

.left, .right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-height: 0;
}

h3 {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Bottom-aligned: the chroma planes shrink downwards from a common top edge, which
   reads as "these got smaller" rather than "these floated". */
.planes {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
}

.plane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  transition: width 0.3s ease;
}

.plane canvas {
  width: 100%;
  border-radius: 3px;
  image-rendering: pixelated;
}

.label {
  font-size: 0.62rem;
  font-weight: 700;
}

.size {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.tally {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.mode {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
}

.arrow {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.saved {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--positive);
}

.saved.none {
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--text-secondary);
}

.ab {
  display: flex;
  gap: 0.25rem;
}

.ab button {
  padding: 0.2rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.compare {
  max-width: 100%;
  max-height: 42vh;
  border-radius: 4px;
}

.caption {
  font-size: 0.62rem;
  font-style: italic;
  color: var(--text-secondary);
}

/* The grid item is Fragment's own root element, not the paragraph inside it, so the
   span has to be set on the child component rather than on .verdict. */
.sub-slide > :deep(.fragment) {
  grid-column: 1 / -1;
}

.verdict {
  font-size: 0.68rem;
  line-height: 1.45;
  max-width: 54rem;
  margin: 0 auto;
  text-align: center;
  color: var(--text-secondary);
}
</style>
