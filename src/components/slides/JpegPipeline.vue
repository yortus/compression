<script setup lang="ts">
import { inject, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { STATS_KEY, useStat } from '../../stats/useStats'
import { formatBytes } from '../../stats/types'
import { measureStages } from '../../engine/jpeg/stages'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'
import { compareImages } from '../../engine/compare'

/**
 * The whole chain, one row per stage, measured on the image currently loaded.
 *
 * Everything the deck has claimed about JPEG lands here as arithmetic, and the
 * commentary underneath is read off the rows rather than written in advance — see the
 * note above `biggest`. The final row is the same `estimateEncodedBits` that
 * `jpeg-result` reports, and the headline ratio divides it into the same 24-bits-a-pixel
 * raw figure, so the finale's total is the number the audience has been watching all
 * along rather than a fresh one.
 *
 * The Codes-act scoreboard is picked up where it exists: whatever the simple techniques
 * actually managed on this image, as measured when those slides were on screen.
 */

const pipeline = inject(PIPELINE_KEY)!
const stats = inject(STATS_KEY)!

const stages = computed(() => {
  const cache = pipeline.cache.value
  const src = pipeline.sourceImageData.value
  if (!cache || !src) return null
  return measureStages(cache, src, pipeline.quality.value)
})

const rawBits = computed(() => stages.value?.[0].bits ?? 0)
const finalBits = computed(() => stages.value?.[stages.value.length - 1].bits ?? 0)

/** Bar width relative to the widest row, which is not always the first. */
const widest = computed(() => Math.max(...(stages.value?.map(s => s.bits) ?? [1])))

const trueRawBits = computed(() => {
  const src = pipeline.sourceImageData.value
  return src ? src.width * src.height * 3 * 8 : 0
})

const diff = computed(() => {
  const src = pipeline.sourceImageData.value
  const recon = pipeline.reconstructed.value
  return src && recon ? compareImages(src, recon) : null
})

useStat('jpeg-pipeline', () => {
  const cache = pipeline.cache.value
  if (!cache || !trueRawBits.value) return null
  return {
    label: 'JPEG · every stage',
    rawBits: trueRawBits.value,
    encodedBits: estimateEncodedBits(cache),
    overheadBits: 0,
    lossy: !diff.value?.identical,
    note: `Q=${pipeline.quality.value} · ${pipeline.subsamplingMode.value} · idealised, no code tables`,
  }
})

/** What the simple techniques managed on this image, if those slides have been visited. */
const EARLIER = [
  { id: 'rle-bitmap', label: 'Run-length encoding' },
  { id: 'rgb-planes', label: 'RLE over colour planes' },
  { id: 'huffman-codes', label: 'Huffman over text' },
]

const earlier = computed(() =>
  EARLIER.map(e => {
    const sample = stats.scoreboard.value.get(e.id)
    if (!sample) return { ...e, ratio: null }
    return { ...e, ratio: sample.rawBits / (sample.encodedBits + sample.overheadBits) }
  }))

const anyEarlier = computed(() => earlier.value.some(e => e.ratio !== null))

const finalRatio = computed(() => (finalBits.value > 0 ? rawBits.value / finalBits.value : 0))

function verdictOf(delta: number) {
  if (delta < -0.01) return 'saves'
  if (delta > 0.01) return 'costs'
  return 'flat'
}

/**
 * The commentary is read off the measurements rather than written in advance.
 *
 * An earlier version of this slide asserted that the DCT row costs bits, on the
 * reasoning that a rotation cannot destroy information. Measured, it saves a great
 * deal — order-0 entropy is not preserved by a rotation, and decorrelating the samples
 * is exactly what makes a memoryless coder do better. Which is the argument for reading
 * the numbers off the page instead of deciding what they ought to say.
 */
const biggest = computed(() => {
  const rows = stages.value
  if (!rows) return null
  return rows.slice(1).reduce((best, r) => (r.delta < best.delta ? r : best))
})

const costly = computed(() => stages.value?.slice(1).filter(r => r.delta > 0.01) ?? [])
const dctRow = computed(() => stages.value?.find(r => r.stage.includes('DCT')) ?? null)
const lossySteps = computed(() => stages.value?.filter(r => r.lossy) ?? [])
const transformSteps = computed(() => stages.value?.length ?? 0)
</script>

<template>
  <SlideLayout column>
    <div class="pipe">
      <p v-if="!stages" class="loading">waiting for an image…</p>

      <template v-else>
        <div class="rows">
          <div v-for="(s, i) in stages" :key="s.stage" class="row" :class="{ final: i === stages.length - 1 }">
            <span class="stage">
              {{ s.stage }}
              <span v-if="s.lossy" class="lossy-tag">lossy</span>
            </span>

            <span class="track">
              <span
                class="fill"
                :class="verdictOf(s.delta)"
                :style="{ width: (s.bits / widest) * 100 + '%' }"
              />
            </span>

            <span class="size">{{ formatBytes(s.bits) }}</span>

            <span class="delta" :class="verdictOf(s.delta)">
              <template v-if="i === 0">—</template>
              <template v-else-if="verdictOf(s.delta) === 'flat'">no change</template>
              <template v-else>{{ s.delta > 0 ? '+' : '' }}{{ (s.delta * 100).toFixed(0) }}%</template>
            </span>

            <!-- The tag leads, so it survives the note being clipped on a narrow screen. -->
            <span class="note">
              <span v-if="s.measure !== 'entropy'" class="measure">{{ s.measure === 'fixed' ? 'fixed width' : 'real codes' }}</span>
              {{ s.note }}
            </span>
          </div>
        </div>

        <div class="total">
          <span class="big">{{ finalRatio.toFixed(1) }}:1</span>
          <span class="detail">
            {{ formatBytes(rawBits) }} down to {{ formatBytes(finalBits) }} —
            and only {{ lossySteps.length }} of those {{ transformSteps }} steps threw anything away.
          </span>
        </div>

        <Fragment :index="1">
          <div class="payoff">
            <p>
              The biggest single drop is <strong>{{ biggest?.stage }}</strong>
              ({{ ((biggest?.delta ?? 0) * 100).toFixed(0) }}%). The row worth arguing about is the
              DCT, at {{ ((dctRow?.delta ?? 0) * 100).toFixed(0) }}%: it discards nothing whatsoever
              and the file still shrinks, because a coder with no memory does far better on
              decorrelated coefficients than on neighbouring pixels. That is what transform coding
              <em>is</em>, and it is what pays for every row below it.
              <template v-if="costly.length">
                {{ costly.length === 1 ? 'One stage' : `${costly.length} stages` }} actually
                <strong class="costs">cost</strong> bits here
                ({{ costly.map(c => c.stage).join(', ') }}) — repaid immediately by what follows.
              </template>
              Quantisation is where the loss is spent; zigzag and RLE only collect the zeros that
              quantisation manufactured. <em>No single stage here is the compressor.</em>
            </p>
            <div v-if="anyEarlier" class="earlier">
              <span class="earlier-head">On this same image, from earlier acts:</span>
              <span v-for="e in earlier" :key="e.id" class="earlier-row">
                {{ e.label }}
                <strong v-if="e.ratio !== null" :class="{ bad: e.ratio < 1 }">{{ e.ratio.toFixed(2) }}:1</strong>
                <em v-else>not measured yet</em>
              </span>
            </div>
            <p v-else class="earlier-hint">
              Walk back through the earlier acts and those techniques' scores on this image appear here for
              comparison.
            </p>
          </div>
        </Fragment>
      </template>
    </div>
  </SlideLayout>
</template>

<style scoped>
.pipe {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  justify-content: center;
}

.loading {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.row {
  display: grid;
  grid-template-columns: 9.5rem minmax(0, 1fr) 4rem 3.4rem minmax(0, 1.15fr);
  align-items: center;
  gap: 0.5rem;
  font-size: 0.62rem;
  padding: 0.12rem 0.3rem;
  border-radius: 4px;
}

.row.final {
  background: var(--bg-elevated);
}

.stage {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lossy-tag {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: 3px;
  padding: 0 0.15rem;
  margin-left: 0.25rem;
  vertical-align: middle;
}

.track {
  height: 0.75rem;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  background: var(--accent-dim);
}

.fill.saves { background: var(--accent); }
/* A stage that grows the representation is drawn as growing it. */
.fill.costs { background: var(--warning); }

.size, .delta {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.size {
  color: var(--text);
}

.delta.saves { color: var(--positive); }
.delta.costs { color: var(--warning); }
.delta.flat { color: var(--text-secondary); }

.note {
  font-size: 0.62rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.measure {
  font-style: italic;
  opacity: 0.75;
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0 0.2rem;
  margin-right: 0.3rem;
}

.total {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  justify-content: center;
  padding-top: 0.2rem;
}

.big {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--positive);
  font-variant-numeric: tabular-nums;
}

.detail {
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.payoff {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
}

.payoff p {
  font-size: 0.63rem;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 56rem;
  text-align: center;
}

.costs {
  color: var(--warning);
}

.earlier {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  font-size: 0.62rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
  justify-content: center;
}

.earlier-head {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.62rem;
}

.earlier-row strong {
  color: var(--positive);
  font-variant-numeric: tabular-nums;
  margin-left: 0.25rem;
}

.earlier-row strong.bad {
  color: var(--negative);
}

.earlier-row em {
  opacity: 0.6;
  margin-left: 0.25rem;
}

.earlier-hint {
  font-style: italic;
  opacity: 0.8;
}
</style>
