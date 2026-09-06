import type { ProseRegistry } from './types'

/**
 * Run-length encoding — the first slide of the Codes act.
 *
 * Five slides became one. It used to walk through RLE on text, then the round trip, then
 * the escape byte, then a real 24-bit BMP, then the same picture palettised; all of that
 * is now one slide with a representation toggle, because holding the encoder fixed and
 * changing only what the bytes mean *is* the argument, and splitting it across five
 * slides diluted it.
 *
 * BMP is no longer the frame. It settled the argument nicely — the format has a run-length
 * mode that works only on palettised images — but tying the slide to one file format cost
 * more than it bought, and the fact keeps its sentence in the prose below.
 */
export const ACT1_PROSE: ProseRegistry = {
  'rle-bitmap': {
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
      'indices — it is in the band at the bottom, and counted as overhead in the numbers above.',
    more: {
      title: 'How a real format says “run”',
      blocks: [
        {
          kind: 'para',
          text:
            'A decoder cannot tell a count from a literal unless both sides already agree how. ' +
            'Windows BMP’s convention is a count of zero: 00 00 ends the row, 00 01 ends the ' +
            'image, 00 02 is a jump, and 00 n means n literal pixels follow, padded to a word. ' +
            'None of that is in the file — it is in the specification, which both ends read in ' +
            'advance. That is the shared primer, shipped in a format everyone has opened by ' +
            'accident.',
        },
        {
          kind: 'para',
          text:
            'BMP settles this slide’s argument by itself: it offers BI_RLE8 and BI_RLE4 and no ' +
            '24-bit run-length mode at all. Microsoft already knew run-length coding does not ' +
            'work on interleaved colour — the format’s own compression field says so.',
        },
        {
          kind: 'para',
          text:
            'engine/formats/bmp.ts implements all of it for real — the 54-byte header, four ' +
            'bytes per palette entry, rows padded to a four-byte boundary, BI_RLE8 encoded and ' +
            'decoded per spec — with round-trip tests. The slide uses its own 16×16 artwork ' +
            'because 256 bytes fit on screen in full and a photograph’s 786,432 do not.',
        },
      ],
    },
  },
}
