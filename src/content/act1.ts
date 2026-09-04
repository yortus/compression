import type { ProseRegistry } from './types'

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
    speaker: 'Both sides need a shared convention. The escape byte is not free.',
    learner:
      'A decoder cannot tell a count from a literal unless both sides already agree how to tell ' +
      'them apart. This version marks runs with an escape byte — but that agreement has to exist ' +
      'in advance, and it has a nasty edge: what if the data itself contains the escape byte? It ' +
      'has to be escaped too, which makes it more expensive than an ordinary byte. Choose the ' +
      'escape badly and the "compressed" output grows.',
  },
  'rle-bitmap': {
    speaker: 'Straight at an RGB photo. Watch it get bigger.',
    learner:
      'Now point exactly the same encoder at an image. Pixels are stored as interleaved red, ' +
      'green and blue bytes, and in a photograph neighbouring bytes are almost never identical — ' +
      'the run length is nearly always one. RLE dutifully turns every byte into a count and a ' +
      'value, and the file gets bigger. The technique is not wrong; the data is in the wrong shape.',
  },
  'rle-palette': {
    speaker: 'Reframe: pixels become indices. Same encoder, completely different result.',
    learner:
      'Nothing about the encoder changes here. What changes is the data it is given: instead of ' +
      'three colour bytes per pixel, each pixel becomes a small index into a shared palette. ' +
      'Neighbouring pixels now frequently share an index, so runs appear where there were none. ' +
      'The palette itself has to be sent along — it is a primer, and it is counted in the numbers ' +
      'above — but it is a few hundred bytes against a payload of hundreds of thousands.',
  },
  'rle-planes': {
    speaker: 'Same bytes, different order. Nothing lost, and it compresses better.',
    learner:
      'This one throws nothing away at all. The red, green and blue bytes are simply visited in ' +
      'three separate passes instead of interleaved triples. Within a plane, a smooth region ' +
      'really does repeat, so runs appear — the same bytes in a different order are more ' +
      'compressible than they were before. That is the whole thesis of this talk in one slide.',
  },
  'lossy-vs-lossless': {
    speaker: 'Two families. Only one of them threw information away.',
    learner:
      'Everything so far splits into two families. Lossless transforms — reordering into planes, ' +
      'run-length encoding itself — can be undone exactly. Lossy ones, like reducing an image to ' +
      '64 colours, cannot: the discarded information is gone for good. The interesting part is ' +
      'that the biggest wins came from reframing the data rather than from any cleverness in the ' +
      'encoder, and that reframing is where the rest of this talk lives.',
  },
}
