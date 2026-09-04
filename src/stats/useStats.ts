import { ref, computed, inject, onScopeDispose, type InjectionKey, type ComputedRef } from 'vue'
import { derive, type StatSample, type StatDerived } from './types'

type StatSource = () => StatSample | null

interface Registration {
  id: string
  source: StatSource
}

export function createStats() {
  // Slides mount one at a time, but keep a stack so nothing blanks out mid-transition.
  const registrations = ref<Registration[]>([])

  /** Best result recorded per slide id, for the Act 5 finale to stack up. */
  const scoreboard = ref(new Map<string, StatSample>())

  const current = computed<StatDerived | null>(() => {
    for (let i = registrations.value.length - 1; i >= 0; i--) {
      const sample = registrations.value[i].source()
      if (sample) return derive(sample)
    }
    return null
  })

  // Recording is a side effect of reading, so the scoreboard fills in as the deck is walked.
  function record(id: string, sample: StatSample) {
    const prev = scoreboard.value.get(id)
    const total = sample.encodedBits + sample.overheadBits
    if (!prev || total < prev.encodedBits + prev.overheadBits) {
      scoreboard.value.set(id, sample)
    }
  }

  function register(id: string, source: StatSource) {
    const wrapped: StatSource = () => {
      const sample = source()
      if (sample) record(id, sample)
      return sample
    }
    registrations.value = [...registrations.value, { id, source: wrapped }]
    return () => {
      registrations.value = registrations.value.filter(r => r.source !== wrapped)
    }
  }

  return { current, scoreboard, register }
}

export type Stats = ReturnType<typeof createStats>
export const STATS_KEY = Symbol('stats') as InjectionKey<Stats>

/**
 * Publish this slide's compression stats to the always-on HUD.
 * Call from a slide's `setup`; unregisters itself when the slide unmounts.
 */
export function useStat(id: string, source: StatSource): ComputedRef<StatDerived | null> {
  const stats = inject(STATS_KEY)
  if (!stats) throw new Error('useStat() called outside a deck with createStats() provided')
  const unregister = stats.register(id, source)
  onScopeDispose(unregister)
  return computed(() => {
    const sample = source()
    return sample ? derive(sample) : null
  })
}
