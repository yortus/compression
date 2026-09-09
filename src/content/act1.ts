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
      'same byte over and over, write it once with a count. The encoder here never changes — ' +
      'only what the bytes *mean*. As interleaved RGBA almost no two neighbours match and the ' +
      'file grows; as colour planes, the same bytes in a better order; as palette indices, ' +
      'neighbours finally repeat and the runs appear. The win came from reframing the data, not ' +
      'a cleverer coder. The gradient then fails twice: nothing repeats, and its 256 colours ' +
      'overflow a 16-colour palette, so the one row that could find runs must throw colour away ' +
      '— LOSSLESS turns LOSSY.',
    more: {
      title: 'How a real format says “run”',
      blocks: [
        {
          kind: 'fact',
          text:
            'Windows BMP ships run-length modes BI_RLE8 and BI_RLE4 — and none for 24-bit ' +
            'colour. Microsoft already knew run-length coding only pays on palettised images; ' +
            'the format’s own compression field says so.',
        },
        {
          kind: 'para',
          text:
            'A decoder cannot tell a count from a literal unless both sides agree how. BMP’s ' +
            'convention is a count of zero — 00 00 ends a row, 00 01 the image — and none of ' +
            'that is in the file: it is in the spec, the shared primer everyone has opened by ' +
            'accident. engine/formats/bmp.ts implements the real thing, header and all, with ' +
            'round-trip tests.',
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/Run-length_encoding',
          label: 'Run-length encoding',
        },
      ],
    },
  },
}
