<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { splitPlanes, planeToImageData, interleavedBytes, correlation } from '../../engine/codecs/planes'
import { countRuns } from '../../engine/codecs/rle'
import { useStat } from '../../stats/useStats'

/**
 * The colour act opens by pulling the image apart, because everything that follows is
 * done to one plane and not the others.
 *
 * Two things to land here, in this order. Splitting into planes is free — the same bytes
 * in a different order — and it already compresses better, which is the reframing thesis
 * with nothing else going on. And then the problem: the three planes look alike, which is
 * duplication no run-length coder can reach, because it is a relationship between planes
 * rather than along one. That is what the next slide is for.
 *
 * How alike they are is measured, not assumed, and the wording follows the number.
 * Across the sample set it ranges from 0.96 on Forest to 0.03 on Mosaic, and the default
 * peppers photograph is a low case at about 0.31 — a saturated close-up genuinely does
 * have different reds and blues. A slide that says "the same information three times"
 * over that picture is just wrong, so it says something else instead.
 */

const pipeline = inject(PIPELINE_KEY)!

// Tinting each plane into its own channel, versus the literal intensity reading.
const tinted = ref(true)

type PlaneKey = 'r' | 'g' | 'b'

// Function refs rather than a ref-per-plane: inside v-for, Vue collects plain refs
// into arrays, which is not what is wanted here.
const canvases: Partial<Record<PlaneKey, HTMLCanvasElement>> = {}
function setCanvas(key: PlaneKey, el: unknown) {
  canvases[key] = (el as HTMLCanvasElement) ?? undefined
}

const planes = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? splitPlanes(src) : null
})

const planeRuns = computed(() => {
  const p = planes.value
  if (!p) return null
  return { r: countRuns(p.r), g: countRuns(p.g), b: countRuns(p.b) }
})

const totalRuns = computed(() => {
  const r = planeRuns.value
  return r ? r.r + r.g + r.b : 0
})

// The same bytes visited in pixel order, for the direct comparison.
const interleavedRuns = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? countRuns(interleavedBytes(src)) : 0
})

/** How much each plane duplicates the others — the redundancy this slide cannot reach. */
const correlations = computed(() => {
  const p = planes.value
  if (!p) return null
  return {
    rg: correlation(p.r, p.g),
    gb: correlation(p.g, p.b),
    rb: correlation(p.r, p.b),
  }
})

const meanCorrelation = computed(() => {
  const c = correlations.value
  return c ? (Math.abs(c.rg) + Math.abs(c.gb) + Math.abs(c.rb)) / 3 : 0
})

/**
 * How strong the "all three are the same picture" claim actually is here.
 *
 * It is usually very strong — Forest measures 0.96 — but a saturated close-up like the
 * default peppers photograph sits nearer 0.3, because its reds genuinely are not its
 * blues. Saying "the same information three times" over a picture where it is not true
 * would be the slide lying to the room, so it is graded off the measurement.
 */
const redundancy = computed(() =>
  meanCorrelation.value > 0.6 ? 'strong' : meanCorrelation.value > 0.35 ? 'partial' : 'weak')

const rawBits = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? src.width * src.height * 3 * 8 : 0
})
const encodedBits = computed(() => totalRuns.value * 16)
const improvement = computed(() =>
  interleavedRuns.value ? 1 - totalRuns.value / interleavedRuns.value : 0)

useStat('rgb-planes', () => {
  if (!planes.value) return null
  return {
    label: 'RLE · R/G/B planes',
    rawBits: rawBits.value,
    encodedBits: encodedBits.value,
    overheadBits: 0,
    // Reordering is exactly reversible — nothing is discarded here at all.
    lossy: false,
    note: 'same bytes, different order',
  }
})

function draw() {
  const p = planes.value
  if (!p) return
  for (const key of ['r', 'g', 'b'] as const) {
    const canvas = canvases[key]
    if (!canvas) continue
    canvas.width = p.width
    canvas.height = p.height
    canvas.getContext('2d')!.putImageData(
      planeToImageData(p[key], p.width, p.height, tinted.value ? key : undefined), 0, 0)
  }
}

watch([planes, tinted], () => nextTick(draw))
onMounted(draw)

