<script setup lang="ts">
import { inject, reactive, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { splitPlanes, planeToImageData, type PlaneChannel } from '../../engine/codecs/planes'
import { useStat } from '../../stats/useStats'

/**
 * The colour act opens by trying the obvious thing and watching it fail.
 *
 * The picture is split into red, green and blue, and each plane gets its own resolution
 * slider — three knobs instead of the two the next slide has. The reconstruction is built
 * straight back out of the three planes, so dragging any one of them down shows exactly
 * what that channel was carrying. And the answer is: all three carry the picture. Drop
 * red or green and the brightness itself goes blocky, because every RGB plane is part
 * luminance. Blue survives the most abuse — the retina barely resolves it — but there is
 * no plane here you can spend freely, which is the whole reason the next slide changes
 * the axes first.
 *
 * The eye aside states why blue is the cheap one: of the three cone types the eye is built
 * almost entirely from the two that read red and green, and holds only a sliver that reads
 * blue.
 */

const pipeline = inject(PIPELINE_KEY)!

const showOriginal = ref(false)

type PlaneKey = PlaneChannel

const canvases: Partial<Record<PlaneKey, HTMLCanvasElement>> = {}
function setCanvas(key: PlaneKey, el: unknown) {
  canvases[key] = (el as HTMLCanvasElement) ?? undefined
}
const compareCanvas = ref<HTMLCanvasElement>()

/**
 * The width each plane is scaled to, as a percentage of the full frame — the same
 * fraction on both axes. 100 keeps every sample; the sliders run all the way to 0, far
 * past anything a real codec would try, so the room can pull each channel apart by hand.
 */
const percent = reactive<Record<PlaneKey, number>>({ r: 100, g: 100, b: 100 })

const planes = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? splitPlanes(src) : null
})

/** Area-average `src` down to a `cw`×`ch` grid; handles any target size, not just halves. */
function resample(src: Uint8Array, width: number, height: number, cw: number, ch: number): Uint8Array {
  const out = new Uint8Array(cw * ch)
  for (let row = 0; row < ch; row++) {
    const sr0 = Math.floor((row * height) / ch)
    const sr1 = Math.max(sr0 + 1, Math.floor(((row + 1) * height) / ch))
    for (let col = 0; col < cw; col++) {
      const sc0 = Math.floor((col * width) / cw)
      const sc1 = Math.max(sc0 + 1, Math.floor(((col + 1) * width) / cw))
      let sum = 0, n = 0
      for (let sr = sr0; sr < sr1 && sr < height; sr++) {
        const base = sr * width
        for (let sc = sc0; sc < sc1 && sc < width; sc++) {
          sum += src[base + sc]
          n++
        }
      }
      out[row * cw + col] = Math.round(sum / n)
    }
  }
  return out
}

/** Each plane scaled to its own slider in both axes; the full frame stays the source size. */
const local = computed(() => {
  const p = planes.value
  if (!p) return null
  const { width, height } = p

  const down = (pct: number) => ({
    w: Math.min(width, Math.max(1, Math.round((width * pct) / 100))),
    h: Math.min(height, Math.max(1, Math.round((height * pct) / 100))),
  })
  const d: Record<PlaneKey, { w: number; h: number }> = {
    r: down(percent.r),
    g: down(percent.g),
    b: down(percent.b),
  }
  const scaled = (key: PlaneKey) =>
    d[key].w === width && d[key].h === height
      ? p[key]
      : resample(p[key], width, height, d[key].w, d[key].h)

  return {
    r: scaled('r'),
    g: scaled('g'),
    b: scaled('b'),
    width,
    height,
    dims: {
      r: [d.r.w, d.r.h],
      g: [d.g.w, d.g.h],
      b: [d.b.w, d.b.h],
    } as Record<PlaneKey, [number, number]>,
  }
})

/** Source aspect, so a plane box and the reconstruction share one shape and one size. */
const aspect = computed(() => {
  const p = planes.value
  return p ? p.width / p.height : 1
})

