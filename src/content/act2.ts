import type { ProseRegistry } from './types'

/**
 * Act 2 — colour, as one argument in two moves.
 *
 * Both slides are the same picture in the same layout — three planes on the left, the
 * reconstruction on the right, per-plane resolution sliders — so the only thing that
 * changes between them is what the planes mean:
 *
 *   1. `rgb-subsample` — try the obvious thing in red, green and blue. Every plane carries
 *                        brightness, so dropping any of them dents the picture; blue is the
 *                        only one the eye lets you spend, and only a little.
 *   2. `chroma-subsample` — change the axes first, to brightness plus colour, and now two
 *                        of the three planes are pure tint and shrink almost for free.
 *
 * The thread through both is human perception rather than the data: the retina reads
 * luminance detail far more sharply than colour detail, and reads blue least of all. The
 * first slide runs into that wall; the second is built to exploit it.
 */
export const ACT2_PROSE: ProseRegistry = {
  'colour-spaces': {
    learner:
      'A colour is three numbers however you slice it — but you get to choose the three axes. ' +
      'In RGB every one of red, green and blue is partly brightness, so there is no plane you ' +
      'can spend. Switch to YCbCr and brightness lifts onto its own axis (Y), leaving two axes ' +
      'of pure colour (Cb, Cr) you can afford to store coarsely. That reframe is the whole ' +
      'reason to change coordinates before compressing.',
    more: {
      title: 'Older than JPEG',
      blocks: [
        {
          kind: 'fact',
          text:
            'YCbCr was not invented for JPEG. It is how colour television stayed watchable on ' +
            'black-and-white sets: broadcasters sent brightness as the old signal and bolted ' +
            'colour on the side. JPEG reused the trick decades later.',
        },
        {
          kind: 'fact',
          label: 'Why two colour axes, not three',
          text:
            'Once brightness is a fixed mix of R, G and B, knowing brightness plus two ' +
            'colour-differences pins down the third by arithmetic. Colour, with brightness ' +
            'removed, is a two-dimensional thing.',
        },
      ],
    },
  },
  'rgb-subsample': {
    learner:
      'The obvious way to spend fewer bytes on colour is to store the colour planes at lower ' +
      'resolution. But every RGB plane is partly brightness, so drop red or green far and the ' +
      'picture itself goes blocky, not just its colour. Blue is the one you can lean on a little ' +
      '— and there is no plane here you can throw away cheaply. That tangle is what the next ' +
      'slide unpicks.',
    more: {
      title: 'What your eye actually resolves',
      blocks: [
        {
          kind: 'fact',
          text:
            'Only about 2% of your cones sense blue, and none sit at the very centre of your ' +
            'gaze — so fine blue detail is the cheapest thing to store coarsely, whatever the ' +
            'brightness.',
        },
        {
          kind: 'fact',
          label: 'Green carries the light',
          text:
            'Brightness is roughly 59% green, 30% red, 11% blue — the very weights the YCbCr ' +
            'transform is built from. Coarsen green and the picture dulls fastest; coarsen blue ' +
            'and almost nobody notices.',
        },
      ],
    },
  },
  'chroma-subsample': {
    learner:
      'Now that brightness and colour sit on separate axes, spend less on the colour ones. Keep ' +
      'luma at full resolution and store the two chroma planes at half resolution each way — ' +
      'that is where the name 4:2:0 comes from. Flick between the two views and use the loupe on ' +
      'a sharp colour edge, the one place you will find the difference. It is the most ' +
      'dependable saving in the deck: exactly half the data on every image, no measuring. Do the ' +
      'same to Y instead and the picture falls apart.',
    more: {
      title: 'The saving that never moves',
      blocks: [
        {
          kind: 'fact',
          text:
            '4:2:0 is nearly universal: almost every JPEG, MPEG video and streamed frame you ' +
            'have ever seen halves its colour resolution this way — and you have never noticed. ' +
            'It works purely because the eye resolves colour far less sharply than brightness.',
        },
        {
          kind: 'link',
          href: 'https://en.wikipedia.org/wiki/Chroma_subsampling',
          label: 'Chroma subsampling, and what 4:4:4 is for',
        },
      ],
    },
  },
}
