import { ref, computed, watch, inject, type InjectionKey } from 'vue'
import { SLIDES, ACTS, slideIndexById, actOf } from './slides'
import type { ControlId } from './types'

/**
 * Deck navigation: which slide, which fragment within it, and how that maps to the URL.
 *
 * Two audiences share this. A presenter steps through fragments with the arrow keys;
 * someone reading it later lands on a deep link and steps through the same build. There is
 * no second mode: the detail that used to justify one lives in the Learn More panel, which
 * is a button rather than a state the deck can be left in.
 */
export function createDeck() {
  const index = ref(0)
  const fragment = ref(0)

  const slide = computed(() => SLIDES[index.value])
  const act = computed(() => actOf(slide.value))
  const fragmentCount = computed(() => slide.value.fragments ?? 1)

  function isRevealed(n: number) {
    return n <= fragment.value
  }

  function controlEnabled(id: ControlId) {
    return slide.value.controls?.includes(id) ?? false
  }

  function goTo(i: number, frag = 0) {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i))
    if (clamped !== index.value) {
      index.value = clamped
      fragment.value = frag
    } else {
      fragment.value = Math.max(0, Math.min((SLIDES[clamped].fragments ?? 1) - 1, frag))
    }
  }

  function goToId(id: string, frag = 0) {
    const i = slideIndexById(id)
    if (i >= 0) goTo(i, frag)
  }

  /** Advance a fragment if the slide has one left, otherwise move to the next slide. */
  function next() {
    if (fragment.value < fragmentCount.value - 1) fragment.value++
    else goTo(index.value + 1)
  }

  /** Step back through fragments; landing on a previous slide shows it fully built. */
  function prev() {
    if (fragment.value > 0) fragment.value--
    else if (index.value > 0) {
      const target = index.value - 1
      goTo(target, (SLIDES[target].fragments ?? 1) - 1)
    }
  }

  function nextSlide() {
    goTo(index.value + 1)
  }
  function prevSlide() {
    goTo(index.value - 1, 0)
  }

  // --- URL sync: #/slide-id or #/slide-id/2 ---------------------------------
  let suppressHashWatch = false

  function readHash() {
    const m = /^#\/([\w-]+)(?:\/(\d+))?/.exec(location.hash)
    if (!m) return false
    const i = slideIndexById(m[1])
    if (i < 0) return false
    index.value = i
    fragment.value = m[2] ? Number(m[2]) : 0
    return true
  }

  function writeHash() {
    const frag = fragment.value > 0 ? `/${fragment.value}` : ''
    const next = `#/${slide.value.id}${frag}`
    if (location.hash === next) return
    suppressHashWatch = true
    location.hash = next
    // hashchange fires asynchronously; release the guard after it has been delivered.
    setTimeout(() => { suppressHashWatch = false }, 0)
  }

  function start() {
    readHash()
    writeHash()
    window.addEventListener('hashchange', () => {
      if (suppressHashWatch) return
      readHash()
    })
    watch([index, fragment], writeHash)
  }

  return {
    index,
    fragment,
    slide,
    act,
    slides: SLIDES,
    acts: ACTS,
    fragmentCount,
    isRevealed,
    controlEnabled,
    goTo,
    goToId,
    next,
    prev,
    nextSlide,
    prevSlide,
    start,
  }
}

export type Deck = ReturnType<typeof createDeck>
// Symbol.for, not Symbol: a plain symbol is recreated when Vite hot-reloads this
// module, so an already-mounted DeckShell keeps providing under the old key and every
// component mounted afterwards fails to inject. Only bites in dev, but confusingly.
export const DECK_KEY = Symbol.for('compression.deck') as InjectionKey<Deck>

export function useDeck(): Deck {
  const deck = inject(DECK_KEY)
  if (!deck) throw new Error('useDeck() called outside a DeckShell')
  return deck
}
