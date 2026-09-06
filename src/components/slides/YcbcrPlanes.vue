<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { ycbcrPlaneToImageData, type YcbcrChannel } from '../../engine/jpeg/colorspace'
import { correlation, splitPlanes } from '../../engine/codecs/planes'

/**
 * The same three-up as the previous slide, on better axes.
 *
 * Deliberately laid out identically to `rgb-planes` so the only thing that changes
 * between the two slides is the content of the pictures — which is the argument.
 *
 * Two benefits, and they are not equally reliable, so the slide orders them accordingly.
 * *Concentration* — Y ends up holding the picture and the chroma planes hold washes of
 * tint — happens on every image, and it is what the subsampling slide depends on.
 * *Decorrelation* is the textbook claim, and measuring it across the sample set showed it
 * is very image-dependent: Forest falls 0.96 to 0.60 and Line art 1.00 to 0.00, but the
 * default peppers photograph only moves 0.31 to 0.29, because a saturated close-up never
 * had strongly-alike RGB planes to begin with. So the correlation verdict is generated
 * from the two measurements rather than written as a promise the picture may not keep.
 *
 * The chroma planes are rendered *in colour*, and that is not decoration. Drawn in
 * greyscale, Cb and Cr look like two noisy duplicates of the photo and the slide teaches
 * nothing; drawn along the axis each one actually encodes, Cb is visibly a
 * yellow-to-blue map and Cr a cyan-to-red one, and it becomes obvious by looking that Y
 * is carrying the picture while the other two carry tint. The greyscale toggle is kept so
 * the presenter can show exactly that comparison.
 */

const pipeline = inject(PIPELINE_KEY)!

const coloured = ref(true)

const canvases: Partial<Record<YcbcrChannel, HTMLCanvasElement>> = {}
function setCanvas(key: YcbcrChannel, el: unknown) {
  canvases[key] = (el as HTMLCanvasElement) ?? undefined
}

const ycbcr = computed(() => pipeline.ycbcr.value)

/** The same measurement the previous slide ended on, for the direct comparison. */
const correlations = computed(() => {
  const c = ycbcr.value
  if (!c) return null
  return {
    ycb: correlation(c.y, c.cb),
    ycr: correlation(c.y, c.cr),
    cbcr: correlation(c.cb, c.cr),
  }
})

const meanCorrelation = computed(() => {
  const c = correlations.value
  return c ? (Math.abs(c.ycb) + Math.abs(c.ycr) + Math.abs(c.cbcr)) / 3 : 0
})

/**
 * The previous slide's number, recomputed here rather than quoted from memory.
 * How far the correlation actually falls depends a lot on the picture — a saturated
 * photograph keeps more of it than a muted one — so the before-and-after has to be
 * measured on whatever is loaded, not written into the sentence.
 */
const rgbCorrelation = computed(() => {
  const src = pipeline.sourceImageData.value
  if (!src) return 0
  const p = splitPlanes(src)
  return (Math.abs(correlation(p.r, p.g)) +
    Math.abs(correlation(p.g, p.b)) +
    Math.abs(correlation(p.r, p.b))) / 3
})

/** Every plane is still full size — this step saves nothing, and should say so. */
const planeBytes = computed(() => {
  const c = ycbcr.value
  return c ? c.width * c.height : 0
})

function draw() {
  const c = ycbcr.value
  if (!c) return
  for (const key of ['y', 'cb', 'cr'] as const) {
    const canvas = canvases[key]
    if (!canvas) continue
    canvas.width = c.width
    canvas.height = c.height
    canvas.getContext('2d')!.putImageData(
      ycbcrPlaneToImageData(c[key], c.width, c.height, key, coloured.value), 0, 0)
  }
}

watch([ycbcr, coloured], () => nextTick(draw))
onMounted(draw)

const PLANE_META: { key: YcbcrChannel; label: string; sub: string; color: string }[] = [
  { key: 'y', label: 'Y', sub: 'brightness', color: 'var(--text)' },
  { key: 'cb', label: 'Cb', sub: 'blue ↔ yellow', color: 'var(--accent)' },
  { key: 'cr', label: 'Cr', sub: 'red ↔ cyan', color: 'var(--negative)' },
]

