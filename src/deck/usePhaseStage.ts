import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import gsap from 'gsap'
import { useDeck } from './useDeck'

/**
 * The animated-stage pattern the deck's exploration slides share.
 *
 * Every one of them is the same machine: one canvas sized to fill its box, one paused GSAP
 * timeline with a label per phase, a row of segmented buttons that plays the animation to
 * whichever phase you pick, and the deck's own fragment so the arrow keys drive the same
 * thing. This was duplicated between `basis-64` and `huffman-codes` before there were four
 * more slides wanting it.
 *
 * Three things it owns that are easy to get wrong:
 *
 * **The backing store is sized to the real display size.** A canvas authored at 1600 units
 * and shown at 1300px is resampled by the browser every frame, smoothly, and no amount of
 * `imageSmoothingEnabled = false` prevents it — that flag governs drawing *into* a canvas,
 * not the scaling *of* one. So the store is `displayWidth * devicePixelRatio` and the
 * context is scaled to match, leaving the drawing code in fixed logical units.
 *
 * **The size comes from the wrapper, and the canvas is then given an explicit one.** This is
 * the one part that must not be done the obvious way. Letting CSS size the canvas with
 * `max-width/max-height: 100%` while JS writes the measured size back into `canvas.width`
 * is a feedback loop: the intrinsic size shrinks, so the laid-out size shrinks, so the
 * intrinsic size shrinks again. It converges — a 1600-unit stage settled at 282px, drawing
 * perfectly into a canvas nobody could read. So the observer watches the *parent*, the
 * largest box of the right aspect is computed from it, and the canvas gets that size in
 * pixels. A canvas with an explicit size cannot influence its own container.
 *
 * **Redraw is gated.** A full frame on these slides is a few thousand `fillText` calls,
 * which is fine while something is moving and pure waste for the minutes a presenter
 * spends parked on one phase. The loop runs only while the playhead is active or something
 * has explicitly changed.
 *
 * **Stage and fragment are two-way.** Buttons write the deck's fragment; the arrow keys
 * write it too, and the watcher mirrors it back without looping. Learn mode jumps to the
 * end, because there is no presenter to step through it.
 */

export interface PhaseStageOptions {
  /** One label per phase. Every entry must exist as a label on the built timeline. */
  stages: readonly string[]
  /** Logical stage size; the aspect should match the slide area the canvas lives in. */
  width: number
  height: number
  /**
   * Recompute whatever the timeline and the drawing read — the slide's model, its colours,
   * any layout measured from the canvas. Runs immediately before every `build()`, which
   * means a late-arriving font re-measures the layout rather than only replaying the
   * animation over stale metrics.
   */
  beforeBuild?: () => void
  /**
   * Build a fresh paused timeline, or null if there is nothing to animate yet. Called on
   * mount and whenever `rebuild()` is invoked. Must add a label for every stage.
   */
  build: () => gsap.core.Timeline | null
  /**
   * Draw one frame. The transform is already scaled, so work in logical units — `scale` is
   * passed for the rare case that needs device pixels, such as painting a block of image
   * data cell by cell so it cannot be resampled.
   */
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void
}

export interface PhaseStage {
  canvas: Ref<HTMLCanvasElement | undefined>
  /** Which phase is being headed for — not where the playhead is. */
  stage: Ref<number>
  /** Where the playhead actually is, 0 to 1 across the whole timeline. */
  progress: Ref<number>
  selectStage: (n: number) => void
  /** Jump the playhead to a fraction of the timeline, cancelling any tween in flight. */
  scrub: (value: number) => void
  /** Rebuild the timeline from the slide's current data and redraw. */
  rebuild: () => void
  /** Force one redraw, for changes the timeline knows nothing about. */
  markDirty: () => void
}

