<script setup lang="ts">
import { ref } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'

/** Each corner names what you give up to get it — the trade is the content. */
const CORNERS = [
  {
    id: 'ratio',
    label: 'Smaller',
    detail: 'Squeeze harder and you spend more time, or more fidelity, or both.',
    example: 'JPEG XL, AV1',
  },
  {
    id: 'speed',
    label: 'Faster',
    detail: 'Real-time video and disk compression cannot afford the best ratio.',
    example: 'LZ4, zstd -1',
  },
  {
    id: 'fidelity',
    label: 'Truer',
    detail: 'Keep everything and you give up most of the ratio immediately.',
    example: 'PNG, FLAC',
  },
]

const active = ref<string | null>(null)
</script>

<template>
  <SlideLayout column>
    <div class="optimisation">
      <div class="triangle-wrap">
        <svg viewBox="0 0 300 260" class="triangle">
          <polygon points="150,20 285,240 15,240" fill="none" stroke="var(--accent-dim)" stroke-width="2" />
          <circle cx="150" cy="167" r="4" fill="var(--accent)" />
          <text x="150" y="190" text-anchor="middle" class="svg-note">pick two</text>
        </svg>

        <button
          v-for="(c, i) in CORNERS" :key="c.id"
          class="corner"
          :class="[c.id, { active: active === c.id }]"
          @mouseenter="active = c.id"
          @mouseleave="active = null"
        >
          <span class="corner-label">{{ c.label }}</span>
          <span class="corner-example">{{ c.example }}</span>
          <span class="corner-detail" :class="{ shown: active === c.id }">{{ c.detail }}</span>
          <span class="sr">{{ i }}</span>
        </button>
      </div>

      <div class="prose">
        <blockquote>
          “Premature optimisation is the root of all evil.”
          <cite>— Knuth, usually quoted without the next sentence</cite>
        </blockquote>
        <p>
          Compression is optimisation, and it inherits the whole argument. Applied early and
          everywhere it makes systems unreadable and brittle. Applied late, deliberately, and at
          the one place the bytes actually pile up, it is the difference between a medium
          existing and not existing.
        </p>

        <Fragment :index="1">
          <p class="beat">
            The rest of this talk is that second kind: a handful of deliberate decisions, each
            one measured, each one giving something up.
          </p>
        </Fragment>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.optimisation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  width: 100%;
  height: 100%;
}

.triangle-wrap {
  position: relative;
  width: 300px;
  height: 260px;
  flex: none;
}

.triangle {
  width: 100%;
  height: 100%;
}

.svg-note {
  fill: var(--text-secondary);
  font-size: 11px;
  font-style: italic;
}

.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.3rem 0.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 8rem;
}

.corner.ratio { top: -0.4rem; left: 50%; transform: translateX(-50%); }
.corner.speed { bottom: -0.4rem; right: -1.5rem; }
.corner.fidelity { bottom: -0.4rem; left: -1.5rem; }

.corner.active {
  border-color: var(--accent);
}

.corner-label {
  font-size: 0.72rem;
  font-weight: 700;
}

.corner-example {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.corner-detail {
  font-size: 0.62rem;
  line-height: 1.35;
  color: var(--text-secondary);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.2s;
}

.corner-detail.shown {
  max-height: 4rem;
}

.sr {
  display: none;
}

.prose {
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

blockquote {
  border-left: 3px solid var(--accent-dim);
  padding-left: 0.8rem;
  font-size: 0.85rem;
  line-height: 1.4;
}

cite {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.62rem;
  font-style: normal;
  color: var(--text-secondary);
}

.prose p {
  font-size: 0.7rem;
  line-height: 1.55;
  color: var(--text-secondary);
}

.beat {
  color: var(--text) !important;
}
</style>