function kb(bytes: number) {
  return (bytes / 1024).toFixed(0) + ' KB'
}

/** What actually happened to the correlation on this image, in words. */
const decorrelation = computed(() => {
  const before = rgbCorrelation.value
  const after = meanCorrelation.value
  if (before > 0.55 && after < before - 0.15) return 'fell'
  if (after < before - 0.08) return 'fell-a-little'
  if (after > before + 0.05) return 'rose'
  return 'flat'
})
</script>

<template>
  <SlideLayout column>
    <div class="ycbcr-slide">
      <div class="view-toggle">
        <button :class="{ active: coloured }" @click="coloured = true">Colour</button>
        <button :class="{ active: !coloured }" @click="coloured = false">Greyscale</button>
        <span class="hint">the chroma planes are the same data either way</span>
      </div>

      <div class="planes">
        <div v-for="meta in PLANE_META" :key="meta.key" class="plane">
          <h3 :style="{ color: meta.color }">{{ meta.label }} <span class="sub">{{ meta.sub }}</span></h3>
          <canvas :ref="el => setCanvas(meta.key, el)" v-loupe />
          <span class="size">{{ kb(planeBytes) }}</span>
        </div>
      </div>

      <div class="corr">
        <span class="k">How alike the planes are now</span>
        <span class="pairs">
          <span>Y·Cb <b>{{ correlations?.ycb.toFixed(2) }}</b></span>
          <span>Y·Cr <b>{{ correlations?.ycr.toFixed(2) }}</b></span>
          <span>Cb·Cr <b>{{ correlations?.cbcr.toFixed(2) }}</b></span>
        </span>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Three planes again, the same size again — <strong>this step saves nothing at all</strong>,
          and it is exactly invertible, so nothing was given up either. What it buys shows in the
          box above: as R, G and B those planes were alike at
          <strong>{{ rgbCorrelation.toFixed(2) }}</strong>, and on these axes they are alike at
          <strong :class="decorrelation === 'fell' ? 'good' : ''">{{ meanCorrelation.toFixed(2) }}</strong>.
          <template v-if="decorrelation === 'fell'">
            Most of the duplication between the planes is simply gone.
          </template>
          <template v-else-if="decorrelation === 'fell-a-little'">
            Some of the duplication is gone — less than usual, because this image did not have
            much to begin with.
          </template>
          <template v-else>
            Barely moved, on this picture: its colour planes were already fairly independent, so
            there was little duplication to remove. Try <strong>Forest</strong>, where the same
            rotation takes 0.96 down to 0.60.
          </template>
        </p>
        <p class="verdict punch">
          The reliable win, though, is the other one — and it happens whatever the picture.
          <strong>Y is the photograph.</strong>
          Cb and Cr are vague washes of colour with the detail nowhere to be seen — yet all three
          hold precisely the same number of bytes. That mismatch, between how much data a plane
          holds and how much of the picture you read out of it, is the opening the next slide
          walks through.
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.ycbcr-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.view-toggle {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.view-toggle button {
  padding: 0.2rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.hint {
  margin-left: 0.4rem;
  font-size: 0.62rem;
  font-style: italic;
  color: var(--text-secondary);
}

.planes {
  display: flex;
  gap: 1.2rem;
  min-height: 0;
  flex-shrink: 1;
}

.plane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-height: 0;
}

.plane h3 {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sub {
  font-size: 0.62rem;
  font-weight: 400;
  color: var(--text-secondary);
  letter-spacing: 0;
}

.plane canvas {
  max-width: 100%;
  /* Three planes plus a readout plus two paragraphs of learner prose: the canvases are
     what has to give, or the correlation box lands on top of them. */
  max-height: 26vh;
  border-radius: 4px;
}

/* Identical on every plane, which is the setup for the subsampling slide. */
.size {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.corr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--positive);
  border-radius: 8px;
}

.k {
  font-size: 0.62rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pairs {
  display: flex;
  gap: 0.7rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pairs b {
  color: var(--positive);
  font-size: 0.72rem;
}

.verdict {
  font-size: 0.68rem;
  line-height: 1.45;
  max-width: 50rem;
  text-align: center;
  color: var(--text-secondary);
}

.verdict .good {
  color: var(--positive);
}

.verdict.punch {
  margin-top: 0.4rem;
}

</style>
