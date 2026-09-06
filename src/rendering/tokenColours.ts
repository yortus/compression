/**
 * Hues for symbols, so the eye can follow one from where it was found to where it ends up
 * without reading it.
 *
 * Two rules, both learned on the Huffman slide. Hues step by the golden angle, so adjacent
 * ranks are maximally far apart and the common symbols — the ones the audience is actually
 * tracking — never collide. And anything occurring once gets no colour at all: a coloured
 * box means "this repeats", which is information, whereas two hundred unique hues is
 * decoration that actively hides the repeats among them.
 */

const GOLDEN_ANGLE = 137.508

/** `rank` is frequency order, 0 being the most common. */
export function tokenColour(rank: number, count: number, dim: string, minCount = 2): string {
  if (count < minCount) return dim
  return `hsl(${Math.round((rank * GOLDEN_ANGLE) % 360)} 88% 64%)`
}

/** Printable stand-ins for symbols that have no glyph of their own. */
export function symbolLabel(text: string): string {
  if (text === '\n') return '↵'
  if (text === '\t') return '⇥'
  if (/^\s+$/.test(text)) return '␣'
  return text
}
