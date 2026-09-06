/**
 * Slide prose, and the detail behind it.
 *
 * There used to be a second register — a terse cue for the presenter, shown in a band
 * under the title — and a mode that swapped it for the full paragraph. Both are gone: the
 * slide carries its own argument, and every word that is not on the slide is behind the
 * Learn More button. One place to look, and no state the deck can be left in.
 *
 * `learner` is that paragraph: what the presenter would have said, written so it still
 * works for someone meeting the deck on the web afterwards. It opens the panel. `more` is
 * what follows it — what the real format does, what the measurement actually found, what
 * this slide is deliberately not modelling.
 */

/**
 * One piece of a Learn More panel. Data rather than markup, like the rest of `content/`,
 * so the panel decides how it is set and the words never carry layout with them.
 */
export type LearnMoreBlock =
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; href: string; label: string }

export interface LearnMoreEntry {
  /** Panel heading for the detail section. The slide's own title heads the panel. */
  title?: string
  blocks: LearnMoreBlock[]
}

export interface SlideProse {
  /** The paragraph the panel opens with. */
  learner: string
  /** Detail after it. Numbers come from `useLearnMore`, not from here. */
  more?: LearnMoreEntry
}

export type ProseRegistry = Record<string, SlideProse>
