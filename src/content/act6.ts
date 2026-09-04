import type { ProseRegistry } from './types'

export const ACT6_PROSE: ProseRegistry = {
  'wider-audio': {
    speaker: 'Same skeleton, different sense. MDCT plus a model of the listener.',
    learner:
      'MP3 and AAC are built the same way JPEG is: transform, quantise, entropy-code. The ' +
      'transform is the MDCT, which works on overlapping windows so the blocks do not click ' +
      'audibly at their joins, and the quantisation is steered by a psychoacoustic model that ' +
      'predicts which sounds you will not notice missing. Swap the model of the human and the ' +
      'rest of the machinery is recognisably the same.',
  },
  'wider-general': {
    speaker: 'No eyes or ears to exploit — so decorrelate, then entropy-code.',
    learner:
      'When the data is not for a human — source code, logs, JSON — nothing can be discarded, ' +
      'so lossless schemes work by making the data more predictable before coding it. LZ77 ' +
      'replaces repeats with back-references, the Burrows–Wheeler transform reversibly sorts ' +
      'text so similar contexts cluster, and modern coders finish with ANS. Different first ' +
      'stage, same last stage.',
  },
  modern: {
    speaker: 'Better prediction, better entropy coding. JPEG still wins on compatibility.',
    learner:
      'WebP, AVIF, HEIC and JPEG XL all beat JPEG, mostly by predicting each block from its ' +
      'neighbours before transforming, and by replacing fixed Huffman tables with adaptive ' +
      'arithmetic coding. Several of them are single frames of a video codec. And JPEG is still ' +
      'the default almost everywhere, because being understood by everything is worth more than ' +
      'twenty percent.',
  },
  'brittle-vs-robust': {
    speaker: 'Same encoder, 10.6:1 and 0.50:1. Ask why before answering it.',
    learner:
      'Run-length encoding was spectacular on one image and worse than useless on another, ' +
      'while the transform pipeline behaves much the same on all of them. That difference is ' +
      'not luck. A lossless codec that shortens some inputs must lengthen others — there are ' +
      'fewer short strings than long ones — so every scheme is a bet about the data it will ' +
      'meet. Brittle schemes hard-code that bet; robust ones measure the data and adapt, paying ' +
      'for a model they have to transmit. And JPEG does something better still: rather than ' +
      'hoping its data has runs, it manufactures them.',
  },
  'lossiness-subjective': {
    speaker: 'Lossy is a claim about people. Every codec contains a model of you.',
    learner:
      'There is nothing in the data that says which bits matter. Lossy compression works by ' +
      'discarding what a particular observer will not notice, which makes every lossy format a ' +
      'theory of human perception with a file extension. The metrics we use to check it — PSNR, ' +
      'SSIM — are themselves models, and they disagree with each other and with actual viewers.',
  },
  reframing: {
    speaker: 'Every win came from changing what the numbers mean. Not from cleverer bit-packing.',
    learner:
      'Look back at what actually produced the gains. Palettising turned colours into indices. ' +
      'Splitting planes changed only the order bytes were visited in. YCbCr separated brightness ' +
      'from colour so they could be treated differently. The DCT changed pixels into ' +
      'frequencies. Zigzag changed the order of the coefficients. In every case the encoder ' +
      'stayed simple and the data was reframed until the simple encoder worked — which is a ' +
      'habit worth carrying well beyond compression.',
  },
  end: {
    speaker: 'Links, the survey table, and questions.',
    learner:
      'The deck stays live: every control still works, and any slide can be linked to directly. ' +
      'The repository also contains a survey of twenty-two compression techniques and the ' +
      'pipelines real formats assemble them into.',
  },
}
