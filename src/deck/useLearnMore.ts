import { ref, computed, inject, onScopeDispose, type InjectionKey } from 'vue'

/**
 * The Learn More registry: the live half of a slide's detail panel.
 *
 * A panel is two things joined at display time. The words come from `src/content/` as the
 * third prose register, written in advance like the rest of the deck's text. The numbers
 * cannot: `lz77` knows what its token stream costs once Huffman-coded, `huffman-codes`
 * knows what its table costs, and those figures change with every picker and slider on the
 * slide. So a slide publishes them the same way it publishes its stats — a function
 * registered in `setup`, read when the panel opens, unregistered when the slide unmounts.
 *
 * Deliberately not the stats registry. `useStat` publishes the one headline ratio a slide
 * claims; this publishes whatever else the slide happens to have measured, and the two have
 * different shapes and different audiences.
 */

/** One measured line in a panel. `value` is already formatted — the slide knows its units. */
export interface LearnMoreFact {
  label: string
  value: string
  note?: string
}

type FactSource = () => LearnMoreFact[] | null

export function createLearnMore() {
  // A stack, like the stats registry: slides mount one at a time but overlap briefly during
  // a transition, and the newest is the one on screen.
  const registrations = ref<{ id: string; source: FactSource }[]>([])

  const facts = computed<LearnMoreFact[]>(() => {
    for (let i = registrations.value.length - 1; i >= 0; i--) {
      const found = registrations.value[i].source()
      if (found && found.length) return found
    }
    return []
  })

  function register(id: string, source: FactSource) {
    registrations.value = [...registrations.value, { id, source }]
    return () => {
      registrations.value = registrations.value.filter(r => r.source !== source)
    }
  }

  return { facts, register }
}

export type LearnMoreRegistry = ReturnType<typeof createLearnMore>
export const LEARN_MORE_KEY = Symbol.for('compression.learnMore') as InjectionKey<LearnMoreRegistry>

/**
 * Publish this slide's measured detail to its Learn More panel.
 * Call from a slide's `setup`; unregisters itself when the slide unmounts.
 */
export function useLearnMore(id: string, source: FactSource) {
  const registry = inject(LEARN_MORE_KEY)
  if (!registry) throw new Error('useLearnMore() called outside a deck with createLearnMore() provided')
  onScopeDispose(registry.register(id, source))
}
