import type { ProseRegistry } from './types'
import { PEOPLE } from './people'

export const ACT6_PROSE: ProseRegistry = {
  'many-techniques': {
    learner:
      'Almost everything in this talk was one of two moves. Lossless techniques keep every bit ' +
      'and spend fewer of them; lossy techniques throw away what a particular viewer will not ' +
      'miss. And almost every pipeline, either kind, finishes the same way: an entropy coder ' +
      'wringing the last redundancy out of whatever the earlier stages leave behind.',
    more: {
      title: 'The two families',
      blocks: [
        {
          kind: 'list',
          items: [
            'Lossless: entropy codes (Huffman), dictionaries (LZ77), run-length, and reversible transforms (colour, DCT, zigzag).',
            'Lossy: perceptual coding (subsampling, quantisation), palettes, and summarisation.',
          ],
        },
        {
          kind: 'para',
          text:
            'The transform stages are themselves lossless — the DCT and the colour change lose ' +
            'nothing. It is the quantiser after them that discards, which is why the same DCT ' +
            'serves a lossless and a lossy pipeline depending only on what follows it.',
        },
      ],
    },
  },

  reframing: {
    learner:
      'Look back at what actually produced the gains. Palettising turned colours into indices. ' +
      'Splitting planes changed only the order bytes were visited in. YCbCr separated brightness ' +
      'from colour so they could be treated differently. The DCT changed pixels into ' +
      'frequencies. Zigzag changed the order of the coefficients. In every case the encoder ' +
      'stayed simple and the data was reframed until the simple encoder worked — which is a ' +
      'habit worth carrying well beyond compression.',
  },

  tradeoffs: {
    learner:
      'No scheme is free, and none is best everywhere. Every lossless coder is a bet on the data ' +
      'it will meet: brittle ones hard-code the bet and win big or lose badly; robust ones ' +
      'measure and adapt, paying for a model they must transmit. Around that sit the ordinary ' +
      'trades — ratio against speed, against the table you ship, against being understood by ' +
      'every device in the world. That last one is why JPEG is still the default.',
    more: {
      title: 'Who decides what was lost?',
      blocks: [
        {
          kind: 'fact',
          text:
            'PSNR and SSIM are both just models of a human viewer — and they disagree, with each ' +
            'other and with real eyes. Chroma subsampling only “works” because human colour ' +
            'vision is poor; it would be wrong for an eagle.',
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/Structural_similarity_index_measure',
          label: 'SSIM — modelling the viewer',
        },
      ],
    },
  },

  'entropy-limit': {
    learner:
      'Shannon showed in 1948 that every source has an entropy — a bits-per-symbol floor set by ' +
      'how predictable it is — and no lossless code can beat it on average. Compression is the ' +
      'craft of getting close, never passing. It is also why a scheme that shortens some inputs ' +
      'must lengthen others: there are not enough short outputs to go round.',
    more: {
      title: 'The floor, and the man who found it',
      blocks: [
        PEOPLE.shannon,
        {
          kind: 'fact',
          text:
            'Shannon juggled while riding a unicycle through the halls of Bell Labs, and built a ' +
            'maze-solving mechanical mouse — one of the first demonstrations of machine learning, ' +
            'decades before the phrase existed.',
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/A_Mathematical_Theory_of_Communication',
          label: 'A Mathematical Theory of Communication (1948)',
        },
      ],
    },
  },

  wider: {
    learner:
      'The same skeleton — transform, quantise, entropy-code — reappears far beyond still ' +
      'images. Audio swaps the eye for the ear; video is JPEG-like frames plus a prediction of ' +
      'the motion between them; and for data meant for a machine, nothing can be discarded, so ' +
      'zip, zstd and brotli decorrelate first and entropy-code second. Different first stage, ' +
      'same last stage.',
    more: {
      title: 'A little more on each',
      blocks: [
        {
          kind: 'list',
          items: [
            'Audio: the MDCT works on overlapping windows so blocks do not click at their seams; a psychoacoustic model quantises hardest what you cannot hear.',
            'General data: LZ77 replaces repeats with back-references, the Burrows–Wheeler transform sorts text so similar contexts cluster, and modern coders finish with ANS.',
            'After JPEG: WebP, AVIF, HEIC and JPEG XL mostly win by predicting each block from its neighbours and replacing fixed Huffman tables with arithmetic coding — several are single frames of a video codec.',
          ],
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/JPEG_XL',
          label: 'JPEG XL, AVIF and what came after JPEG',
        },
      ],
    },
  },

  end: {
    learner:
      'Thank you for watching. This deck stays live — every control still works, and any slide ' +
      'can be linked to directly — and the repository includes a survey of the techniques ' +
      'covered and the pipelines real formats assemble them from.',
  },
}
