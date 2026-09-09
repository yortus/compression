import type { ProseRegistry } from './types'
import { PEOPLE } from './people'

/**
 * Acts 3, 4 and 5 — entropy coding, the transform, and the assembled codec.
 *
 * These three acts run together as one argument, so their words live in one file: the
 * entropy coder is introduced needing runs it does not have, the transform is what
 * manufactures them, and the JPEG act is where the bill is added up.
 */
export const ACT345_PROSE: ProseRegistry = {
  'huffman-codes': {
    learner:
      'Count how often each symbol occurs, then give the common ones short bit patterns and the ' +
      'rare ones long ones. Step through it and the message becomes a ribbon of bits several ' +
      'times shorter, then decodes back to exactly the text it came from, nothing lost. Two ' +
      'things to watch: what counts as a *symbol* is a choice taken before any compression, and ' +
      'it is language-specific; and the decoder needs the code table, so on a short text the ' +
      'table is the bigger half of the message.',
    more: {
      title: 'The student who beat his professor',
      blocks: [
        PEOPLE.huffman,
        {
          kind: 'fact',
          text:
            'Huffman codes are optimal only among codes that give each symbol a whole number of ' +
            'bits. A symbol that deserves 0.2 bits still costs a whole one — the gap arithmetic ' +
            'coding and ANS were invented to close.',
        },
        {
          kind: 'para',
          text:
            'Real formats do not ship the tree as bit strings: they send canonical code lengths ' +
            'and rebuild it. JPEG goes further and puts standard tables in the specification, so ' +
            'ordinary files send no table at all.',
        },
      ],
    },
  },
  'lz77': {
    learner:
      'RLE only collapses repeats that touch; Huffman only cares how *often* a symbol appears, ' +
      'never where. LZ77 is the third answer: anything already seen within a window can be ' +
      'pointed at with a back-reference — go back this far, copy this much. Every curve on the ' +
      'left is one. Shrink the window and the long matches stop being reachable; widen it and ' +
      'every match pays for the reach. On its own it barely pays on prose — but pair it with ' +
      'Huffman and you have DEFLATE, which is gzip, zip and PNG.',
    more: {
      title: 'The L, the Z, and the other half of gzip',
      blocks: [
        PEOPLE.ziv,
        PEOPLE.lempel,
        {
          kind: 'fact',
          text:
            'LZ77 reached the world through PKZIP: Phil Katz reverse-engineered a rival format ' +
            'in the 1980s, gave everyone the .zip, and named the tool after himself. He died at ' +
            '37; the ZIP is still everywhere.',
        },
        {
          kind: 'link',
          href: 'https://www.rfc-editor.org/rfc/rfc1951',
          label: 'DEFLATE — RFC 1951 (LZ77 + Huffman)',
        },
      ],
    },
  },
  'waves-intro': {
    learner:
      'Before any of this is about compression: any list of numbers at all can be written as a ' +
      'sum of fixed cosine waves, from a flat line to the fastest wiggle the samples can hold. ' +
      'The waves never change — only how much of each you need. Draw your own and watch: smooth ' +
      'signals need very few, a single spike needs nearly all of them.',
    more: {
      title: 'The man who heard shapes as waves',
      blocks: [
        PEOPLE.fourier,
        {
          kind: 'fact',
          text:
            'Fourier also gave the first description of what we now call the greenhouse effect, ' +
            'in the 1820s — from the very same study of how heat moves that produced his waves.',
        },
      ],
    },
  },
  'waves-2d': {
    learner:
      'The same idea, one axis richer. A 2-D shape — an 8×8 block of an image — is a sum of fixed ' +
      'cosine patterns, exactly the way a signal was a sum of cosine waves. Two views of each: the ' +
      'flat pixels, and the same values lifted into a height surface, so you can see the shape as ' +
      'the waves it is made of. Drag the slider to keep fewer patterns and watch the reconstruction ' +
      'blur; a smooth ramp needs almost none, a checker needs nearly all. This is the exact operation ' +
      'JPEG performs on every block, and the next two slides are about the patterns themselves.',
  },
  'dct-1d': {
    learner:
      'Now put a cost on it. There are two separate lossy decisions in a transform codec and this ' +
      'slide has one knob for each: how many coefficients you keep, and how precisely you store the ' +
      'ones you keep. Dropping the tail is nearly free when the tail is small — which is a fact ' +
      'about real data, not about the transform. Try it on the spike preset, where every ' +
      'coefficient is the same size and there is nothing safe to drop. The transform here is ' +
      'DCT-II, exactly the one JPEG uses; JPEG just runs it in two dimensions.',
  },
  'basis-64': {
    learner:
      'The whole per-block round trip, in one animation. Forward: the block flies apart into the ' +
      '64 fixed patterns it is made of — the DCT, nothing lost yet. Again: quantisation, and ' +
      'every coefficient that rounded to zero fades out, which at ordinary quality is most of ' +
      'them. Again: the survivors fly back into a picture nearly, but not quite, the original. ' +
      'Drag quality and the middle act changes; click any block to try another. One cost is left ' +
      'out on purpose — saying *which* patterns survived — and that is the next slide.',
    more: {
      title: 'The transform nobody would fund',
      blocks: [
        PEOPLE.ahmed,
        {
          kind: 'fact',
          text:
            'The reconstruction panel is real, not a trick: DCT coefficients are signed, so ' +
            'blending the flying sprites would look right while being wrong. It runs an actual ' +
            'inverse DCT, weighted by each sprite, on every frame.',
        },
      ],
    },
  },
  'blocks': {
    learner:
      'From here the pipeline stops looking at the picture and starts looking at 8×8 blocks. ' +
      'Every one of them goes through the whole chain independently — transform, quantise, ' +
      'scan, run-length, entropy code — which is what makes JPEG parallelisable, and also what ' +
      'makes its artefacts square. Click any block to follow it through the next five slides.',
    more: {
      title: 'Why eight',
      blocks: [
        {
          kind: 'para',
          text:
            'Eight is a compromise that has outlived its reasons. A larger block decorrelates ' +
            'better — more of the image described by fewer coefficients — but costs more ' +
            'arithmetic per block, spreads any error over a wider area, and reacts worse to an ' +
            'edge crossing it. In 1992, 8×8 was also what fit comfortably in the registers and ' +
            'caches of the day. Modern codecs, with modern silicon, choose per region: HEVC and ' +
            'AV1 pick transform sizes from 4×4 up to 32×32 or 64×64 by content.',
        },
        {
          kind: 'para',
          text:
            'Blocking is why JPEG fails the way it does. Each block is quantised without ' +
            'reference to its neighbours, so at low quality the reconstruction does not agree ' +
            'with itself across the boundary and you see the grid. Later codecs spend real ' +
            'effort on deblocking filters for exactly this.',
        },
      ],
    },
  },
  'dct-2d': {
    learner:
      'The transform itself: sixty-four pixel values in, sixty-four coefficients out. The ' +
      'top-left coefficient is the block’s average brightness; right and down are increasing ' +
      'horizontal and vertical frequency. Nothing has been thrown away and nothing saved yet — ' +
      'both grids hold 64 numbers. What has changed is that the numbers are now sorted by how ' +
      'much they matter, which is what makes the next step possible.',
    more: {
      title: 'A rotation that costs nothing and buys everything',
      blocks: [
        {
          kind: 'para',
          text:
            'The DCT is invertible and, in exact arithmetic, lossless — it is a change of basis, ' +
            'not a compression step. What it buys is that natural images have most of their ' +
            'energy at low frequencies, so in the new basis a handful of coefficients carry ' +
            'nearly all of the block and the rest are small. Quantisation is what turns "small" ' +
            'into "zero", and it is the only stage that loses anything.',
        },
        {
          kind: 'para',
          text:
            'Measured on this deck’s own pipeline, the DCT also *reduces* order-0 entropy rather ' +
            'than leaving it alone — decorrelating the samples is exactly what makes a ' +
            'memoryless coder do better. That surprised an earlier version of the finale slide, ' +
            'which asserted the opposite.',
        },
        {
          kind: 'para',
          text:
            'The −128 level shift lives inside forwardDCT/inverseDCT here, not in the colourspace ' +
            'stage: Y, Cb and Cr stay in 0–255 through subsampling and block splitting.',
        },
      ],
    },
  },
  'quantisation': {
    learner:
      'Quantisation divides each coefficient by a number from a table and rounds. The table has ' +
      'bigger divisors for the higher frequencies, because that is where the eye notices least, so ' +
      'most high-frequency coefficients round straight to zero. This is the step where the loss in ' +
      '"lossy" happens — and the step that creates the long runs of zeros the rest of the pipeline ' +
      'is about to exploit.',
    more: {
      title: 'The only lossy step',
      blocks: [
        {
          kind: 'para',
          text:
            'Each coefficient is divided by its own entry in the quantisation table and rounded ' +
            'to the nearest integer. The table’s divisors grow towards the high frequencies, so ' +
            'the coefficients describing fine detail are the ones that round to zero first. ' +
            'Lower quality means larger divisors, more zeros, a smaller file, and more visible ' +
            'artefacts — and that is the whole of the quality slider.',
        },
        {
          kind: 'para',
          text:
            'Everything else in JPEG is exactly reversible. The colour transform, the block ' +
            'split, the DCT, the zigzag, the run-length and the entropy coding all give back ' +
            'what they were given. This stage is where the information goes, which is why the ' +
            'table — not the coder — is where a codec encodes its model of what you can see.',
        },
        {
          kind: 'para',
          text:
            'The standard luminance table is in the specification and is scaled by quality here ' +
            'the way libjpeg scales it. Chroma gets its own, coarser table, on the same argument ' +
            'that justifies subsampling.',
        },
      ],
    },
  },
  'rle-on-coeffs': {
    learner:
      'Run-length encoding is back, and this is the callback: in Act 1 it failed on a photograph ' +
      'because neighbouring bytes were almost never identical. Nothing about RLE has improved. What ' +
      'changed is that quantisation has driven most of the coefficients to exactly zero, so the runs ' +
      'RLE needs are now guaranteed to be there. JPEG does not rely on a property of the data — it ' +
      'manufactures it.',
    more: {
      title: 'What JPEG’s run-length coder actually emits',
      blocks: [
        {
          kind: 'para',
          text:
            'Each non-zero AC coefficient becomes a pair: (skip, value), where skip is how many ' +
            'zeros preceded it. The zeros are never written down — they are counted. And the ' +
            'long tail of zeros at the end of a block is not even counted: a single end-of-block ' +
            'symbol says "everything remaining is zero", which is the cheapest thing in the ' +
            'format and the reason quantisation and zigzag are worth doing in that order.',
        },
        {
          kind: 'para',
          text:
            'This is the same technique as the run-length slide in the Codes act, pointed at ' +
            'different data. It failed on raw pixels and works here, because quantisation has ' +
            'manufactured exactly the runs it needs — which is the deck’s argument in one ' +
            'sentence: the encoder did not get cleverer, the data got reframed.',
        },
      ],
    },
  },
  'zigzag': {
    learner:
      'The surviving coefficients are all in one corner of the block, but a run-length coder ' +
      'only sees the order you hand it. Read row by row and consecutive coefficients are ' +
      'separated by whatever the row stride leaves — fives, sixes, thirteens, each its own ' +
      'symbol. Read along the diagonals and they sit next to each other, so nearly every gap is ' +
      'zero and the alphabet collapses onto one common symbol. Nothing computed, nothing ' +
      'discarded: the saving is entirely in the order.',
  },
  'jpeg-pipeline': {
    learner:
      'The whole chain, measured on whatever image is loaded. Each row is priced the same way — ' +
      'what an order-0 entropy coder would need at that point — so the rows are comparable. The ' +
      'row to stop on is the DCT: it discards nothing, yet the size drops, because a memoryless ' +
      'coder does far better on decorrelated coefficients than on raw pixels. No single stage ' +
      'here is the compressor.',
    more: {
      title: 'Reading the table honestly',
      blocks: [
        {
          kind: 'fact',
          text:
            'The DCT row discards nothing, yet the file shrinks sharply. A rotation does not ' +
            'preserve order-0 entropy — decorrelating the samples is exactly what lets a ' +
            'memoryless coder do better. Measure it; do not assume it.',
        },
        {
          kind: 'list',
          items: [
            'Quantisation is the only lossy stage; everything else is exactly reversible.',
            'Zigzag and RLE only collect the zeros quantisation manufactured.',
            'No single stage is the compressor — the ratio is the product of all of them.',
          ],
        },
      ],
    },
  },
  'jpeg-result': {
    learner:
      'The finished article: original against reconstruction, at whatever quality you choose. ' +
      'Drag quality down and the artefacts arrive in order — blockiness at the 8×8 boundaries, ' +
      'ringing along sharp edges, colour smearing before luminance. That order is the ' +
      'pipeline’s priorities showing through.',
    more: {
      title: 'Decoding is the pipeline backwards',
      blocks: [
        {
          kind: 'fact',
          text:
            '“JPEG is lossy” is true of the format, not every file: at top quality with no ' +
            'chroma subsampling, some images decode back bit-for-bit identical — and the badge ' +
            'says so.',
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/JPEG',
          label: 'JPEG — the standard and its history',
        },
      ],
    },
  },
}
