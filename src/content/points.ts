/**
 * Card content for the narrative slides that carry an argument rather than a demo.
 * Keeping it here means those slides share one component and one look, and the words
 * can be rewritten without opening a .vue file.
 */

export interface PointCard {
  title: string
  body: string
  /** Optional short tag rendered in the card corner, e.g. a format or a date. */
  tag?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}

export interface PointsContent {
  /** One-line framing above the cards. */
  lead?: string
  cards: PointCard[]
  /** Closing line under the cards — usually the beat the presenter lands on. */
  punchline?: string
}

export const POINTS: Record<string, PointsContent> = {
  'wider-audio': {
    lead: 'Swap the sense organ and the same skeleton reappears.',
    cards: [
      {
        title: 'Overlapping transform',
        body: 'MP3 and AAC use the MDCT — a cosine transform on overlapping windows, so blocks do not click at their seams the way 8×8 tiles would.',
        tag: 'transform',
      },
      {
        title: 'A model of the listener',
        body: 'A psychoacoustic model predicts what you cannot hear: quiet sounds next to loud ones, and everything under the threshold of hearing. Those bands get quantised hardest.',
        tag: 'perceptual',
        tone: 'warn',
      },
      {
        title: 'Then entropy coding',
        body: 'Huffman tables, exactly as in JPEG. The last stage is almost always the same stage.',
        tag: 'entropy',
      },
    ],
    punchline: 'Transform → quantise → entropy-code. Only the model of the human changes.',
  },

  'wider-general': {
    lead: 'With no eyes or ears to exploit, lossless data compression decorrelates instead.',
    cards: [
      {
        title: 'LZ77 — repeat yourself',
        body: 'Replace a repeated stretch with a back-reference: "go back 412 bytes and copy 9". A dictionary built out of the data itself, so nothing has to be agreed in advance.',
        tag: '1977',
      },
      {
        title: 'BWT — sort, then code',
        body: 'Burrows–Wheeler reversibly permutes the text so similar contexts cluster together. It compresses nothing on its own; it makes everything after it work better.',
        tag: '1994',
      },
      {
        title: 'ANS — the modern finish',
        body: 'Asymmetric numeral systems get arithmetic coding’s ratios at Huffman’s speed. It is why zstd and Brotli feel free to use them everywhere.',
        tag: '2009',
        tone: 'good',
      },
    ],
    punchline: 'Decorrelate, then entropy-code — the lossless mirror of the lossy skeleton.',
  },

  modern: {
    lead: 'Everything since JPEG is the same pipeline with better parts.',
    cards: [
      {
        title: 'Better prediction',
        body: 'WebP, AVIF and HEIC predict each block from its neighbours first and code only the error. JPEG predicts nothing but the DC term.',
      },
      {
        title: 'Better entropy coding',
        body: 'Arithmetic and context-adaptive coders replace fixed Huffman tables, which is worth a large fraction of the gain on its own.',
      },
      {
        title: 'Stills are video frames',
        body: 'AVIF is one frame of AV1; HEIC is one frame of HEVC. The still-image formats are side effects of the video codecs.',
        tag: 'nested',
      },
      {
        title: 'JPEG is still winning',
        body: 'Thirty years on it remains the default, because compatibility beats compression ratio almost every time.',
        tone: 'warn',
      },
    ],
  },

  'lossiness-subjective': {
    lead: 'Lossy compression is a claim about people, not about data.',
    cards: [
      {
        title: 'The data does not care',
        body: 'Nothing in an image file knows which of its bits matter. "Imperceptible" is a fact about the observer, and every lossy codec is a theory of that observer.',
      },
      {
        title: 'The metrics disagree',
        body: 'PSNR measures arithmetic error, SSIM measures structural similarity, and neither reliably matches what a room full of people says it can see.',
        tag: 'PSNR / SSIM',
        tone: 'warn',
      },
      {
        title: 'Built for one species',
        body: 'Chroma subsampling exists because human colour acuity is poor. Give the job to a mantis shrimp, with its many more photoreceptor classes, and the codec is wrong.',
        tone: 'good',
      },
    ],
    punchline: 'Every lossy format has a model of you inside it.',
  },

  end: {
    lead: 'Where to go next.',
    cards: [
      {
        title: 'Play with this deck',
        body: 'Every slide is live. Change the image, drag the quality slider, pick a different block, and the numbers in the bar move with you.',
        tone: 'good',
      },
      {
        title: 'The survey table',
        body: 'docs/compression-techniques-survey.md lists twenty-two techniques and how real formats combine them into pipelines.',
        tag: 'repo',
      },
      {
        title: 'The classics',
        body: 'Shannon’s 1948 paper is still readable. Huffman’s is three pages. The JPEG spec (ITU-T T.81) is heavier going but surprisingly clear.',
        tag: 'reading',
      },
    ],
    punchline: 'Thank you — questions?',
  },
}
