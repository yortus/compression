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
    more: {
      title: 'What a real Huffman coder ships',
      blocks: [
        {
          kind: 'para',
          text:
            'Huffman codes are optimal among codes that give each symbol a whole number of ' +
            'bits — and that is exactly their limit. A symbol that deserves 0.2 bits still ' +
            'costs one, so on a very skewed distribution Huffman leaves real savings on the ' +
            'table, which is what arithmetic coding and ANS were invented to collect.',
        },
        {
          kind: 'para',
          text:
            'The table has to travel, but not the way this slide prices it. Real formats send ' +
            'canonical codes: agree that codes of the same length are assigned in symbol order, ' +
            'and the lengths alone are enough to rebuild the tree — so the table becomes a ' +
            'list of small numbers rather than a list of bit strings. JPEG goes further and ' +
            'ships standard tables in the specification, so ordinary files send no table at all.',
        },
        {
          kind: 'para',
          text:
            'The deck’s JPEG stages use a separate, deliberately illustrative coder: a fresh ' +
            'tree per 8×8 block, no DC differential coding, no standard tables. It exists to ' +
            'produce numbers an audience can follow, not to match ITU-T T.81.',
        },
      ],
    },
  },
  'lz77': {
    learner:
      'Run-length encoding can only collapse repeats that touch each other, and Huffman only ' +
      'cares how *often* a symbol appears, never where. LZ77 is the third answer to what counts ' +
      'as redundant: anything already seen within a window can be pointed at instead of repeated, ' +
      'as a back-reference saying go back this far and copy this much. Every curve on the left is ' +
      'one of those references. On the repeated licence header there are three of them and they ' +
      'sweep across the whole panel; on the noise there is not a single one. Shrink the window and ' +
      'the long matches stop being reachable — the boilerplate falls from nearly three-to-one to ' +
      'worse than it started, which is exactly why a real encoder has a window size and why it is ' +
      'a memory-versus-ratio decision rather than a free parameter. Widening it is not free ' +
      'either: every match pays for the reach in a wider distance field whether it uses it or not. ' +
      'One more thing, which the stage deliberately leaves to the side: on its own, matching barely ' +
      'pays on English prose — but it has reshaped the data into a stream of very repetitive tokens, ' +
      'and running the Huffman coder from two slides ago over that stream roughly doubles the result ' +
      'again. That pairing is DEFLATE, and it is what gzip, zip, PNG and every compressed HTTP ' +
      'response actually ship.',
    more: {
      title: 'LZ77, and the other half of gzip',
      blocks: [
        {
          kind: 'para',
          text:
            'On its own, matching barely pays on English prose. But it has reshaped the data ' +
            'into a stream of very repetitive tokens — the same distances and lengths, over ' +
            'and over — and running the Huffman coder from two slides ago over that stream ' +
            'roughly doubles the result again. That pairing is DEFLATE, and it is what gzip, ' +
            'zip, PNG and every compressed HTTP response actually ship. Two techniques that ' +
            'multiply rather than add, which is why real formats are pipelines rather than ' +
            'algorithms.',
        },
        {
          kind: 'para',
          text:
            'The window is a memory-versus-ratio decision, not a free parameter. Widening it ' +
            'reaches further back and charges every match for the reach: a distance field wide ' +
            'enough for the whole window, whether a given match needs it or not. Real DEFLATE ' +
            'uses a 32 KB window, matches of 3 to 258 symbols, and a second Huffman code over ' +
            'the lengths and distances themselves.',
        },
        {
          kind: 'para',
          text:
            'What this slide models: matches, literals, and a flat cost per token. What it does ' +
            'not: block structure, the fixed-versus-dynamic table choice, or the lazy matching ' +
            'heuristic that decides whether a shorter match now beats a longer one next symbol. ' +
            'The shape of the trade is what it is for.',
        },
      ],
    },
  },
  'waves-intro': {
    learner:
      'Before any of this is about compression: any list of numbers at all can be written as a sum ' +
      'of fixed cosine waves, from a flat line through to the fastest wiggle the samples can ' +
      'represent. The waves never change — only how much of each one you need. Drag on the signal ' +
      'to draw your own and watch how many waves it takes to reproduce. Smooth signals need very ' +
      'few; a sharp edge or a single spike needs nearly all of them, because a corner is built out ' +
      'of every frequency at once.',
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
      'The whole per-block round trip, in one animation. Press forward and the block flies apart ' +
      'into the 64 fixed patterns it is made of — that is the forward DCT, and nothing has been ' +
      'lost yet. Press again and quantisation happens: every coefficient that rounded to zero ' +
      'fades out and stays behind, which at ordinary quality settings is most of them. Press again ' +
      'and the survivors fly back together into a picture that is nearly, but not quite, the one ' +
      'we started with. They arrive coarsest first, so you can watch the block appear as a blur ' +
      'and then sharpen. Drag the quality slider and the middle act changes: at low quality only a ' +
      'handful of patterns make the journey, and the error at the end grows to match. Click any ' +
      'block in the image on the left to try another one — flat sky needs almost nothing, and a ' +
      'sprite with hard edges shows the ringing that JPEG is famous for. One honesty note about ' +
      'the picture: the 64 pattern tiles share a single display contrast, because truthfully drawn ' +
      'all but the first few are flat squares. One gain across all of them keeps their sizes ' +
      'relative to each other exact, so what you are comparing is real. One cost is missing from ' +
      'the numbers here on purpose: the encoder still has to say which patterns survived, and ' +
      'that turns out to be the interesting part. It is what the next two slides are about.',
    more: {
      title: 'The animation is narrative; the picture is not',
      blocks: [
        {
          kind: 'para',
          text:
            'The sixty-four sprites flying apart and back are a story about where the ' +
            'coefficients go. The reconstruction panel is not: DCT coefficients are signed, so ' +
            'additively blending the sprites would look like superposition while being wrong. ' +
            'That panel runs a real inverse DCT, weighted by each sprite’s tween value, on ' +
            'every frame.',
        },
        {
          kind: 'para',
          text:
            'Which patterns survive is decided by the quality slider, through the same scaled ' +
            'luminance quantisation table the rest of the pipeline uses. It is not a threshold ' +
            'this slide invented — drag the slider and the same coefficients disappear that ' +
            'the quantisation slide is about.',
        },
        {
          kind: 'para',
          text:
            'What the count here deliberately does not model: the cost of saying *which* ' +
            'coefficients survived. That is a real cost and not a flat one, and the zigzag slide ' +
            'goes on to measure that JPEG spends nothing on positions beyond the run lengths it ' +
            'was already emitting.',
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
      'The surviving coefficients are all in one corner of the block, but a run-length coder can ' +
      'only see the order you hand it. The count of pairs is the same either way — one per ' +
      'surviving coefficient, plus an end-of-block marker — and that is worth noticing, because ' +
      'it is not where the saving comes from. What changes is the gaps between them. Read row by ' +
      'row and consecutive coefficients are separated by whatever the row stride leaves: fives, ' +
      'sixes, thirteens, each a separate symbol to describe. Read along the diagonals and they sit ' +
      'next to each other, so nearly every gap is zero and the alphabet collapses onto one very ' +
      'common symbol. Nothing is computed and nothing is discarded: the saving comes entirely from ' +
      'visiting the same 64 numbers in a different order.',
    more: {
      title: 'What the comparison actually found',
      blocks: [
        {
          kind: 'para',
          text:
            'The first version of this slide claimed zigzag produces fewer run-length pairs. ' +
            'Measured, that is false, and the slide now says so out loud: a pair is emitted per ' +
            'non-zero coefficient plus an end-of-block marker, and reordering cannot change how ' +
            'many non-zeros a block has. Both strips really do show the same count.',
        },
        {
          kind: 'para',
          text:
            'What the diagonal changes is the gaps between the non-zeros. In row order they are ' +
            'a scatter of fives and thirteens; along the diagonal they are almost all zero, ' +
            'because that is the order the energy decays in. Every distinct gap length is ' +
            'another symbol the entropy coder has to describe, so the saving shows up in bits ' +
            'after Huffman rather than in the pair count — which is where the slide draws it.',
        },
        {
          kind: 'para',
          text:
            'Both strips are computed by compareScanOrders in engine/jpeg/stages.ts, run over ' +
            'the selected block and again over every block in the image, so one lucky selection ' +
            'cannot carry the argument.',
        },
      ],
    },
  },
  'jpeg-pipeline': {
    learner:
      'The whole chain, measured on whatever image is loaded. Each row is priced the same way — what ' +
      'an order-0 entropy coder would need for the representation at that point — so consecutive ' +
      'rows are comparable, and the last row is the real per-block Huffman figure the rest of the ' +
      'deck reports. The row worth stopping on is the DCT. It discards nothing at all, and the file ' +
      'still shrinks sharply — because a coder with no memory does far better on decorrelated ' +
      'coefficients than on neighbouring pixels. That is what transform coding is for, and it is ' +
      'what makes every row below it possible: quantisation only works because the transform sorted ' +
      'the numbers by how much they matter first. No single stage here is the compressor.',
    more: {
      title: 'Reading the table honestly',
      blocks: [
        {
          kind: 'para',
          text:
            'An earlier version of this slide asserted that the DCT row costs bits, reasoning ' +
            'that a rotation cannot destroy information. Measured, it saves a great deal: ' +
            'order-0 entropy is not preserved by a rotation, and decorrelating the samples is ' +
            'precisely what makes a memoryless coder do better. Which is the argument for ' +
            'reading numbers off the page instead of deciding in advance what they ought to say.',
        },
        {
          kind: 'para',
          text:
            'Every row is idealised. There is no real bitstream here — no markers, no restart ' +
            'intervals, no DC differential coding, no standard code tables — and the entropy ' +
            'rows sample blocks rather than coding all of them. A real encoder on the same image ' +
            'lands within a few percent, not exactly.',
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
      'The finished article: original against reconstruction, at whatever quality you choose. Drag ' +
      'the quality down and the artifacts arrive in a specific order — blockiness at the 8×8 ' +
      'boundaries, ringing along sharp edges, and colour smearing before luminance goes. That order ' +
      'is not accidental; it is the pipeline’s priorities showing through.',
    more: {
      title: 'Decoding is the pipeline backwards',
      blocks: [
        {
          kind: 'para',
          text:
            'Dequantise, inverse DCT, merge the blocks, upsample the chroma planes, YCbCr back ' +
            'to RGB. Every one of those steps gives back what it was given; the only information ' +
            'that is gone was spent at quantisation. That is why the diff view is not a picture ' +
            'of accumulated error but a picture of one decision.',
        },
        {
          kind: 'para',
          text:
            'Whether a run is lossy at all is measured here, not assumed: at Q100 with no chroma ' +
            'subsampling some images come back bit-identical, and the badge says so. "JPEG is ' +
            'lossy" is true of the format and not of every block it is handed.',
        },
      ],
    },
  },
}
