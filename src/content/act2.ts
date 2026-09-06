import type { ProseRegistry } from './types'

/**
 * Act 2 — colour, as one continuous argument in three moves.
 *
 * The act is deliberately built as the same picture three times, in the same layout, so
 * the only thing that visibly changes between slides is what the three planes contain:
 *
 *   1. `rgb-planes`   — pull the image apart. Free, and it already helps. But all three
 *                       planes are the same picture, and that redundancy is untouched.
 *   2. `ycbcr`        — rotate the axes. Still three full-size planes, still nothing
 *                       saved, but the redundancy is gone and only one plane now looks
 *                       like the photograph.
 *   3. `chroma-subsample` — cash that in: shrink the two nobody was reading.
 *
 * Correlation is the thread through the first two, and it is measured on both rather
 * than asserted — which matters, because how far it falls turns out to depend heavily on
 * the picture (0.96 to 0.60 on Forest; barely anything on a saturated close-up). The
 * durable claim, and the one the third slide actually rests on, is concentration: Y ends
 * up holding the picture on every image, whatever the correlation does.
 */
export const ACT2_PROSE: ProseRegistry = {
  'rgb-planes': {
    learner:
      'Start by pulling the image apart. Instead of storing red, green and blue interleaved as ' +
      'triples, visit all the red bytes, then all the green, then all the blue. Nothing is ' +
      'discarded — it is the same bytes in a different order — and yet it compresses better, ' +
      'because within a plane a smooth region really does repeat. That is the whole thesis of ' +
      'this talk in one slide. But now look at the three pictures rather than the numbers: to some ' +
      'degree they are all the same photograph — bright where it is bright, dark where it is ' +
      'dark. That resemblance is duplication, and a run-length coder cannot touch it, because it ' +
      'is a relationship between the planes rather than along any one of them. How much of it ' +
      'there is depends heavily on the picture: a forest scene measures 0.96 out of 1, while a ' +
      'saturated close-up — where the reds genuinely are not the blues — can be as low as 0.3. ' +
      'The slide reads the number off whatever image is loaded rather than promising you one.',
  },
  'ycbcr': {
    learner:
      'The fix is to change what the three planes mean. Y is a weighted average of the three ' +
      'colours — brightness. Cb and Cr are what is left: how much bluer and how much redder this ' +
      'pixel is than that average. It is a rotation of the colour axes, it is exactly ' +
      'invertible, and by itself it saves nothing whatsoever — three planes in, three planes of ' +
      'the same size out. There are two things it buys, and they are not equally ' +
      'reliable. The planes become less alike — how much less depends on the image, and the slide ' +
      'measures it both ways so you can see. The one that always happens, and the one the next ' +
      'slide depends on, is that the picture ends up concentrated in Y. Note the chroma planes are drawn in the ' +
      'colours they actually encode, not in grey. Rendered grey they look like two noisy copies ' +
      'of the photo and teach you nothing; rendered honestly, Cb is a yellow-to-blue map and Cr a ' +
      'cyan-to-red one. And then the observation the next slide needs: Y is the photograph, and ' +
      'the other two are vague washes — yet all three hold exactly the same number of bytes.',
  },
  'chroma-subsample': {
    learner:
      'So store less of them. The luma plane is kept at full resolution and the two chroma planes ' +
      'are stored at half resolution in each direction, which is where the name 4:2:0 comes from. ' +
      'Flick between the two views and look for the difference — then use the loupe on an edge ' +
      'where the colour changes sharply, which is where you will actually find it. This is the ' +
      'most dependable technique in the whole deck: exactly half the data on every image, every ' +
      'time, with no measuring and no adapting. It is also the one with the least excuse. It ' +
      'works purely because the plane holding the detail your eye is good at is the one we kept — ' +
      'a fact about human retinas, not about images. Do the same thing to Y instead and the ' +
      'picture falls apart.',
    more: {
      title: 'Why the ratio never moves',
      blocks: [
        {
          kind: 'para',
          text:
            'Subsampling is the one stage whose saving is fixed in advance. 4:2:0 halves both ' +
            'axes of both chroma planes, so they cost a quarter of their samples and the total ' +
            'lands at half the data on every image ever — a photograph, a flat graphic, a ' +
            'gradient. Nothing about the picture is consulted, which is why it is safe to do ' +
            'first and cheap to reason about.',
        },
        {
          kind: 'para',
          text:
            'It is also the stage that is lossy for a reason about people rather than about ' +
            'data: the eye resolves far less colour detail than luminance detail, so what goes ' +
            'here is mostly detail a viewer cannot see. Point it at saturated red text on a blue ' +
            'background and the model breaks down visibly — which is why 4:4:4 exists.',
        },
      ],
    },
  },
}
