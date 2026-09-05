/**
 * Splitting a message into the symbols an entropy coder will actually count.
 *
 * Huffman does not know what a "character" is — it codes whatever alphabet it is handed,
 * and choosing that alphabet is a modelling decision made *before* any compression
 * happens. English is mostly the same few hundred words, so the interesting symbol is a
 * word; written Chinese is mostly the same few hundred characters, so it is a character;
 * random bytes have no repeated anything and no choice of alphabet rescues them. The
 * Act 3 slide swaps between texts precisely to make that choice visible.
 *
 * Everything here works in grapheme clusters rather than code points, because a cell in
 * a fixed-width grid holds one *visible* character: a Devanagari consonant plus its vowel
 * sign is two code points and one cluster, and splitting it puts a matra in its own box.
 */

export type TokeniserId = 'words' | 'graphemes'

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>
}

// `Intl.Segmenter` is not in the ES2020 lib this project compiles against, and is missing
// on a few older browsers, so it is reached for defensively and falls back to code points.
const SEGMENTER: SegmenterLike | null = (() => {
  const ctor = (Intl as unknown as {
    Segmenter?: new (locale?: string, options?: { granularity: string }) => SegmenterLike
  }).Segmenter
  if (!ctor) return null
  try {
    return new ctor(undefined, { granularity: 'grapheme' })
  } catch {
    return null
  }
})()

/** Visible characters, one per grid cell. */
export function graphemes(text: string): string[] {
  if (!SEGMENTER) return [...text]
  const out: string[] = []
  for (const { segment } of SEGMENTER.segment(text)) out.push(segment)
  return out
}

/**
 * Words, single spaces, single newlines and single punctuation marks.
 *
 * Whitespace is its own token rather than being glued to the word beside it, which is
 * what makes the space the runaway most-frequent symbol in any Latin-script text — and
 * therefore the one that collects the shortest code. `\p{M}` keeps combining marks with
 * the letter they belong to, so Devanagari words survive intact; the zero-width joiner is
 * kept for the same reason.
 */
const WORD_RE = /[\p{L}\p{N}\p{M}\u200D'’]+|\n|[^\S\n]|[^\s]/gu

export function tokeniseWords(text: string): string[] {
  return text.match(WORD_RE) ?? []
}

export function tokenise(text: string, id: TokeniserId): string[] {
  return id === 'words' ? tokeniseWords(text) : graphemes(text)
}

const ENCODER = new TextEncoder()

/** What the text costs stored plainly, which is the number every ratio is measured against. */
export function utf8Bytes(text: string): number {
  return ENCODER.encode(text).length
}
