import type { LearnMoreBlock } from './types'

/**
 * The people behind the techniques, defined once and shared between the slides that lean on
 * them (Fourier appears on both the waves slide and the timeline, Shannon on entropy-limit
 * and the timeline). Each is a ready-made `person` Learn More block.
 *
 * `portrait` is a filename in public/portraits/ — only the four with a freely-licensed photo
 * carry one; the rest render as a monogram, on purpose, rather than shipping a picture whose
 * licence we cannot stand behind. See public/portraits/CREDITS.md for attribution.
 */
type Person = Extract<LearnMoreBlock, { kind: 'person' }>

export const PEOPLE = {
  fourier: {
    kind: 'person',
    name: 'Joseph Fourier',
    life: '1768–1830',
    role: 'French mathematician & physicist',
    portrait: 'fourier.jpg',
    blurb:
      'Studying how heat creeps through metal, he claimed any signal at all is a sum of ' +
      'simple waves. Contemporaries thought it could not be true; it now underpins JPEG, ' +
      'MP3, MRI and Wi-Fi.',
    href: 'https://www.youtube.com/watch?v=spUNpyF58BY',
  },
  shannon: {
    kind: 'person',
    name: 'Claude Shannon',
    life: '1916–2001',
    role: 'Founder of information theory',
    portrait: 'shannon.jpg',
    blurb:
      'One 1948 paper invented the bit, defined information as entropy, and set the hard ' +
      'floor no lossless coder can beat — the number every codec in this talk is chasing.',
    href: 'https://en.wikipedia.org/wiki/A_Mathematical_Theory_of_Communication',
  },
  huffman: {
    kind: 'person',
    name: 'David Huffman',
    life: '1925–1999',
    role: 'Optimal prefix codes, 1952',
    blurb:
      'A graduate student who was offered a choice: sit the final exam, or find the best ' +
      'possible code. He found it — cracking a problem his professor Robert Fano could not — ' +
      'and it is still inside every JPEG, MP3 and ZIP.',
    href: 'https://www.quantamagazine.org/how-lossless-data-compression-works-20230531/',
  },
  ziv: {
    kind: 'person',
    name: 'Jacob Ziv',
    life: '1931–2023',
    role: 'LZ77, with Abraham Lempel',
    portrait: 'ziv.jpg',
    blurb:
      'With Abraham Lempel he published LZ77 in 1977: replace anything already seen with a ' +
      'short back-reference. It is the "Z" in gzip, PNG and ZIP.',
    href: 'https://en.wikipedia.org/wiki/LZ77_and_LZ78',
  },
  lempel: {
    kind: 'person',
    name: 'Abraham Lempel',
    life: '1936–2023',
    role: 'LZ77 and LZ78',
    portrait: 'lempel.jpg',
    blurb:
      'Co-author of the two dictionary methods — LZ77 (1977) and LZ78 (1978) — that sit ' +
      'underneath almost all general-purpose compression to this day.',
    href: 'https://en.wikipedia.org/wiki/LZ77_and_LZ78',
  },
  ahmed: {
    kind: 'person',
    name: 'Nasir Ahmed',
    life: 'b. 1940',
    role: 'The discrete cosine transform',
    blurb:
      'Proposed the DCT in 1972. His funding application was turned down as too impractical, ' +
      'so he published it anyway in 1974 — it is now perhaps the most-computed transform on ' +
      'Earth, in every JPEG and every video frame.',
    href: 'https://en.wikipedia.org/wiki/Discrete_cosine_transform',
  },
} satisfies Record<string, Person>