const sizes = computed(() => {
  const s = local.value
  if (!s) return null
  const area = (k: PlaneKey) => s.dims[k][0] * s.dims[k][1]
  const full = s.width * s.height
  const bytes: Record<PlaneKey, number> = { r: area('r'), g: area('g'), b: area('b') }
  return {
    bytes,
    total: bytes.r + bytes.g + bytes.b,
    before: full * 3,
    /** Each plane's width as a share of the full frame, for drawing it to scale. */
    scale: {
      r: s.dims.r[0] / s.width,
      g: s.dims.g[0] / s.width,
      b: s.dims.b[0] / s.width,
    } as Record<PlaneKey, number>,
  }
})

const savedPercent = computed(() => {
  const s = sizes.value
  return s ? (1 - s.total / s.before) * 100 : 0
})

useStat('rgb-subsample', () => {
  const z = sizes.value
  if (!z) return null
  const lossy = percent.r < 100 || percent.g < 100 || percent.b < 100
  return {
    label: `RGB subsample · R ${percent.r}% · G ${percent.g}% · B ${percent.b}%`,
    rawBits: z.before * 8,
    encodedBits: z.total * 8,
    overheadBits: 0,
    lossy,
    note: lossy ? 'detail dropped from planes your eye reads' : 'nothing discarded',
  }
})

function drawPlanes() {
  const s = local.value
  if (!s) return
  for (const key of ['r', 'g', 'b'] as const) {
    const canvas = canvases[key]
    if (!canvas) continue
    const [w, h] = s.dims[key]
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.putImageData(planeToImageData(s[key], w, h, key), 0, 0)
  }
}

