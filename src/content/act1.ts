import type { ProseRegistry } from './types'

/**
 * Act 1 — run-length encoding, told through Windows BMP.
 *
 * The act used to invent its own toy codecs. Anchoring it to a real format is stronger,
 * because BMP settles the argument without our help: it has an uncompressed mode, a
 * palettised mode, and a run-length mode that works *only* on palettised images. We do
 * not have to claim that RLE needs a reframe first — the format's own compression field
 * says so, and has since 1990.
 */
export const ACT1_PROSE: ProseRegistry = {
  'rle-text': {
    speaker: 'Simplest possible scheme. Works on runs, fails on everything else.',
    learner:
      'Run-length encoding is about the simplest compression there is: instead of writing the ' +
      'same symbol over and over, write it once with a count. It is spectacular on data made of ' +
      'long runs and actively harmful on data without them — every single character costs two ' +
      'bytes instead of one. Try the presets: the same encoder halves one input and doubles another.',
  },
  'rle-two-way': {
    speaker: 'Every codec is a pair. Encode is worthless without decode.',
    learner:
      'Compression is always a two-way transform. The encoder is only half of it; what makes a ' +
      'scheme a codec rather than a mangling is that some decoder can walk the process backwards ' +
      'and get the original bytes back. Here the output is decoded live and compared against the ' +
      'input, character by character.',
  },
  'rle-primer': {
    speaker: 'Both sides need a shared convention. BMP’s is a count of zero.',
    learner:
      'A decoder cannot tell a count from a literal unless both sides already agree how to tell ' +
      'them apart. This version marks runs with an escape byte — and that agreement has a nasty ' +
      'edge: what if the data itself contains the escape byte? It has to be escaped too, which ' +
      'makes it more expensive than an ordinary byte. Real formats do exactly this. In a BMP, ' +
      'pixel data comes in pairs, and a count of zero is the escape: 00 00 ends the row, 00 01 ' +
      'ends the image, 00 02 is a jump, and 00 n means "n literal pixels follow". None of that is ' +
      'in the file — it is in the specification, which both ends read in advance.',
  },
  'bmp-rgb': {
    speaker: 'Real 24-bit bitmap. Run-length code it and watch it grow.',
    learner:
      'Here is an actual BMP: a 54-byte header and then three bytes a pixel, rows padded out to a ' +
      'four-byte boundary. Now point the run-length coder at it. In a photograph, neighbouring ' +
      'bytes are almost never exactly equal — one count of sensor noise ends a run — so the ' +
      'mean run length sits barely above one, and nearly every byte turns into a count and a ' +
      'value. The file gets bigger. Nothing is wrong with the encoder; the data is the wrong ' +
      'shape for it. And you could not save it this way even if you wanted to: BMP offers ' +
      'BI_RLE8 and BI_RLE4 and no 24-bit run-length mode at all.',
  },
  'bmp-palette': {
    speaker: 'Same encoder, different data. Three real files, three real sizes.',
    learner:
      'Nothing about the encoder changes on this slide. What changes is what the pixels are: ' +
      'instead of three colour bytes, each pixel becomes one small index into a shared palette. ' +
      'Two things follow. The obvious one is free — one byte a pixel instead of three is exactly ' +
      '3:1 before any compression happens. The interesting one is that neighbouring pixels now ' +
      'frequently share an index, so the runs RLE needed finally exist, and BI_RLE8 has something ' +
      'to collapse. The palette has to travel with the file, and it is counted in the numbers ' +
      'above. Watch what happens on a photograph at 256 colours: run-length coding makes it ' +
      'bigger, and a real encoder responds by writing BI_RGB instead — its worst case is bounded ' +
      'because it is allowed to decline.',
  },
  'lossy-vs-lossless': {
    speaker: 'Two families. Only one of them threw information away.',
    learner:
      'Everything so far splits into two families. Lossless transforms — run-length encoding ' +
      'itself, and the palette when the image had few enough colours to fit — can be undone ' +
      'exactly. Lossy ones, like squeezing a photograph into 16 colours, cannot: the discarded ' +
      'information is gone for good. The interesting part is that the biggest win came from ' +
      'reframing the data rather than from any cleverness in the encoder, and that reframing is ' +
      'where the rest of this talk lives.',
  },
}
