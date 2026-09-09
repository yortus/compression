<script setup lang="ts">
import { inject, computed } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { PIPELINE_KEY } from '../../composables/useJpegPipeline'
import { useStat } from '../../stats/useStats'
import { formatBytes } from '../../stats/types'
import { measureStages } from '../../engine/jpeg/stages'
import { estimateEncodedBits } from '../../engine/jpeg/pipeline'
import { compareImages } from '../../engine/compare'
import { ratioVerdict } from '../../rendering/stamp'

/**
 * The whole chain, one row per stage, measured on the image currently loaded.
 *
 * Everything the deck has claimed about JPEG lands here as arithmetic. The final row is
 * the same `estimateEncodedBits` that `jpeg-result` reports, and the headline ratio
 * divides it into the same 24-bits-a-pixel raw figure, so the finale's total is the
 * number the audience has been watching all along rather than a fresh one.
 */

const pipeline = inject(PIPELINE_KEY)!

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

const finalRatio = computed(() => (finalBits.value > 0 ? rawBits.value / finalBits.value : 0))

/** Same wording as the canvas stamps on the exploration slides, in an HTML badge. */
const verdict = computed(() => ratioVerdict(finalRatio.value))

function verdictOf(delta: number) {
  if (delta < -0.01) return 'saves'
  if (delta > 0.01) return 'costs'
  return 'flat'
}
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
          </div>
        </div>

        <div class="total">
          <span class="badge" :class="verdict.better ? 'better' : 'worse'">{{ verdict.text }}</span>
        </div>
      </template>
    </div>
  </SlideLayout>
</template>

<style scoped>
.pipe {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  justify-content: center;
}

.loading {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.row {
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr) 6rem 5rem;
  align-items: center;
  gap: 0.9rem;
  font-size: 0.95rem;
  padding: 0.3rem 0.5rem;
  border-radius: 5px;
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
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: 3px;
  padding: 0 0.2rem;
  margin-left: 0.35rem;
  vertical-align: middle;
}

.track {
  height: 1.15rem;
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

.total {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0.4rem;
}

.badge {
  font-size: 2.4rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.35rem 1.1rem;
  border: 3px solid;
  border-radius: 7px;
  font-variant-numeric: tabular-nums;
}

.badge.better { color: var(--positive); border-color: var(--positive); }
.badge.worse { color: var(--warning); border-color: var(--warning); }
</style>