export function usePhaseStage(opts: PhaseStageOptions): PhaseStage {
  const deck = useDeck()
  const last = opts.stages.length - 1

  const canvas = ref<HTMLCanvasElement>()
  const stage = ref(Math.min(last, deck.fragment.value))
  const progress = ref(0)

  let tl: gsap.core.Timeline | null = null
  let playhead: gsap.core.Tween | null = null
  let observer: ResizeObserver | null = null
  let scale = 1
  let dirty = true
  let alive = true

  function markDirty() {
    dirty = true
  }

  function readProgress() {
    if (!tl) return
    const total = tl.duration() || 1
    const value = Math.max(0, Math.min(1, tl.time() / total))
    // Only on a real change: a ref written the same value does not re-render, but the
    // comparison is cheaper than letting Vue work that out sixty times a second.
    if (Math.abs(value - progress.value) > 0.0005) progress.value = value
  }

  /** The last phase whose label the playhead has reached — which button should look lit. */
  function stageAtTime(time: number) {
    if (!tl) return 0
    let best = 0
    for (let i = 0; i < opts.stages.length; i++) {
      const at = tl.labels[opts.stages[i]]
      if (at !== undefined && time >= at - 0.001) best = i
    }
    return best
  }

  /**
   * Dragging takes over from whatever the buttons started.
   *
   * The two controls are two views of one playhead: a button plays to a labelled point, the
   * slider goes straight to an arbitrary one, and each leaves the other showing the truth.
   * Killing the tween first is what makes the handover feel like a handover rather than a
   * fight — without it the tween keeps writing the time back under the drag.
   */
  function scrub(value: number) {
    if (!tl) return
    playhead?.kill()
    playhead = null
    const clamped = Math.max(0, Math.min(1, value))
    tl.seek(clamped * (tl.duration() || 0))
    progress.value = clamped
    const target = stageAtTime(tl.time())
    if (target !== stage.value) {
      stage.value = target
      deck.fragment.value = target
    }
    dirty = true
  }

  function resize() {
    const el = canvas.value
    const box = el?.parentElement
    if (!el || !box) return
    const rect = box.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    // Largest box of the stage's aspect that fits the wrapper, in CSS pixels.
    const fit = Math.min(rect.width / opts.width, rect.height / opts.height)
    el.style.width = `${Math.floor(opts.width * fit)}px`
    el.style.height = `${Math.floor(opts.height * fit)}px`

    const next = (Math.floor(opts.width * fit) * (window.devicePixelRatio || 1)) / opts.width
    if (Math.abs(next - scale) > 0.001) {
      scale = next
      // Assigning either dimension *clears* the canvas, so the repaint below is not an
      // optimisation. Deferring it to the next tick leaves one blank frame — a flicker
      // during a window resize, and a permanently empty canvas anywhere the frame loop
      // can stop before the next tick, which is how this was found.
      el.width = Math.round(opts.width * scale)
      el.height = Math.round(opts.height * scale)
    }
    dirty = true
    frame()
  }

  function goToStage(n: number, instant = false) {
    if (!tl) return
    playhead?.kill()
    playhead = null
    const label = opts.stages[Math.max(0, Math.min(last, n))]
    // No duration given, so GSAP moves the playhead at its natural speed: picking a phase
    // *plays* the animation to it, forwards or backwards.
    if (instant) tl.seek(label)
    else playhead = tl.tweenTo(label)
    readProgress()
    dirty = true
  }

  function selectStage(n: number) {
    const target = Math.max(0, Math.min(last, n))
    // Picking the phase you are already in replays the step that got you there.
    if (target === stage.value && target > 0 && tl) tl.seek(opts.stages[target - 1])
    stage.value = target
    deck.fragment.value = target
    goToStage(target)
  }

  function rebuild() {
    if (!alive) return
    playhead?.kill()
    playhead = null
    tl?.kill()
    opts.beforeBuild?.()
    tl = opts.build()
    if (tl) goToStage(stage.value, true)
    dirty = true
  }

  function frame() {
    const el = canvas.value
    if (!el) return
    readProgress()
    if (!dirty && !playhead?.isActive() && !tl?.isActive()) return
    dirty = false
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    opts.draw(ctx, scale)
  }

  watch(() => deck.fragment.value, n => {
    const target = Math.max(0, Math.min(last, n))
    if (target === stage.value) return
    stage.value = target
    goToStage(target)
  })

  onMounted(() => {
    const el = canvas.value
    if (el) {
      el.width = opts.width
      el.height = opts.height
      resize()
      // The wrapper, never the canvas: observing the canvas is what closes the loop.
      if (el.parentElement) {
        observer = new ResizeObserver(resize)
        observer.observe(el.parentElement)
      }
    }
    rebuild()
    // Grid metrics come from measureText, so a font arriving late would leave a layout
    // fitted to the fallback. Cheap to redo once.
    document.fonts?.ready?.then(rebuild)
    gsap.ticker.add(frame)
  })

  onUnmounted(() => {
    alive = false
    gsap.ticker.remove(frame)
    observer?.disconnect()
    playhead?.kill()
    tl?.kill()
  })

  return { canvas, stage, progress, selectStage, scrub, rebuild, markDirty }
}