const PLANE_META: { key: PlaneKey; label: string; color: string }[] = [
  { key: 'r', label: 'Red', color: 'var(--negative)' },
  { key: 'g', label: 'Green', color: 'var(--positive)' },
  { key: 'b', label: 'Blue', color: 'var(--accent)' },
]
</script>

<template>
  <SlideLayout column>
    <div class="planes-slide">
      <div class="view-toggle">
        <button :class="{ active: tinted }" @click="tinted = true">Colour</button>
        <button :class="{ active: !tinted }" @click="tinted = false">Greyscale</button>
      </div>

      <div class="planes">
        <div v-for="meta in PLANE_META" :key="meta.key" class="plane">
          <h3 :style="{ color: meta.color }">{{ meta.label }}</h3>
          <canvas :ref="el => setCanvas(meta.key, el)" v-loupe />
          <span class="runs">{{ (planeRuns?.[meta.key] ?? 0).toLocaleString() }} runs</span>
        </div>
      </div>

      <div class="readouts">
        <div class="compare">
          <div class="side">
            <span class="k">Interleaved R,G,B,R,G,B…</span>
            <span class="v">{{ interleavedRuns.toLocaleString() }} runs</span>
          </div>
          <div class="versus">vs</div>
          <div class="side win">
            <span class="k">Three separate planes</span>
            <span class="v">{{ totalRuns.toLocaleString() }} runs</span>
          </div>
        </div>

        <div class="corr">
          <span class="k">How alike the planes are</span>
          <span class="pairs">
            <span>R·G <b>{{ correlations?.rg.toFixed(2) }}</b></span>
            <span>G·B <b>{{ correlations?.gb.toFixed(2) }}</b></span>
            <span>R·B <b>{{ correlations?.rb.toFixed(2) }}</b></span>
          </span>
        </div>
      </div>

      <Fragment :index="1">
        <p class="verdict">
          Not one byte was discarded and not one bit of cleverness was added — the bytes were simply
          visited in a different order, and
          <strong :class="improvement > 0 ? 'good' : 'bad'">{{ improvement > 0
            ? Math.round(improvement * 100) + '% of the runs disappeared'
            : 'the runs did not improve on this image' }}</strong>.
          But look at the three pictures rather than the numbers: to a greater or lesser degree,
          they are all <em>the same picture</em> — bright where the photo is bright, dark where it
          is dark. The box says how alike they measure,
          <strong :class="redundancy === 'strong' ? 'warn' : ''">{{ meanCorrelation.toFixed(2) }}</strong>
          out of 1.
          <template v-if="redundancy === 'strong'">
            That is the same information written down three times, and no run-length coder can
            reach it — it is a relationship <em>between</em> the planes, not along any one of them.
          </template>
          <template v-else-if="redundancy === 'partial'">
            Some of that is duplication no run-length coder can reach, because it is a relationship
            <em>between</em> the planes rather than along any one of them.
          </template>
          <template v-else>
            Low, for once — a saturated close-up really does have different reds and blues. Try
            <strong>Forest</strong>, where the three planes measure 0.96 alike and the duplication
            is glaring. Either way it is a relationship <em>between</em> planes, which is exactly
            what a run-length coder cannot see.
          </template>
        </p>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.planes-slide {
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
}

.view-toggle button {
  padding: 0.2rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
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
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.plane canvas {
  max-width: 100%;
  /* Three planes, a two-box readout and a paragraph of learner prose all have to fit;
     the canvases are what gives, or the readout lands on top of the images. */
  max-height: 26vh;
  border-radius: 4px;
}

.runs {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.readouts {
  display: flex;
  align-items: stretch;
  gap: 1.2rem;
}

.compare {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.side.win {
  border-color: var(--positive);
}

.k {
  font-size: 0.62rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.v {
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.side.win .v {
  color: var(--positive);
}

.versus {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

/* The redundancy the whole act is about to attack. */
.corr {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--warning);
  border-radius: 8px;
}

.pairs {
  display: flex;
  gap: 0.7rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pairs b {
  color: var(--warning);
  font-size: 0.72rem;
}

.verdict {
  font-size: 0.68rem;
  line-height: 1.45;
  max-width: 50rem;
  text-align: center;
  color: var(--text-secondary);
}

.good {
  color: var(--positive);
}

.warn {
  color: var(--warning);
}

.bad {
  color: var(--negative);
}
</style>
