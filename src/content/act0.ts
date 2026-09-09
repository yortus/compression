import type { ProseRegistry } from './types'
import { PEOPLE } from './people'

export const ACT0_PROSE: ProseRegistry = {
  title: {
    learner:
      'An interactive deck about how compression actually works, built around JPEG — the one ' +
      'almost everyone has met and almost nobody has taken apart. Every slide is live: change ' +
      'the image, move the sliders, and the numbers move with you.',
  },
  'why-care': {
    learner:
      'A 512×512 photograph is 786,432 bytes of red, green and blue. The version you actually ' +
      'downloaded is a few percent of that — and that ratio is not a detail of the file ' +
      'format, it is the reason the web has images at all.',
    more: {
      title: 'The scale of it',
      blocks: [
        {
          kind: 'fact',
          text:
            'Video is around four-fifths of all internet traffic. Without compression a single ' +
            'streamed film would want a connection thousands of times faster than home ' +
            'broadband — the argument for still images applies to sound and video with far ' +
            'more force.',
        },
        {
          kind: 'fact',
          label: 'Rule of thumb',
          text:
            'Raw images run about 3 bytes a pixel. A JPEG at ordinary quality lands nearer a ' +
            'quarter of a byte — a 10–20× saving before anyone notices a thing.',
        },
      ],
    },
  },
  'summarising': {
    learner:
      'You have compressed things before. Rewrite a forecast in METAR and a pilot reads it back ' +
      'word for word — lossless, against a codebook both sides learned in advance. Write a ' +
      'précis of a speech and you can never get the speech back. One route is reversible, the ' +
      'other is not, and that split runs through the whole talk.',
    more: {
      title: 'Two kinds of shorter',
      blocks: [
        {
          kind: 'fact',
          text:
            'Which route is open is a fact about the domain, not your cleverness. Chess notation ' +
            'compresses a game ninefold and summarises terribly; prose is the other way round ' +
            'and has no agreed shorthand at all.',
        },
        {
          kind: 'para',
          text:
            'A codec can measure exactly how much smaller a summary is. It cannot measure ' +
            'whether the summary is any good — nothing can, except a person, which is why every ' +
            'lossy codec ends up containing a model of one.',
        },
      ],
    },
  },
  'info-theory': {
    learner:
      'Claude Shannon showed in 1948 that a message has a measurable information content, in ' +
      'bits, and that no lossless scheme can encode it in fewer bits than that on average. It is ' +
      'a property of the data, not of the encoder. Type into the box and watch the floor move: ' +
      'repetitive text has low entropy and compresses well, while text using many symbols evenly ' +
      'has high entropy and barely compresses at all. Everything in this talk is an attempt to ' +
      'get close to this number.',
  },
  timeline: {
    learner:
      'Almost none of the ideas in JPEG were invented for JPEG. The 1992 standard is mostly an ' +
      'act of assembly — worth remembering next time something looks like it was invented all ' +
      'at once.',
    more: {
      title: 'The people behind the pipeline',
      blocks: [
        PEOPLE.fourier,
        PEOPLE.shannon,
        PEOPLE.huffman,
        {
          kind: 'fact',
          text:
            'Fourier (1822), Shannon (1948), Huffman (1952) and the discrete cosine transform ' +
            '(1974) were all in place decades before JPEG shipped. The committee’s real work was ' +
            'in the assembling.',
        },
      ],
    },
  },
  optimisation: {
    learner:
      'Compression is optimisation, and it has the same reputation problem: done early and ' +
      'everywhere it makes systems unreadable, done late and deliberately it is indispensable. ' +
      'Three quantities trade against each other — how small, how fast, and how faithful. Every ' +
      'format is a position on that triangle, and formats age mostly by moving along it as ' +
      'hardware makes different corners cheap.',
  },
}
