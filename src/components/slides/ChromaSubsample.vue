<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ycbcrPlaneToImageData, ycbcrToRgb, type YcbcrChannel } from '../../engine/jpeg/colorspace'
import { useStat } from '../../stats/useStats'
import { ratioVerdict } from '../../rendering/stamp'

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

/**
 * The width the two chroma planes are scaled to, as a percentage of the luma plane —
 * the same fraction on both axes. 100 keeps every colour sample (4:4:4); 50 is the
 * 4:2:0 the pipeline ships; the slider runs all the way to 0, far past anything a real
 * codec would dare, so the room can drag the colour apart by hand while the luma plane
 * never moves.
 */
const percent = ref(100)

/**
 * The luma plane gets the same treatment on its own slider — and that is the point of the
 * slide made touchable: dropping colour detail is nearly invisible, dropping luma detail
 * wrecks the picture, because Y is the plane the eye actually reads.
 */
const lumaPercent = ref(100)

/** Area-average `src` down to a `cw`×`ch` grid; handles any target size, not just halves. */
function resample(src: Float64Array, width: number, height: number, cw: number, ch: number): Float64Array {
  const out = new Float64Array(cw * ch)
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
      out[row * cw + col] = sum / n
    }
  }
  return out
}

/** Each plane scaled to its own slider in both axes; the full frame stays the target size. */
const local = computed(() => {
  const yc = pipeline.ycbcr.value
  if (!yc) return null
  const { y, cb, cr, width, height } = yc

  const down = (p: number) => ({
    w: Math.min(width, Math.max(1, Math.round((width * p) / 100))),
    h: Math.min(height, Math.max(1, Math.round((height * p) / 100))),
  })
  const l = down(lumaPercent.value)
  const c = down(percent.value)

  return {
    y: l.w === width && l.h === height ? y : resample(y, width, height, l.w, l.h),
    cb: c.w === width && c.h === height ? cb : resample(cb, width, height, c.w, c.h),
    cr: c.w === width && c.h === height ? cr : resample(cr, width, height, c.w, c.h),
    yWidth: width,
    yHeight: height,
    lumaWidth: l.w,
    lumaHeight: l.h,
    chromaWidth: c.w,
    chromaHeight: c.h,
  }
})

/** Source aspect, so a plane box and the reconstruction share one shape and one size. */
const aspect = computed(() => {
  const yc = pipeline.ycbcr.value
  return yc ? yc.width / yc.height : 1
})

const sizes = computed(() => {
  const s = local.value
  if (!s) return null
  const luma = s.lumaWidth * s.lumaHeight
  const chroma = s.chromaWidth * s.chromaHeight
  const full = s.yWidth * s.yHeight
  return {
    luma,
    chroma,
    total: luma + 2 * chroma,
    before: full * 3,
    /** Each plane's width as a share of the full frame, for drawing it to scale. */
    lumaScale: s.lumaWidth / s.yWidth,
    chromaScale: s.chromaWidth / s.yWidth,
  }
})

/** Byte ratio as a verdict, worded once in `ratioVerdict` like every other slide. */
const verdict = computed(() => {
  const z = sizes.value
  return z ? ratioVerdict(z.before / z.total) : null
})

useStat('chroma-subsample', () => {
  const z = sizes.value
  if (!z) return null
  const lossy = percent.value < 100 || lumaPercent.value < 100
  return {
    label: `Subsampling · luma ${lumaPercent.value}% · chroma ${percent.value}%`,
    rawBits: z.before * 8,
    encodedBits: z.total * 8,
    overheadBits: 0,
    lossy,
    note: lossy ? 'the same ratio on every image' : 'nothing discarded',
  }
})