function drawCompare() {
  const s = local.value
  const canvas = compareCanvas.value
  if (!s || !canvas) return

  const src = pipeline.sourceImageData.value
  canvas.width = s.width
  canvas.height = s.height
  const ctx = canvas.getContext('2d')!

  if (showOriginal.value && src) {
    ctx.putImageData(src, 0, 0)
    return
  }

  const img = ctx.createImageData(s.width, s.height)
  const [rw, rh] = s.dims.r
  const [gw, gh] = s.dims.g
  const [bw, bh] = s.dims.b
  // Nearest-neighbour upsample of every plane, sampled at the output pixel's centre so a
  // reduced grid stays aligned with the full one — otherwise the picture jumps by a pixel
  // the moment a plane first drops below full resolution.
  for (let row = 0; row < s.height; row++) {
    const rRow = Math.min(Math.floor(((row + 0.5) * rh) / s.height), rh - 1)
    const gRow = Math.min(Math.floor(((row + 0.5) * gh) / s.height), gh - 1)
    const bRow = Math.min(Math.floor(((row + 0.5) * bh) / s.height), bh - 1)
    for (let col = 0; col < s.width; col++) {
      const rCol = Math.min(Math.floor(((col + 0.5) * rw) / s.width), rw - 1)
      const gCol = Math.min(Math.floor(((col + 0.5) * gw) / s.width), gw - 1)
      const bCol = Math.min(Math.floor(((col + 0.5) * bw) / s.width), bw - 1)
      const off = (row * s.width + col) * 4
      img.data[off] = s.r[rRow * rw + rCol]
      img.data[off + 1] = s.g[gRow * gw + gCol]
      img.data[off + 2] = s.b[bRow * bw + bCol]
      img.data[off + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function draw() {
  drawPlanes()
  drawCompare()
}

watch([local, showOriginal], () => nextTick(draw))

/**
 * The reconstruction is shown 1:1 at its native pixel size; whatever width is left over
 * goes to the three source planes, which shrink to fit.
 */
const stage = ref<HTMLElement>()
const compareSize = ref(320)
const planeImg = ref(120)
/** Only float the retina aside in when the column leaves real room below its content. */
const showEye = ref(false)
/** Widest the aside may be before it would reach the reconstruction. */
const eyeMax = ref(360)

function recompute() {
  const el = stage.value
  if (!el) return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 28
  const H = el.clientHeight
  const W = el.clientWidth
  const src = pipeline.sourceImageData.value
  const nativeW = src ? src.width : 512
  const arW = src ? src.width / src.height : 1

  const buttonsReserve = 2.6 * rem
  compareSize.value = Math.max(120, Math.floor(Math.min(nativeW, (H - buttonsReserve) * arW)))

  const colGap = 1.4 * rem
  const planesGap = 1.2 * rem
  const leftW = W - compareSize.value - colGap
  const byWidth = (leftW - 2 * planesGap) / 3
  eyeMax.value = Math.round(leftW + 0.4 * rem)

  // Reserve room for the aside at the bottom (top-aligned content needs only its own
  // height cleared), and a column wide enough to hold it clear of the image; the three
  // planes take whatever is left.
  const eyeReserve = 6.8 * rem
  const byHeightWithEye = (H - 7 * rem - eyeReserve) * arW
  showEye.value = byHeightWithEye > 2 * rem && leftW > 13.5 * rem
  const byHeight = showEye.value ? byHeightWithEye : (H - 7 * rem) * arW

  planeImg.value = Math.max(40, Math.floor(Math.min(byWidth, byHeight, 12 * rem)))
}

let ro: ResizeObserver | null = null
onMounted(() => {
  draw()
  recompute()
  ro = new ResizeObserver(() => recompute())
  if (stage.value) ro.observe(stage.value)
  window.addEventListener('resize', recompute)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('resize', recompute)
})
watch(() => pipeline.sourceImageData.value, () => nextTick(recompute))

const PLANE_META: { key: PlaneKey; label: string; color: string }[] = [
  { key: 'r', label: 'Red', color: 'var(--negative)' },
  { key: 'g', label: 'Green', color: 'var(--positive)' },
  { key: 'b', label: 'Blue', color: 'var(--accent)' },
]

function kb(samples: number) {
  return (samples / 1024).toFixed(0) + ' KB'
}
</script>

<template>
  <SlideLayout>
    <div class="stage" ref="stage" :style="{ '--ar': aspect, '--pimg': planeImg + 'px', '--cimg': compareSize + 'px', '--eyemax': eyeMax + 'px' }">
      <div class="left">
        <!-- One plane, one slider — three of them, because RGB gives no plane to spare. -->
        <div class="planes">
          <div class="group" v-for="meta in PLANE_META" :key="meta.key">
            <div class="plane">
              <span class="label" :style="{ color: meta.color }">{{ meta.label }}</span>
              <div class="slot">
                <canvas
                  :ref="el => setCanvas(meta.key, el)"
                  v-loupe
                  :style="{ width: (sizes?.scale[meta.key] ?? 1) * 100 + '%' }"
                />
              </div>
              <span class="size">{{ kb(sizes?.bytes[meta.key] ?? 0) }}</span>
            </div>
            <div class="knob">
              <div class="knob-head">
                <span class="knob-label">{{ meta.label }}</span>
                <span class="knob-value">{{ percent[meta.key] }}%</span>
              </div>
              <input type="range" :min="0" :max="100" step="10" v-model.number="percent[meta.key]" />
            </div>
          </div>
        </div>

        <div class="tally">
          <span class="arrow">{{ kb(sizes?.before ?? 0) }} → {{ kb(sizes?.total ?? 0) }}</span>
          <span class="saved" :class="{ none: savedPercent === 0 }">
            {{ savedPercent === 0 ? 'nothing discarded' : `−${savedPercent.toFixed(0)}%` }}
          </span>
        </div>
      </div>

      <!-- The reconstruction, always shown 1:1 at native size. -->
      <div class="right">
        <canvas ref="compareCanvas" class="compare" v-loupe />
        <div class="ab">
          <button :class="{ active: !showOriginal }" @click="showOriginal = false">Compressed</button>
          <button :class="{ active: showOriginal }" @click="showOriginal = true">Original</button>
        </div>
      </div>

      <!-- What each plane contributes to perceived brightness — the eye's own weighting, and
           the very weights the luma transform is built from two slides later: green carries
           most, blue least. Pinned to the slide's bottom-left so it stays put rather than
           floating with the centred column. -->
      <aside v-if="showEye" class="eye-panel">
        <svg class="eye-ic" viewBox="0 0 48 30" aria-hidden="true">
          <path d="M1.5 15 Q24 1 46.5 15 Q24 29 1.5 15 Z" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle cx="24" cy="15" r="7.5" fill="var(--accent)" opacity="0.45" />
          <circle cx="24" cy="15" r="3.2" fill="currentColor" />
        </svg>
        <div class="cells">
          <div class="cell-cap">Share of perceived brightness</div>
          <div class="cell-row">
            <span class="bar"><span class="fill green" style="width: 59%" /></span>
            <span class="cell-text"><b>~59%</b> green</span>
          </div>
          <div class="cell-row">
            <span class="bar"><span class="fill red" style="width: 30%" /></span>
            <span class="cell-text"><b>~30%</b> red</span>
          </div>
          <div class="cell-row">
            <span class="bar"><span class="fill blue" style="width: 11%" /></span>
            <span class="cell-text"><b>~11%</b> blue</span>
          </div>
        </div>
      </aside>
    </div>
  </SlideLayout>
</template>

<style scoped>
.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.4rem;
  width: 100%;
  height: 100%;
  position: relative;
}

.left {
  flex: 1 1 0;
  min-width: 0;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
}

.right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.planes {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 1.2rem;
}

.group {
  /* Pinned to the plane width so a wide slider label can never stretch the group and push
     the row off the column. */
  width: var(--pimg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

.plane {
  width: var(--pimg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

/* Fixed box the canvas shrinks within, top-anchored so every plane keeps a common top
   edge and nothing around it moves as a slider runs. */
.slot {
  width: 100%;
  aspect-ratio: var(--ar, 1);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.slot canvas {
  border-radius: 3px;
  image-rendering: pixelated;
}

/* The reconstruction is shown 1:1 at native size; smooth resampling reads better here. */
.compare {
  width: var(--cimg);
  height: auto;
  border-radius: 4px;
  image-rendering: auto;
}

.label {
  font-size: 0.95rem;
  font-weight: 700;
}

.size {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.knob {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.knob-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.3rem;
  min-width: 0;
}

.knob-label {
  font-size: 0.75rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knob-value {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.knob input[type="range"] {
  width: 100%;
}

.ab {
  display: flex;
  gap: 0.4rem;
}

.ab button {
  padding: 0.25rem 0.7rem;
  font-size: 0.78rem;
  border-radius: 4px;
}

.tally {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  /* Fixed so swapping "nothing discarded" for a −N% figure — different length and size —
     cannot change the row height and nudge the rest of the column. */
  height: 1.9rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.arrow {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.saved {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--positive);
}

.saved.none {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--text-secondary);
}

/* A supporting aside pinned to the slide's bottom-left: why blue is the plane to spend —
   the retina holds far fewer blue-reading cones than red- or green-reading ones. */
.eye-panel {
  position: absolute;
  /* Equal margins off the slide's left and bottom (the stage is inset asymmetrically by the
     slide-area padding, so the two offsets differ to land the same visual gap). */
  left: 0.3rem;
  bottom: 0.55rem;
  max-width: var(--eyemax);
  /* Scale the whole card with the width available up to the image — everything inside is in
     em — so it fills a roomy column (up to ~1.5x) and shrinks to fit a tight one. */
  font-size: clamp(0.66rem, calc(var(--eyemax) / 21), 1.05rem);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1em;
  padding: 1em 1.2em;
  border: 1px solid var(--border);
  border-radius: 0.55em;
  background: var(--bg-surface);
}

.eye-ic {
  width: 4em;
  height: auto;
  color: var(--text-secondary);
  flex: none;
}

.cells {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55em;
}

.cell-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75em;
}

.cell-cap {
  font-size: 0.82em;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  margin-bottom: 0.2em;
}

.bar {
  width: 5.4em;
  height: 0.5em;
  border-radius: 0.25em;
  background: var(--bg-elevated);
  overflow: hidden;
  flex: none;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 0.25em;
}

.fill.green { background: #6abf6a; }
.fill.red { background: #e06666; }
.fill.blue { background: #6699e6; }

.cell-text {
  font-size: 1em;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-text b {
  color: var(--text);
  font-weight: 700;
}
</style>
