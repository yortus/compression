import type { ProseRegistry } from './types'

export const ACT0_PROSE: ProseRegistry = {
  title: {
    speaker: 'Everything you look at today arrived compressed. Nobody notices until it breaks.',
    learner:
      'This is an interactive deck about how compression actually works, built around JPEG — ' +
      'because JPEG is the one almost everyone has met and almost nobody has taken apart. Every ' +
      'slide is live: change the image, move the sliders, and the numbers along the top change ' +
      'with you. Use the arrow keys, or click any slide in the list on the left.',
  },
  'why-care': {
    speaker: 'The photo on this slide is 768 KB of pixels. It reached you as about 30.',
    learner:
      'A 512×512 photograph is 786,432 bytes of red, green and blue — three quarters of a ' +
      'megabyte for a small square image. The version you actually downloaded is a few percent ' +
      'of that. That ratio is not a detail of the file format; it is the reason the web has ' +
      'images at all, and the same argument applies with more force to audio and video.',
  },
  'info-theory': {
    speaker: 'Shannon 1948. Entropy is the floor — no encoder gets under it.',
    learner:
      'Claude Shannon showed in 1948 that a message has a measurable information content, in ' +
      'bits, and that no lossless scheme can encode it in fewer bits than that on average. It is ' +
      'a property of the data, not of the encoder. Type into the box and watch the floor move: ' +
      'repetitive text has low entropy and compresses well, while text using many symbols evenly ' +
      'has high entropy and barely compresses at all. Everything in this talk is an attempt to ' +
      'get close to this number.',
  },
  timeline: {
    speaker: 'Fourier 1822, Shannon 1948, Huffman 1952, DCT 1974. JPEG just assembled them.',
    learner:
      'Almost none of the ideas in JPEG were invented for JPEG. Fourier had the wave ' +
      'decomposition in 1822, Shannon defined information in 1948, Huffman found optimal prefix ' +
      'codes as a graduate student in 1952, and the discrete cosine transform arrived in 1974. ' +
      'The 1992 standard is mostly an act of assembly — which is worth remembering next time ' +
      'something looks like it must have been invented all at once.',
  },
  optimisation: {
    speaker: 'Compression is optimisation with three axes. You never get all three.',
    learner:
      'Compression is optimisation, and it has the same reputation problem: done early and ' +
      'everywhere it makes systems unreadable, done late and deliberately it is indispensable. ' +
      'Three quantities trade against each other — how small, how fast, and how faithful. Every ' +
      'format is a position on that triangle, and formats age mostly by moving along it as ' +
      'hardware makes different corners cheap.',
  },
  source: {
    speaker: 'One image, carried through the whole talk. Change it whenever you like.',
    learner:
      'This is the image the rest of the deck works on. Every slide from here reads from ' +
      'whichever picture is selected in the bar at the bottom, so you can swap between a ' +
      'photograph, a flat graphic and a smooth gradient at any point and watch the same ' +
      'technique behave completely differently on each.',
  },
}
