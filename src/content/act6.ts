import type { ProseRegistry } from './types'

export const ACT6_PROSE: ProseRegistry = {
  'many-techniques': {
    learner:
      'Almost everything in this talk was one of two moves. Lossless techniques — Huffman ' +
      'codes, LZ77 back-references, run-length counts, and the reversible transforms that ' +
      'reshape data without dropping any of it — keep every bit and simply spend fewer of ' +
      'them. Lossy techniques — chroma subsampling, DCT quantisation, palettes, summaries — ' +
      'throw away what a particular viewer will not miss. And almost every pipeline, either ' +
      'kind, finishes the same way: an entropy coder wringing the last redundancy out of ' +
      'whatever the earlier stages leave behind.',
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
      'No scheme is free, and none is best everywhere. A lossless coder that shortens some ' +
      'inputs must lengthen others, so every scheme is a bet on the data it will meet: brittle ' +
      'ones hard-code that bet and either win big or lose badly, robust ones measure the data ' +
      'and adapt, paying for a model they then have to transmit. Around that sit the ordinary ' +
      'engineering trades — ratio against speed, ratio against the code table or palette you ' +
      'must ship, and ratio against being understood by every device in the world, which is why ' +
      'JPEG is still the default thirty years on.',
    more: {
      blocks: [
        {
          kind: 'para',
          text:
            'Lossy carries a trade the others do not: what counts as "lost" is a fact about the ' +
            'observer, not the data. PSNR and SSIM are both models of that observer, and they ' +
            'disagree with each other and with real viewers — chroma subsampling only works ' +
            'because human colour acuity is poor, and would be wrong for an eye built differently.',
        },
      ],
    },
  },

  'entropy-limit': {
    learner:
      'Shannon showed in 1948 that every source has an entropy — a bits-per-symbol floor set by ' +
      'how predictable it is — and no lossless code can beat it on average. Compression is the ' +
      'craft of getting close: spend short codes on the likely symbols and long ones on the ' +
      'rare, and you approach the floor but never pass it. It is also why a scheme that shortens ' +
      'some inputs must lengthen others — there are not enough short outputs to go round — so the ' +
      'only honest strategy is to measure the data and match its statistics.',
    more: {
      blocks: [
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/A_Mathematical_Theory_of_Communication',
          label: 'Shannon, A Mathematical Theory of Communication (1948)',
        },
      ],
    },
  },

  wider: {
    learner:
      'The same skeleton — transform, quantise, entropy-code — reappears far beyond still ' +
      'images. Audio codecs like MP3 and AAC swap the eye for the ear: an overlapping cosine ' +
      'transform and a psychoacoustic model in place of the DCT and its quantisation table. ' +
      'Video is JPEG-like frames plus a prediction of the motion between them. And where the ' +
      'data is for a machine rather than a person — source, logs, JSON — nothing can be ' +
      'discarded, so zip, zstd and brotli decorrelate first and entropy-code second. Different ' +
      'first stage, same last stage.',
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
