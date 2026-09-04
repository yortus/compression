/**
 * The people and dates behind the techniques in this deck.
 *
 * Dates are first publication of the idea, not first shipping product — the gap between
 * the two is often decades, which is part of the story. Worth a sanity check against a
 * source before presenting; these are the dates usually cited.
 */

export interface TimelineEntry {
  year: number
  who: string
  what: string
  /** Which act of this deck the idea belongs to, for colour-coding the timeline. */
  act: 'framing' | 'simple' | 'colour' | 'entropy' | 'fourier' | 'jpeg' | 'conclusions'
  /** Shown for the entries the talk actually builds on. */
  keystone?: boolean
}

export const TIMELINE: TimelineEntry[] = [
  {
    year: 1822,
    who: 'Joseph Fourier',
    what: 'Any signal can be written as a sum of waves',
    act: 'fourier',
    keystone: true,
  },
  {
    year: 1948,
    who: 'Claude Shannon',
    what: 'Information has a measurable quantity — entropy sets the floor',
    act: 'framing',
    keystone: true,
  },
  {
    year: 1952,
    who: 'David Huffman',
    what: 'Optimal prefix codes, found as a student assignment',
    act: 'entropy',
    keystone: true,
  },
  {
    year: 1974,
    who: 'Ahmed, Natarajan & Rao',
    what: 'The discrete cosine transform',
    act: 'fourier',
    keystone: true,
  },
  {
    year: 1976,
    who: 'Rissanen & Pasco',
    what: 'Arithmetic coding — fractional bits per symbol',
    act: 'entropy',
  },
  {
    year: 1977,
    who: 'Ziv & Lempel',
    what: 'LZ77: repeat what you already sent',
    act: 'conclusions',
  },
  {
    year: 1984,
    who: 'Terry Welch',
    what: 'LZW — LZ78 made practical, and later infamous over patents',
    act: 'conclusions',
  },
  {
    year: 1992,
    who: 'The JPEG committee',
    what: 'ITU-T T.81 — the pipeline this deck rebuilds',
    act: 'jpeg',
    keystone: true,
  },
  {
    year: 1994,
    who: 'Burrows & Wheeler',
    what: 'A reversible sort that makes text more compressible',
    act: 'conclusions',
  },
  {
    year: 1996,
    who: 'Deutsch (RFC 1951)',
    what: 'Deflate — LZ77 plus Huffman, still everywhere',
    act: 'conclusions',
  },
  {
    year: 2009,
    who: 'Jarosław Duda',
    what: 'Asymmetric numeral systems: arithmetic ratios at Huffman speed',
    act: 'conclusions',
  },
  {
    year: 2016,
    who: 'Facebook / Collet',
    what: 'Zstandard ships ANS to everyone',
    act: 'conclusions',
  },
]
