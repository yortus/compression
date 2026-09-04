import type { ProseRegistry, SlideProse } from './types'
import { ACT1_PROSE } from './act1'

/** Every slide's words, keyed by slide id. Acts are added here as they are written. */
export const PROSE: ProseRegistry = {
  ...ACT1_PROSE,
}

export function proseFor(slideId: string): SlideProse | null {
  return PROSE[slideId] ?? null
}

export type { SlideProse, ProseRegistry }
