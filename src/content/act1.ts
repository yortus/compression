import type { ProseRegistry } from './types'

/**
 * Act 1 — run-length encoding.
 *
 * Five slides became two. The act used to walk through RLE on text, then the round trip,
 * then the escape byte, then a real 24-bit BMP, then the same picture palettised; all of
 * that is now one slide with a representation toggle, because holding the encoder fixed
 * and changing only what the bytes mean *is* the argument, and splitting it across five
 * slides diluted it. What survives separately is the escape-byte gotcha, which is about
 * shared primers rather than about run lengths.
 *
 * BMP is no longer the frame. It settled the argument nicely — the format has a run-length
 * mode that works only on palettised images — but tying the act to one file format cost
 * more than it bought, and the fact keeps its sentence in the prose below.
 */
export const ACT1_PROSE: ProseRegistry = {
  'rle-bitmap': {
    speaker: 'Same encoder throughout. Change what a pixel *is* and the ratio moves thirty-fold.',
    learner:
      'Run-length encoding is about the simplest compression there is: instead of writing the ' +
      'same byte over and over, write it once with a count. The encoder on this slide never ' +
      'changes. What changes is what the bytes *mean*, and that alone takes the same picture from ' +
      'sixteen-to-one down to half the size it started. The three rows go worst to best. Stored as ' +
      '32-bit RGBA it is four bytes a pixel of red, green, blue and alpha interleaved, so ' +
      'neighbouring bytes are four channels of four different things and almost no two in a row ' +
      'are equal — nearly every byte becomes a count and a value, and the file grows. Split into ' +
      'colour planes it is exactly the same bytes visited in a different order, and that alone is ' +
      'often enough. As palette indices it is one small number per pixel, neighbours finally repeat, ' +
      'and the runs the coder needed exist at last. That is the argument the whole talk runs on: ' +
      'the win came from reframing the data, not from a cleverer encoder. ' +
      'Then try the gradient, which fails twice over. Nothing repeats, so there is nothing for any ' +
      'run-length coder to collapse — and it has 256 colours where the palette holds sixteen, so ' +
      'the one row that *would* have found runs can only do it by throwing colour away. Watch the ' +
      'decoded panel band, and the stamp turn from LOSSLESS to LOSSY. Palettising is usually a free ' +
      'reframe and sometimes it is the lossy step. Note too that the palette has to travel with the ' +
      'indices — it is in the band at the bottom, and counted as overhead in the numbers above. ' +
      'Real formats do all of this: a Windows BMP offers BI_RLE8 and BI_RLE4 and no 24-bit ' +
      'run-length mode at all, and now you can see why.',
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
