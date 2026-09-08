<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import SlideLayout from '../../deck/SlideLayout.vue'
import { ycbcrToRgb } from '../../engine/jpeg/colorspace'

/**
 * The act's opener: colour is three numbers whichever way you slice it, but you get to
 * pick the three axes — and the choice is the whole game.
 *
 * Two 2-D slices of the same 3-D colour space, side by side. The left square is the RGB
 * cube: red across, green up, blue fixed by the slider under it. The right square is the
 * same space in different coordinates: Cb across, Cr up, and brightness (Y) on the slider.
 *
 * Drag the RGB blue and the whole square changes character — every axis is part
 * brightness, so there is no plane to spend. Drag the YCbCr luma and the square keeps its
 * colours and only lightens or darkens, because brightness has been lifted onto its own
 * axis and the other two are pure colour. That is the reframe the next two slides cash in.
 *
 * The flat patches in the corners of the YCbCr square are Cb/Cr pairs that fall outside
 * the RGB cube at that brightness — no real colour there, so `ycbcrToRgb` clamps them.
 */

const RES = 256

const blue = ref(128)
const luma = ref(128)

const rgbCanvas = ref<HTMLCanvasElement>()
const ycbcrCanvas = ref<HTMLCanvasElement>()

function drawRgb() {
  const c = rgbCanvas.value
  if (!c) return
  c.width = RES
  c.height = RES
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(RES, RES)
  const d = img.data
  const b = blue.value
  for (let row = 0; row < RES; row++) {
    // Row 0 is the top of the square, so green climbs as the row index falls.
    const g = Math.round((255 * (RES - 1 - row)) / (RES - 1))
    for (let col = 0; col < RES; col++) {
      const r = Math.round((255 * col) / (RES - 1))
      const off = (row * RES + col) * 4
      d[off] = r
      d[off + 1] = g
      d[off + 2] = b
      d[off + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawYcbcr() {
  const c = ycbcrCanvas.value
  if (!c) return
  c.width = RES
  c.height = RES
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(RES, RES)
  const d = img.data
  const y = luma.value
  for (let row = 0; row < RES; row++) {
    const cr = (255 * (RES - 1 - row)) / (RES - 1)
    for (let col = 0; col < RES; col++) {
      const cb = (255 * col) / (RES - 1)
      const [r, g, b] = ycbcrToRgb(y, cb, cr)
      const off = (row * RES + col) * 4
      d[off] = r
      d[off + 1] = g
      d[off + 2] = b
      d[off + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

watch(blue, drawRgb)
watch(luma, drawYcbcr)

/** One square edge in px, sized so both panes and their furniture clear the stage. */
const stage = ref<HTMLElement>()
const edge = ref(320)

function recompute() {
  const el = stage.value
  if (!el) return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 28
  const H = el.clientHeight
  const W = el.clientWidth
  // Each pane is heading + square + x-axis + slider stacked; the y-axis label sits to the
  // left of the square. Reserve the fixed furniture and let the square take the rest.
  const reserveV = 7 * rem
  const yAxisW = 1.9 * rem
  const paneGap = 3 * rem
  const byHeight = H - reserveV
  const byWidth = (W - paneGap - 2 * yAxisW) / 2
  edge.value = Math.max(140, Math.floor(Math.min(byHeight, byWidth, 24 * rem)))
}

let ro: ResizeObserver | null = null
onMounted(() => {
  drawRgb()
  drawYcbcr()
  recompute()
  ro = new ResizeObserver(() => recompute())
  if (stage.value) ro.observe(stage.value)
  window.addEventListener('resize', recompute)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('resize', recompute)
})
watch(edge, () => nextTick())
</script>

<template>
  <SlideLayout>
    <div class="stage" ref="stage" :style="{ '--edge': edge + 'px' }">
      <!-- RGB: red across, green up, blue on the slider. -->
      <div class="pane">
        <div class="heading">
          <span class="space">RGB</span>
          <span class="sub">three dimensions of colour</span>
        </div>
        <div class="graph">
          <div class="y-axis" style="color: var(--positive)">Green →</div>
          <div class="square"><canvas ref="rgbCanvas" /></div>
          <div class="corner" />
          <div class="x-axis" style="color: var(--negative)">Red →</div>
        </div>
        <div class="knob">
          <div class="knob-head">
            <span class="knob-label" style="color: var(--accent)">Blue</span>
            <span class="knob-value">{{ blue }}</span>
          </div>
          <input type="range" min="0" max="255" v-model.number="blue" />
        </div>
      </div>

      <!-- YCbCr: Cb across, Cr up, brightness on the slider. -->
      <div class="pane">
        <div class="heading">
          <span class="space">YCbCr</span>
          <span class="sub">1D brightness plus 2D colour</span>
        </div>
        <div class="graph">
          <div class="y-axis">Cr →</div>
          <div class="square"><canvas ref="ycbcrCanvas" /></div>
          <div class="corner" />
          <div class="x-axis">Cb →</div>
        </div>
        <div class="knob">
          <div class="knob-head">
            <span class="knob-label" style="color: var(--accent)">Luma (Y)</span>
            <span class="knob-value">{{ luma }}</span>
          </div>
          <input type="range" min="0" max="255" v-model.number="luma" />
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  width: 100%;
  height: 100%;
}

.pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
}

.heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.space {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.graph {
  display: grid;
  grid-template-columns: auto var(--edge);
  grid-template-rows: var(--edge) auto;
  gap: 0.35rem;
}

.y-axis {
  grid-row: 1;
  grid-column: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.square {
  grid-row: 1;
  grid-column: 2;
  width: var(--edge);
  height: var(--edge);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.square canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.corner {
  grid-row: 2;
  grid-column: 1;
}

.x-axis {
  grid-row: 2;
  grid-column: 2;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.knob {
  width: var(--edge);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.knob-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.3rem;
}

.knob-label {
  font-size: 0.75rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
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
</style>
