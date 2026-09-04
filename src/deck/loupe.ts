import { ref, shallowRef, type Directive } from 'vue'

/**
 * The zoom loupe, as shared chrome rather than a per-slide feature.
 *
 * Any canvas showing an image gets it by adding `v-loupe`; the magnifier itself is
 * rendered once by DeckShell. There is exactly one deck on the page, so the state is a
 * module singleton — a directive would otherwise have to reach for provide/inject.
 */

// 168 rather than 160 so the zoom divides into a whole number of source pixels.
export const LOUPE_SIZE = 168
export const LOUPE_ZOOM = 12
/** How many source pixels are magnified into the loupe. */
export const LOUPE_SRC = LOUPE_SIZE / LOUPE_ZOOM

export const visible = ref(false)
export const cursorX = ref(0)
export const cursorY = ref(0)
/** Source pixel under the cursor, in the canvas's own pixel coordinates. */
export const sourceX = ref(0)
export const sourceY = ref(0)
// Kept out of reactive() deliberately: a Proxy-wrapped canvas fails drawImage's
// internal type check.
export const source = shallowRef<HTMLCanvasElement | null>(null)

function canvasPixel(e: MouseEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    px: (e.clientX - rect.left) * (canvas.width / rect.width),
    py: (e.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function onMove(this: HTMLCanvasElement, e: MouseEvent) {
  const { px, py } = canvasPixel(e, this)
  source.value = this
  sourceX.value = px
  sourceY.value = py
  cursorX.value = e.clientX
  cursorY.value = e.clientY
  visible.value = true
}

function onLeave() {
  visible.value = false
}

/**
 * `v-loupe` on any canvas. Slides opt in per canvas rather than getting it everywhere,
 * because magnifying a chart or a coefficient grid is meaningless.
 */
export const vLoupe: Directive<HTMLCanvasElement> = {
  mounted(el) {
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    el.style.cursor = el.style.cursor || 'crosshair'
  },
  unmounted(el) {
    el.removeEventListener('mousemove', onMove)
    el.removeEventListener('mouseleave', onLeave)
    if (source.value === el) visible.value = false
  },
}
