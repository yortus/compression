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
  'rgb-subsample': {
    learner:
      'The obvious way to spend fewer bytes on colour is to store the colour planes at lower ' +
      'resolution. So here are red, green and blue, each on its own slider — drag one down and ' +
      'its plane is averaged into coarser and coarser blocks, then stretched back to full size ' +
      'for the reconstruction. The trouble shows up straight away: every one of these planes is ' +
      'partly brightness, so drop red or green far and the picture itself goes blocky, not just ' +
      'its colour. Blue is the exception you can lean on a little — the eye holds very few ' +
      'blue-reading cones, so it resolves blue detail poorly and a coarse blue plane is hard to ' +
      'catch. But there is no plane here you can throw away cheaply, because brightness and ' +
      'colour are tangled together in all three. That tangle is what the next slide unpicks.',
    more: {
      title: 'Why green matters most and blue least',
      blocks: [
        {
          kind: 'para',
          text:
            'The eye judges brightness far more finely than colour, and the three primaries do ' +
            'not carry brightness equally. Green carries most of it, red a good deal less, and ' +
            'blue least of all — the standard luma weights put it at roughly 59% green, 30% red ' +
            'and 11% blue, and those are the very numbers the brightness transform two slides ' +
            'later is built from. So coarsening the green plane dulls the picture fastest, and ' +
            'coarsening blue is the least visible. Note this is about sensitivity, not cone ' +
            'counts: the retina actually holds more red-sensitive cones than green, but the two ' +
            'together form a brightness response that peaks in the green, which is what the eye ' +
            'resolves most sharply.',
        },
        {
          kind: 'para',
          text:
            'Blue is cheap for a second reason too. The retina holds very few of the ' +
            'blue-sensitive cones — a few per cent, and none at the very centre of vision — so ' +
            'it resolves fine blue detail poorly whatever the brightness. Even so, no RGB plane ' +
            'is truly free to spend, because every one of them is part brightness. The real fix ' +
            'is to split brightness away from colour first, which is exactly what the next ' +
            'slide does.',
        },
      ],
    },
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
