<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

/**
 * A one-dimensional signal you can draw on, shared by the two Fourier slides.
 *
 * Both `waves-intro` and `dct-1d` need the same thing: 64 samples the audience can
 * reshape by dragging, with one or more series drawn over the top. Keeping it in one
 * component means the two slides look like the same object seen twice, which is the
 * point — the second slide is the first one priced in bits.
 */

const props = withDefaults(defineProps<{
  modelValue: number[]
  /** Drawn over the samples — a reconstruction, or the running sum of some waves. */
  overlay?: number[] | null
  /** Extra faint series, e.g. the individual component waves. */
  ghosts?: number[][]
  editable?: boolean
  height?: number
  /** Where 0 sits vertically: signals live in 0..1, components swing about zero. */
  centred?: boolean
  overlayColor?: string
}>(), {
  overlay: null,
  ghosts: () => [],
  editable: true,
  height: 190,
  centred: false,
  overlayColor: 'var(--accent)',
})

const emit = defineEmits<{ 'update:modelValue': [number[]] }>()

const canvas = ref<HTMLCanvasElement>()
const W = 900
let drawingAt = -1

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function yOf(v: number, h: number) {
  const pad = 8
  const span = h - pad * 2
  // Centred series swing either side of the midline, so the same amplitude uses half the
  // height a 0..1 signal would. They need a taller box, not a different scale — rescaling
  // them would make a tiny component look as important as a large one.
  return props.centred ? h / 2 - v * span : h - pad - v * span
}

function xOf(i: number, n: number) {
  return ((i + 0.5) / n) * W
}

function series(ctx: CanvasRenderingContext2D, data: readonly number[], h: number, colour: string, width: number) {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    const x = xOf(i, data.length)
    const y = yOf(data[i], h)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function draw() {
  const el = canvas.value
  if (!el) return
  const h = props.height
  el.width = W
  el.height = h
  const ctx = el.getContext('2d')!

  ctx.fillStyle = cssVar('--bg-elevated')
  ctx.fillRect(0, 0, W, h)

  // Baseline: zero for centred series, the bottom of the range otherwise.
  ctx.strokeStyle = cssVar('--border')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, yOf(0, h))
  ctx.lineTo(W, yOf(0, h))
  ctx.stroke()

  for (const g of props.ghosts) {
    ctx.globalAlpha = 0.35
    series(ctx, g, h, cssVar('--accent-dim'), 1.5)
    ctx.globalAlpha = 1
  }

  const n = props.modelValue.length
  series(ctx, props.modelValue, h, cssVar('--text-secondary'), 2)

  // Sample dots make it obvious this is 64 numbers, not a curve.
  ctx.fillStyle = cssVar('--text-secondary')
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.arc(xOf(i, n), yOf(props.modelValue[i], h), 2, 0, Math.PI * 2)
    ctx.fill()
  }

  if (props.overlay) {
    const colour = props.overlayColor.startsWith('var(')
      ? cssVar(props.overlayColor.slice(4, -1))
      : props.overlayColor
    series(ctx, props.overlay, h, colour, 2.5)
  }
}

function sampleAt(e: MouseEvent) {
  const el = canvas.value!
  const rect = el.getBoundingClientRect()
  const n = props.modelValue.length
  const x = ((e.clientX - rect.left) / rect.width) * W
  const y = ((e.clientY - rect.top) / rect.height) * props.height
  const pad = 8
  const span = props.height - pad * 2
  const value = Math.max(0, Math.min(1, (props.height - pad - y) / span))
  const index = Math.max(0, Math.min(n - 1, Math.round((x / W) * n - 0.5)))
  return { index, value }
}

function paint(e: MouseEvent) {
  if (!props.editable) return
  const { index, value } = sampleAt(e)
  const next = [...props.modelValue]
  // Fill in every sample the cursor skipped, or fast drags leave gaps.
  const from = drawingAt < 0 ? index : drawingAt
  const lo = Math.min(from, index)
  const hi = Math.max(from, index)
  for (let i = lo; i <= hi; i++) {
    const t = hi === lo ? 1 : (i - lo) / (hi - lo)
    const start = next[from]
    next[i] = from === lo ? start + (value - start) * t : value + (start - value) * t
  }
  next[index] = value
  drawingAt = index
  emit('update:modelValue', next)
}

function onDown(e: MouseEvent) {
  if (!props.editable) return
  drawingAt = -1
  paint(e)
  window.addEventListener('mousemove', paint)
  window.addEventListener('mouseup', onUp)
}

function onUp() {
  drawingAt = -1
  window.removeEventListener('mousemove', paint)
  window.removeEventListener('mouseup', onUp)
}

watch(() => [props.modelValue, props.overlay, props.ghosts, props.height], draw, { deep: true })
onMounted(draw)
onUnmounted(onUp)
</script>

<template>
  <canvas
    ref="canvas"
    class="signal-pad"
    :class="{ editable }"
    @mousedown="onDown"
  />
</template>

<style scoped>
.signal-pad {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
  display: block;
}

.signal-pad.editable {
  cursor: crosshair;
}
</style>
