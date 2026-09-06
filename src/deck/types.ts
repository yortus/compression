import type { Component } from 'vue'

export type ActId = 'framing' | 'codes' | 'colour' | 'fourier' | 'jpeg' | 'conclusions'

export interface Act {
  id: ActId
  /** Short label for the navigation bar. */
  label: string
  /** Full act title, shown in the top bar. */
  title: string
}

/**
 * Global controls a slide wants available in the persistent control bar.
 * Controls a slide does not list are disabled in place, never moved or removed —
 * the audience should learn where the furniture is exactly once.
 */
export type ControlId = 'image' | 'quality' | 'subsampling' | 'block'

export interface SlideDef {
  /** Stable id — also the deep link, e.g. #/rle-palette */
  id: string
  act: ActId
  title: string
  subtitle?: string
  component: Component
  /** `optional` slides are the first to be cut when a dry run overruns. */
  tag: 'core' | 'optional'
  controls?: ControlId[]
  /** Number of progressive-reveal steps within the slide. 1 means no build. */
  fragments?: number
}
