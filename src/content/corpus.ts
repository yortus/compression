import type { TokeniserId } from '../engine/codecs/tokenise'

/**
 * The four messages the Huffman slide codes, and how each one is cut into symbols.
 *
 * They are here rather than in the component for the same reason the prose is: they are
 * words, they get rewritten, and none of it should mean touching layout code. Every text
 * is out of copyright — two are two millennia out.
 *
 * The point of having four is comparative. A word-coded English paragraph and a
 * character-coded Chinese one both compress well but for different reasons; the Sanskrit
 * verse compresses absurdly well because it is mostly the same eight words; and the noise
 * barely compresses at all, whatever alphabet you pick. That last row is the control, and
 * the reason the slide has a picker instead of one hard-coded string.
 *
 * `cols` and `lineFactor` are per script because a fixed-width grid is only fixed within
 * one writing system: a Han character is twice the advance width of a Latin one, and
 * Devanagari needs room above and below the line for its marks. The font size itself is
 * measured at runtime from these two numbers, so nothing here has to know about fonts.
 */
export interface SampleText {
  id: string
  /** Picker button. */
  label: string
  /** What one symbol is, in words — printed under the grid so the choice is never implicit. */
  unit: string
  tokeniser: TokeniserId
  /** Character cells across the grid. */
  cols: number
  /** Line height as a multiple of the font size. */
  lineFactor: number
  /** Where the text is from, shown small. */
  credit: string
  text: string
}

/**
 * Uniform random printable ASCII from a fixed seed, so the "random" text is the same on
 * every run and the presenter can rehearse against the number it produces.
 *
 * xorshift32 rather than `Math.random`, for exactly that reason.
 */
function asciiNoise(length: number): string {
  let state = 0x2545f491
  const out: string[] = []
  for (let i = 0; i < length; i++) {
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    // 32..126 — every printable ASCII character, equally likely, which is the worst case
    // an entropy coder can be handed short of true 8-bit noise.
    out.push(String.fromCharCode(32 + (state % 95)))
  }
  return out.join('')
}

export const SAMPLE_TEXTS: SampleText[] = [
  {
    id: 'english',
    label: 'English',
    unit: 'words and spaces',
    tokeniser: 'words',
    cols: 34,
    lineFactor: 1.22,
    credit: 'Austen, Pride and Prejudice, 1813',
    text:
      'It is a truth universally acknowledged, that a single man in possession of a ' +
      'good fortune, must be in want of a wife. However little known the feelings or ' +
      'views of such a man may be on his first entering a neighbourhood, this truth is ' +
      'so well fixed in the minds of the surrounding families, that he is considered as ' +
      'the rightful property of some one or other of their daughters. ' +
      '"My dear Mr. Bennet," said his lady to him one day, "have you heard that ' +
      'Netherfield Park is let at last?"',
  },
  {
    id: 'sanskrit',
    label: 'Sanskrit',
    unit: 'words and marks',
    tokeniser: 'words',
    cols: 34,
    lineFactor: 1.58,
    credit: 'Upanishadic peace mantras, pre-500 BCE',
    text: [
      'ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते ।',
      'पूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते ॥',
      'ॐ शान्तिः शान्तिः शान्तिः ॥',
      'ॐ सह नाववतु । सह नौ भुनक्तु ।',
      'सह वीर्यं करवावहै । तेजस्वि नावधीतमस्तु ।',
      'मा विद्विषावहै ॥',
      'ॐ शान्तिः शान्तिः शान्तिः ॥',
      'ॐ असतो मा सद्गमय । तमसो मा ज्योतिर्गमय ।',
      'मृत्योर्मा अमृतं गमय ॥',
      'ॐ शान्तिः शान्तिः शान्तिः ॥',
    ].join('\n'),
  },
  {
    id: 'chinese',
    label: '中文',
    unit: 'single characters',
    tokeniser: 'graphemes',
    cols: 16,
    lineFactor: 1.24,
    credit: 'Laozi, Dao De Jing, ch. 1, 2, 8',
    text:
      '道可道，非常道。名可名，非常名。無名天地之始，有名萬物之母。' +
      '故常無欲以觀其妙，常有欲以觀其徼。此兩者同出而異名，同謂之玄。' +
      '玄之又玄，眾妙之門。' +
      '天下皆知美之為美，斯惡已。皆知善之為善，斯不善已。' +
      '故有無相生，難易相成，長短相較，高下相傾，音聲相和，前後相隨。' +
      '上善若水。水善利萬物而不爭，處眾人之所惡，故幾於道。' +
      '居善地，心善淵，與善仁，言善信，正善治，事善能，動善時。' +
      '夫唯不爭，故無尤。',
  },
  {
    id: 'noise',
    label: 'ASCII noise',
    unit: 'single characters',
    tokeniser: 'graphemes',
    cols: 34,
    lineFactor: 1.22,
    credit: 'seeded pseudorandom — the control case',
    text: asciiNoise(470),
  },
]