function drawPlanes() {
  const s = local.value
  if (!s) return
  const dims: Record<YcbcrChannel, [number, number]> = {
    y: [s.lumaWidth, s.lumaHeight],
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
  const s = local.value
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
  // Nearest-neighbour upsample of every plane, sampled at the output pixel's centre so the
  // reduced grid stays aligned with the full one — otherwise the picture jumps by a pixel
  // the moment a plane first drops below full resolution.
  for (let row = 0; row < s.yHeight; row++) {
    const lRow = Math.min(Math.floor(((row + 0.5) * s.lumaHeight) / s.yHeight), s.lumaHeight - 1)
    const cRow = Math.min(Math.floor(((row + 0.5) * s.chromaHeight) / s.yHeight), s.chromaHeight - 1)
    for (let col = 0; col < s.yWidth; col++) {
      const lCol = Math.min(Math.floor(((col + 0.5) * s.lumaWidth) / s.yWidth), s.lumaWidth - 1)
      const cCol = Math.min(Math.floor(((col + 0.5) * s.chromaWidth) / s.yWidth), s.chromaWidth - 1)
      const [r, g, b] = ycbcrToRgb(
        s.y[lRow * s.lumaWidth + lCol],
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

watch([local, showOriginal], () => nextTick(draw))

/**
 * The reconstruction is shown 1:1 at its native pixel size (512 for the sample images);
 * whatever width is left over goes to the three source planes, which shrink to fit. The
 * compare is only ever capped so it and its buttons cannot overflow the stage height.
 */
const stage = ref<HTMLElement>()
const compareSize = ref(320)
const planeImg = ref(140)
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
  const yc = pipeline.ycbcr.value
  const nativeW = yc ? yc.width : 512
  const arW = yc ? yc.width / yc.height : 1

  const buttonsReserve = 2.6 * rem
  compareSize.value = Math.max(120, Math.floor(Math.min(nativeW, (H - buttonsReserve) * arW)))

  const colGap = 1.4 * rem
  const groupGap = 1.2 * rem
  const pairGap = 0.6 * rem
  const leftW = W - compareSize.value - colGap
  const byWidth = (leftW - groupGap - pairGap) / 3
  eyeMax.value = Math.round(leftW + 0.4 * rem)

  // Reserve room for the sliders, labels, tally and the verdict — whose height grows as the
  // column narrows — then let the planes fill whatever is left, so they get large when the
  // screen is roomy and shrink only when it is genuinely tight. Estimated, not measured, so
  // the size is decided in one synchronous pass with no layout race.
  // Reserve room for the retina aside; the planes take the rest. With the verdict gone there
  // is space for a generous panel while the planes still fill their width.
  // Reserve room for the aside at the bottom (top-aligned content needs only its own
  // height cleared), and a column wide enough to hold it clear of the image.
  const eyeReserve = 5.5 * rem
  const byHeightWithEye = (H - 7 * rem - eyeReserve) * arW
  showEye.value = byHeightWithEye > 2 * rem && leftW > 13.5 * rem
  const byHeight = showEye.value ? byHeightWithEye : (H - 7 * rem) * arW

  planeImg.value = Math.max(48, Math.floor(Math.min(byWidth, byHeight, 14 * rem)))
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
watch(() => pipeline.ycbcr.value, () => nextTick(recompute))

const CHROMA_META: { key: YcbcrChannel; label: string }[] = [
  { key: 'cb', label: 'Cb' },
  { key: 'cr', label: 'Cr' },
]

function kb(samples: number) {
  return (samples / 1024).toFixed(0) + ' KB'
}
</script>

<template>
  <SlideLayout>
    <div class="stage" ref="stage" :style="{ '--ar': aspect, '--pimg': planeImg + 'px', '--cimg': compareSize + 'px', '--eyemax': eyeMax + 'px' }">
      <div class="left">
        <div class="planes">
          <!-- Luma on its own slider, so the room can watch dropping it wreck the picture. -->
          <div class="group luma">
            <div class="plane">
              <span class="label">Y</span>
              <div class="slot">
                <canvas
                  :ref="el => setCanvas('y', el)"
                  v-loupe
                  :style="{ width: (sizes?.lumaScale ?? 1) * 100 + '%' }"
                />
              </div>
              <span class="size">{{ kb(sizes?.luma ?? 0) }}</span>
            </div>
            <div class="knob">
              <div class="knob-head">
                <span class="knob-label">Luma</span>
                <span class="knob-value">{{ lumaPercent }}%</span>
              </div>
              <input type="range" :min="0" :max="100" step="10" v-model.number="lumaPercent" />
            </div>
          </div>

          <!-- The two colour planes, together on one slider. -->
          <div class="group chroma">
            <div class="pair">
              <div class="plane" v-for="meta in CHROMA_META" :key="meta.key">
                <span class="label">{{ meta.label }}</span>
                <div class="slot">
                  <canvas
                    :ref="el => setCanvas(meta.key, el)"
                    v-loupe
                    :style="{ width: (sizes?.chromaScale ?? 1) * 100 + '%' }"
                  />
                </div>
                <span class="size">{{ kb(sizes?.chroma ?? 0) }}</span>
              </div>
            </div>
            <div class="knob">
              <div class="knob-head">
                <span class="knob-label">Colour</span>
                <span class="knob-value">{{ percent }}%</span>
              </div>
              <input type="range" :min="0" :max="100" step="10" v-model.number="percent" />
            </div>
          </div>
        </div>

      </div>

      <!-- The reconstruction, always shown 1:1 at native size, with the size verdict beside the
           A/B toggle so the three sit in one row under the image. -->
      <div class="right">
        <canvas ref="compareCanvas" class="compare" v-loupe />
        <div class="ab">
          <button :class="{ active: !showOriginal }" @click="showOriginal = false">Compressed</button>
          <button :class="{ active: showOriginal }" @click="showOriginal = true">Original</button>
          <span v-if="verdict" class="ratio-badge" :class="verdict.better ? 'smaller' : 'bigger'">{{ verdict.text }}</span>
        </div>
      </div>

      <!-- Why it works: the eye carries far more luma cells than colour ones. Pinned to the
           slide's bottom-left so it stays put rather than floating with the centred column. -->
      <aside v-if="showEye" class="eye-panel">
        <svg class="eye-ic" viewBox="0 0 48 30" aria-hidden="true">
          <path d="M1.5 15 Q24 1 46.5 15 Q24 29 1.5 15 Z" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle cx="24" cy="15" r="7.5" fill="var(--accent)" opacity="0.45" />
          <circle cx="24" cy="15" r="3.2" fill="currentColor" />
        </svg>
        <div class="cells">
          <div class="cell-row">
            <span class="dots rods"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
            <span class="cell-text"><b>~120M</b> rods · luma</span>
          </div>
          <div class="cell-row">
            <span class="dots cones"><i class="r" /><i class="g" /><i class="b" /></span>
            <span class="cell-text"><b>~6M</b> cones · colour</span>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

/* Pinned to the plane width so a wide slider label can never stretch the group and push
   the row off the column. */
.group.luma {
  width: var(--pimg);
}

.group.chroma {
  width: calc(2 * var(--pimg) + 0.6rem);
}

.pair {
  display: flex;
  gap: 0.6rem;
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
  align-items: center;
  gap: 0.4rem;
}

.ab button {
  padding: 0.25rem 0.7rem;
  font-size: 0.78rem;
  border-radius: 4px;
}

/* A third peer beside the two toggle buttons: same footprint, the verdict's own colour. */
.ratio-badge {
  padding: 0.25rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  border-radius: 4px;
  border: 2px solid var(--positive);
  color: var(--positive);
  font-variant-numeric: tabular-nums;
}

.ratio-badge.bigger {
  border-color: var(--warning);
  color: var(--warning);
}

/* A supporting aside pinned to the slide's bottom-left: why colour is the plane to spend —
   the retina has far more luma cells than colour ones. */
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
  gap: 0.7em;
}

.cell-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75em;
}

.dots {
  display: inline-flex;
  align-items: center;
  gap: 0.16em;
  width: 4em;
  flex: none;
}

.dots i {
  width: 0.3em;
  height: 0.3em;
  border-radius: 50%;
  background: var(--text-secondary);
  flex: none;
}

.dots.cones {
  gap: 0.28em;
}

.dots.cones i {
  width: 0.46em;
  height: 0.46em;
}

.dots.cones i.r { background: #e06666; }
.dots.cones i.g { background: #6abf6a; }
.dots.cones i.b { background: #6699e6; }

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
