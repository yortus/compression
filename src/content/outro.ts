/**
 * The outro is bullet slides: one idea per slide, said in as few words as the back row can
 * read, with every elaboration behind Learn More. The words live here so the slides share
 * one component and one look.
 */

export interface BulletGroup {
  /** Column heading, e.g. "Lossless" / "Lossy". Omit for a single ungrouped list. */
  heading?: string
  tone?: 'good' | 'warn' | 'neutral'
  items: string[]
}

export interface BulletSlideContent {
  /** One line above the bullets. */
  lead?: string
  groups: BulletGroup[]
}

export const OUTRO: Record<string, BulletSlideContent> = {
  'many-techniques': {
    lead: '',
    groups: [
      {
        heading: 'Lossless - keep everything',
        tone: 'good',
        items: [
          'Entropy codes: Huffman',
          'Dictionaries: LZ77',
          'Run-length: RLE',
          'Reversible transforms: colour, DCT, zigzag',
        ],
      },
      {
        heading: 'Lossy - keep what humans notice',
        tone: 'warn',
        items: [
          'Psychovisuals: subsampling, quantisation',
          'Palettes',
          'Summaries',
        ],
      },
    ],
  },

  tradeoffs: {
    lead: '',
    groups: [
      {
        heading: 'Every scheme is a bet',
        tone: 'good',
        items: [
          'Does it work for all data shapes?',
          'Is it safe to lose anything?',
          'Do we need to send the primer?',
          'Is the data bigger than the primer?',
          'Does it need to be fast?',
        ],
      },
    ],
  },

  'entropy-limit': {
    lead: '',
    groups: [
      {
        heading: 'Entropy is the limit, unless we cheat',
        tone: 'good',
        items: [
          'Pure noise and perfect compression are indistinguishable',
          'Shortening some inputs means lengthening others',
          'Spend fewer bits on the likely, more on the rare',
          'Cheat: agree on a primer beforehand',
          'Cheat more: exploit the human eye',
        ],
      },
    ],
  },

  wider: {
    lead: 'Whole other talks, mostly the same ideas.',
    groups: [
      {
        heading: 'Lossless - for the data',
        tone: 'good',
        items: [
          'Files: zip, zstd, brotli',
          'On the wire: HTTP, delta encoding',
        ],
      },
      {
        heading: 'Lossy - for the senses',
        tone: 'warn',
        items: [
          'Audio: MP3, AAC, psychoacoustics',
          'Video: H.264, AV1, motion between frames',
        ],
      },
    ],
  },
}

export interface OutroLink {
  label: string
  href: string
}

/** The closing slide's links. Presenter: add your own repo / slides URL here. */
export const THANK_YOU_LINKS: OutroLink[] = [
  {
    label: 'Shannon - A Mathematical Theory of Communication',
    href: 'https://en.wikipedia.org/wiki/A_Mathematical_Theory_of_Communication',
  },
  { label: 'How JPEG works', href: 'https://en.wikipedia.org/wiki/JPEG' },
  { label: 'Huffman coding', href: 'https://en.wikipedia.org/wiki/Huffman_coding' },
  {
    label: 'ITU-T T.81 - the JPEG standard',
    href: 'https://www.w3.org/Graphics/JPEG/itu-t81.pdf',
  },
]