/**
 * The texts the sliding-window slide matches over.
 *
 * All four are coded by character, because LZ77 works on symbols rather than on words —
 * that is the difference between it and the Huffman slide, not an oversight. The Austen
 * paragraph is deliberately the same one `SAMPLE_TEXTS` uses, so the two slides' ratios on
 * identical input can be compared directly.
 *
 * Thirty columns, not forty-six: the column count is what sets the type size, and the slide
 * pays for the wider cells out of the extra rows its tall panels have. Every text here has
 * to fit those rows without the layout's shrink retries firing — that is the check to make
 * if one of them is ever rewritten.
 */
export const LZ77_TEXTS: SampleText[] = [
  {
    id: 'english',
    label: 'English',
    unit: 'characters',
    tokeniser: 'graphemes',
    cols: 30,
    lineFactor: 1.15,
    credit: 'Austen — the same paragraph the Huffman slide codes',
    text: SAMPLE_TEXTS[0].text,
  },
  {
    id: 'code',
    label: 'Source code',
    unit: 'characters',
    tokeniser: 'graphemes',
    cols: 30,
    lineFactor: 1.15,
    credit: 'the shape of the thing gzip was built for',
    text: [
      'function encode(input, table) {',
      '  const output = []',
      '  for (const value of input) {',
      '    output.push(table.get(value))',
      '  }',
      '  return output',
      '}',
      '',
      'function decode(output, table) {',
      '  const input = []',
      '  for (const value of output) {',
      '    input.push(table.get(value))',
      '  }',
      '  return input',
      '}',
    ].join('\n'),
  },
  {
    id: 'boilerplate',
    label: 'Boilerplate',
    unit: 'characters',
    tokeniser: 'graphemes',
    cols: 30,
    lineFactor: 1.15,
    credit: 'a licence header, three times — long-range repeats',
    text: [
      'Copyright (c) 2026 Troy Gerwien. Licensed under the MIT License. See LICENSE.',
      '',
      'Copyright (c) 2026 Troy Gerwien. Licensed under the MIT License. See LICENSE.',
      '',
      'Copyright (c) 2026 Troy Gerwien. Licensed under the MIT License. See LICENSE.',
    ].join('\n'),
  },
  {
    id: 'noise',
    label: 'ASCII noise',
    unit: 'characters',
    tokeniser: 'graphemes',
    cols: 30,
    lineFactor: 1.15,
    credit: 'nothing repeats, so nothing matches — the control case',
    text: asciiNoise(560),
  },
]

export function lz77TextById(id: string): SampleText {
  return LZ77_TEXTS.find(s => s.id === id) ?? LZ77_TEXTS[0]
}

export function sampleById(id: string): SampleText {
  return SAMPLE_TEXTS.find(s => s.id === id) ?? SAMPLE_TEXTS[0]
}
