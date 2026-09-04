import type { ProseRegistry, SlideProse } from './types'
import { ACT0_PROSE } from './act0'
import { ACT1_PROSE } from './act1'
import { ACT345_PROSE } from './act345'
import { ACT6_PROSE } from './act6'

/** Every slide's words, keyed by slide id. Acts are added here as they are written. */
export const PROSE: ProseRegistry = {
  ...ACT0_PROSE,
  ...ACT1_PROSE,
  ...ACT345_PROSE,
  ...ACT6_PROSE,
}

export function proseFor(slideId: string): SlideProse | null {
  return PROSE[slideId] ?? null
}

export type { SlideProse, ProseRegistry }
