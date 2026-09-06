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
  'summarising': {
    speaker: 'Two ways to shorten a document. Only one of them gives it back.',
    learner:
      'Before any bits: you have compressed things before. Shortening a document is ' +
      'compression, and it splits along exactly the line the rest of this talk turns on. ' +
      'Rewrite an aerodrome forecast in METAR and a pilot reads it back word for word — that is ' +
      'lossless coding against a codebook both sides learned in advance, which is the same ' +
      'bargain a Huffman code table strikes, one layer up in meaning instead of in bits. Write a ' +
      'précis of the Gettysburg Address and you will never get the address back. Step to the last ' +
      'phase and watch both routes run the expansion: one panel becomes the original, the other ' +
      'simply stops. Notice too that the picker is a diagonal rather than a ladder. Chess ' +
      'notation compresses a game nine-fold and summarises terribly, because in a game record the ' +
      'moves *are* the message; prose is the other way round and has no agreed shorthand at all. ' +
      'Which route is available to you is a fact about the domain, not about your cleverness. One ' +
      'last thing, and it is the reason the rest of the talk is built the way it is: this slide ' +
      'can measure exactly how much smaller a summary is, and it cannot measure whether the ' +
      'summary is any good. Nothing can, except a person. Every lossy codec in this deck ends up ' +
      'containing a model of one.',
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
}
