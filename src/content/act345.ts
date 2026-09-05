import type { ProseRegistry } from './types'

/**
 * Acts 3, 4 and 5 — entropy coding, the transform, and the assembled codec.
 *
 * These three acts run together as one argument, so their words live in one file: the
 * entropy coder is introduced needing runs it does not have, the transform is what
 * manufactures them, and the JPEG act is where the bill is added up.
 */
export const ACT345_PROSE: ProseRegistry = {
  'huffman-codes': {
    speaker: 'Common things get short codes, rare things get long ones. Swap the text and watch the number move.',
    learner:
      'Huffman coding is the entropy coder JPEG finishes with, and the idea fits in one line: ' +
      'count how often each symbol occurs, then give the common ones short bit patterns and the ' +
      'rare ones long ones. Step through it — the message is cut into tokens, repeats share a ' +
      'colour, every distinct token flies down into a frequency table, each one collects a code, ' +
      'the message becomes a ribbon of bits several times shorter, and the ribbon decodes back to ' +
      'exactly the text it came from. Nothing is lost anywhere in that loop. Two things are worth ' +
      'watching rather than being told. The first is the picker: what counts as a *symbol* is a ' +
      'decision taken before any compression happens, and it is language-specific — English pays ' +
      'off coded by word, Chinese by character, and the ASCII noise pays off under neither, ' +
      'because there is no repetition to exploit and the ratio collapses to almost nothing. The ' +
      'second is the second bar under the badge: the decoder cannot read a single bit without the ' +
      'code table, so the table is part of the message, and on a short text it is the bigger half.',
  },
  'waves-intro': {
    speaker: 'Any signal is a sum of fixed cosines. Drag the slider, watch it assemble.',
    learner:
      'Before any of this is about compression: any list of numbers at all can be written as a sum ' +
      'of fixed cosine waves, from a flat line through to the fastest wiggle the samples can ' +
      'represent. The waves never change — only how much of each one you need. Drag on the signal ' +
      'to draw your own and watch how many waves it takes to reproduce. Smooth signals need very ' +
      'few; a sharp edge or a single spike needs nearly all of them, because a corner is built out ' +
      'of every frequency at once.',
  },
  'dct-1d': {
    speaker: 'Same decomposition, now with a price. Two knobs: how many, and how precisely.',
    learner:
      'Now put a cost on it. There are two separate lossy decisions in a transform codec and this ' +
      'slide has one knob for each: how many coefficients you keep, and how precisely you store the ' +
      'ones you keep. Dropping the tail is nearly free when the tail is small — which is a fact ' +
      'about real data, not about the transform. Try it on the spike preset, where every ' +
      'coefficient is the same size and there is nothing safe to drop. The transform here is ' +
      'DCT-II, exactly the one JPEG uses; JPEG just runs it in two dimensions.',
  },
  'basis-2d': {
    speaker: 'No new idea here. The 64 patterns are every pairing of the same eight waves.',
    learner:
      'This is the step between one dimension and two, and it is smaller than it looks. A block ' +
      'is not a line, so the cosines from the last two slides cannot be applied to it directly — ' +
      'but nothing new has to be invented. Take the same eight waves running down the block, take ' +
      'the same eight running across, and multiply every pairing of them together: that is all 64 ' +
      'of JPEG’s patterns, and the animation is doing exactly that multiplication rather than ' +
      'illustrating it. Click any pattern to see the two waves it came from. This also explains a ' +
      'practical thing about encoders: because the patterns are products, the two-dimensional ' +
      'transform separates into eight one-dimensional transforms along the rows and eight down the ' +
      'columns, which is enormously cheaper than treating a block as one 64-value vector.',
  },
  'basis-64': {
    speaker: 'Arrow keys drive it: fly apart, quantise, fly back. Pick any block from the image.',
    learner:
      'The whole per-block round trip, in one animation. Press forward and the block flies apart ' +
      'into the 64 fixed patterns it is made of — that is the forward DCT, and nothing has been ' +
      'lost yet. Press again and quantisation happens: every coefficient that rounded to zero ' +
      'fades out and stays behind, which at ordinary quality settings is most of them. Press again ' +
      'and the survivors fly back together into a picture that is nearly, but not quite, the one ' +
      'we started with. They arrive coarsest first, so you can watch the block appear as a blur ' +
      'and then sharpen. Drag the quality slider and the middle act changes: at low quality only a ' +
      'handful of patterns make the journey, and the error at the end grows to match. Click any ' +
      'block in the image on the left to try another one — flat sky needs almost nothing, and a ' +
      'sprite with hard edges shows the ringing that JPEG is famous for. One cost is missing from ' +
      'the numbers here on purpose: the encoder still has to say which patterns survived, and ' +
      'that turns out to be the interesting part. It is what the next two slides are about.',
  },
  'quantisation': {
    speaker: 'Divide and round. This is the only place image quality is actually spent.',
    learner:
      'Quantisation divides each coefficient by a number from a table and rounds. The table has ' +
      'bigger divisors for the higher frequencies, because that is where the eye notices least, so ' +
      'most high-frequency coefficients round straight to zero. This is the step where the loss in ' +
      '"lossy" happens — and the step that creates the long runs of zeros the rest of the pipeline ' +
      'is about to exploit.',
  },
  'rle-on-coeffs': {
    speaker: 'RLE again — but this time the runs were manufactured, not hoped for.',
    learner:
      'Run-length encoding is back, and this is the callback: in Act 1 it failed on a photograph ' +
      'because neighbouring bytes were almost never identical. Nothing about RLE has improved. What ' +
      'changed is that quantisation has driven most of the coefficients to exactly zero, so the runs ' +
      'RLE needs are now guaranteed to be there. JPEG does not rely on a property of the data — it ' +
      'manufactures it.',
  },
  'zigzag': {
    speaker: 'Toggle the scan order. Same pair count — watch the gaps, not the pairs.',
    learner:
      'The surviving coefficients are all in one corner of the block, but a run-length coder can ' +
      'only see the order you hand it. The count of pairs is the same either way — one per ' +
      'surviving coefficient, plus an end-of-block marker — and that is worth noticing, because ' +
      'it is not where the saving comes from. What changes is the gaps between them. Read row by ' +
      'row and consecutive coefficients are separated by whatever the row stride leaves: fives, ' +
      'sixes, thirteens, each a separate symbol to describe. Read along the diagonals and they sit ' +
      'next to each other, so nearly every gap is zero and the alphabet collapses onto one very ' +
      'common symbol. Nothing is computed and nothing is discarded: the saving comes entirely from ' +
      'visiting the same 64 numbers in a different order.',
  },
  'jpeg-pipeline': {
    speaker: 'Every stage, priced on this image. Two of them go the wrong way — on purpose.',
    learner:
      'The whole chain, measured on whatever image is loaded. Each row is priced the same way — what ' +
      'an order-0 entropy coder would need for the representation at that point — so consecutive ' +
      'rows are comparable, and the last row is the real per-block Huffman figure the rest of the ' +
      'deck reports. The row worth stopping on is the DCT. It discards nothing at all, and the file ' +
      'still shrinks sharply — because a coder with no memory does far better on decorrelated ' +
      'coefficients than on neighbouring pixels. That is what transform coding is for, and it is ' +
      'what makes every row below it possible: quantisation only works because the transform sorted ' +
      'the numbers by how much they matter first. No single stage here is the compressor.',
  },
  'jpeg-result': {
    speaker: 'The A/B. Drag quality down until it hurts, and say where it hurts first.',
    learner:
      'The finished article: original against reconstruction, at whatever quality you choose. Drag ' +
      'the quality down and the artifacts arrive in a specific order — blockiness at the 8×8 ' +
      'boundaries, ringing along sharp edges, and colour smearing before luminance goes. That order ' +
      'is not accidental; it is the pipeline’s priorities showing through.',
  },
}
