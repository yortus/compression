/**
 * Slide prose, in two registers.
 *
 * `speaker` is the terse cue a presenter glances at; `learner` is the paragraph that
 * has to stand in for the presenter when someone meets the deck on the web afterwards.
 * Keeping both here rather than in templates means the words can be rewritten without
 * touching layout, and learn mode gets them for free.
 */
export interface SlideProse {
  speaker: string
  learner: string
}

export type ProseRegistry = Record<string, SlideProse>
