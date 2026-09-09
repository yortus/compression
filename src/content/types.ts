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
 *
 * The panel is meant to be *browsed*, not read like a page — so most of these are visual:
 * a `person` is a portrait and two lines, a `fact` is a pull-out, an `image` is a figure.
 * `para` still exists for the rare block that genuinely needs a sentence, but a panel that
 * is all `para` is the wall of text this set of kinds exists to avoid.
 */
export type LearnMoreBlock =
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; href: string; label: string }
  /** A pull-out fact. `label` overrides the default "Did you know?" eyebrow. */
  | { kind: 'fact'; text: string; label?: string }
  /**
   * A person behind an idea. `portrait` is a filename in public/portraits/ (see its
   * CREDITS.md); omit it and the panel draws a monogram from the initials instead, so a
   * person with no freely-licensed photo still gets a card.
   */
  | {
      kind: 'person'
      name: string
      /** Life span, e.g. "1916–2001". */
      life?: string
      /** One-line role, e.g. "Information theory". */
      role?: string
      portrait?: string
      blurb: string
      href?: string
    }
  /** A figure. `src` is a path under public/ (e.g. "ai-genius.png"), or an absolute URL. */
  | { kind: 'image'; src: string; alt?: string; caption?: string; credit?: string; href?: string }

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
