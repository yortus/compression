import type { Abbreviation } from '../engine/codecs/abbreviate'

/**
 * Four messages, each compressible two ways, and the reason the answer is a diagonal.
 *
 * Summarising a document is compression, and it splits exactly along the line the whole
 * deck turns on. Rewrite a weather bulletin in METAR and you can get it back word for word
 * — that is lossless coding against a shared codebook, the Huffman story one layer up.
 * Write a précis of a speech and you cannot get it back at all.
 *
 * The picker is arranged so neither route wins everywhere. A domain with an agreed codebook
 * abbreviates enormously and summarises badly, because the numbers *are* the message;
 * prose summarises well and has almost nothing to abbreviate. Which of the two you can use
 * is a fact about the domain, not about the technique.
 *
 * **The summaries below are hand-written**, and the slide says so. There is no summariser
 * in this application and pretending otherwise would break the deck's own rule about never
 * asserting what it can measure. It measures what it can — the sizes, and whether the
 * expansion reproduces the original — and is explicit that it cannot measure whether a
 * summary is any good. That asymmetry is the point: it is why every lossy codec ends up
 * containing a model of a human.
 *
 * Every source text is public domain: two are US government works, one is a chess opening,
 * one is Lincoln.
 */

export interface SummaryMode {
  id: string
  label: string
  /** Absent for the lossless mode, which is generated from the dictionary. */
  text?: string
}

export interface SummaryText {
  id: string
  label: string
  credit: string
  /**
   * Character cells across the panel — and therefore the type size, which is the panel
   * width divided by this. Thirty-two is about twenty-five pixels on the stage; forty was
   * twenty, which is too small to read from the back of a room. Widen it only as far as the
   * longest text still fits without the layout's shrink retries firing.
   */
  cols: number
  lineFactor: number
  text: string
  /** What kind of codebook this is, printed under the picker. */
  codebook: string
  dictionary: Abbreviation[]
  /** Hand-written précis, longest first. */
  summaries: SummaryMode[]
}

export const SUMMARY_TEXTS: SummaryText[] = [
  {
    id: 'weather',
    label: 'Weather',
    credit: 'aerodrome forecast, decoded — a US government work',
    codebook: 'METAR/TAF, the international aviation weather code',
    cols: 32,
    lineFactor: 1.22,
    text:
      'Terminal aerodrome forecast, issued at 1730 zulu. ' +
      'Wind from 240 degrees at 15 knots. ' +
      'Visibility 10 statute miles. ' +
      'Few clouds at 3500 feet. ' +
      'Temporarily between 1900 and 2100 zulu, ' +
      'visibility 3 statute miles in light rain, ' +
      'broken clouds at 1200 feet. ' +
      'From 2200 zulu, wind from 270 degrees at 8 knots, ' +
      'visibility greater than 6 statute miles, ' +
      'scattered clouds at 4000 feet.',
    dictionary: [
      { phrase: 'Terminal aerodrome forecast, issued at 1730 zulu.', code: 'TAF 1730Z' },
      { phrase: 'Wind from 240 degrees at 15 knots.', code: '24015KT' },
      { phrase: 'Visibility 10 statute miles.', code: '10SM' },
      { phrase: 'Few clouds at 3500 feet.', code: 'FEW035' },
      { phrase: 'Temporarily between 1900 and 2100 zulu,', code: 'TEMPO 1921' },
      { phrase: 'visibility 3 statute miles in light rain,', code: '3SM -RA' },
      { phrase: 'broken clouds at 1200 feet.', code: 'BKN012' },
      { phrase: 'From 2200 zulu,', code: 'FM2200' },
      { phrase: 'wind from 270 degrees at 8 knots,', code: '27008KT' },
      { phrase: 'visibility greater than 6 statute miles,', code: 'P6SM' },
      { phrase: 'scattered clouds at 4000 feet.', code: 'SCT040' },
    ],
    summaries: [
      {
        id: 'half',
        label: 'Summary',
        text: 'Light winds and good visibility, with a spell of light rain and lower cloud ' +
          'in the early evening, clearing later.',
      },
      {
        id: 'tenth',
        label: 'One line',
        text: 'Fine, rain around 2000.',
      },
    ],
  },
  {
    id: 'signals',
    label: 'Signals',
    credit: 'Q-code radio traffic, in use since 1909',
    codebook: 'the international Q-code, three letters per phrase',
    cols: 32,
    lineFactor: 1.22,
    text:
      'What is your position? ' +
      'My position is latitude 51 north, longitude 4 west. ' +
      'Who is calling me? ' +
      'Have you anything for me? ' +
      'I have nothing for you. ' +
      'Your transmission is fading. ' +
      'Send more slowly. ' +
      'Can you acknowledge receipt? ' +
      'I acknowledge receipt. ' +
      'I will call you again at 1400. ' +
      'Stop sending.',
    dictionary: [
      { phrase: 'What is your position?', code: 'QTH?' },
      { phrase: 'My position is', code: 'QTH' },
      { phrase: 'Who is calling me?', code: 'QRZ?' },
      { phrase: 'Have you anything for me?', code: 'QRU?' },
      { phrase: 'I have nothing for you.', code: 'QRU' },
      { phrase: 'Your transmission is fading.', code: 'QSB' },
      { phrase: 'Send more slowly.', code: 'QRS' },
      { phrase: 'Can you acknowledge receipt?', code: 'QSL?' },
      { phrase: 'I acknowledge receipt.', code: 'QSL' },
      { phrase: 'I will call you again at', code: 'QRX' },
      { phrase: 'Stop sending.', code: 'QRT' },
      { phrase: 'latitude', code: 'LAT' },
      { phrase: 'longitude', code: 'LONG' },
    ],
    summaries: [
      {
        id: 'half',
        label: 'Summary',
        text: 'Exchanged positions, acknowledged receipt through some fading, and agreed to ' +
          'resume at 1400.',
      },
      { id: 'tenth', label: 'One line', text: 'Contact made; resuming at 1400.' },
    ],
  },
  {
    id: 'chess',
    label: 'Chess',
    credit: 'the Sicilian Defence, Najdorf variation',
    codebook: 'algebraic notation, in use since the eighteenth century',
    cols: 32,
    lineFactor: 1.22,
    text:
      'White advances the king pawn two squares. ' +
      'Black advances the queen bishop pawn two squares. ' +
      'White develops the king knight to f3. ' +
      'Black advances the queen pawn one square. ' +
      'White advances the queen pawn two squares. ' +
      'Black captures the pawn on d4. ' +
      'White recaptures with the knight. ' +
      'Black develops the king knight to f6. ' +
      'White develops the queen knight to c3. ' +
      'Black advances the queen rook pawn one square.',
    dictionary: [
      { phrase: 'White advances the king pawn two squares.', code: '1.e4' },
      { phrase: 'Black advances the queen bishop pawn two squares.', code: 'c5' },
      { phrase: 'White develops the king knight to f3.', code: '2.Nf3' },
      { phrase: 'Black advances the queen pawn one square.', code: 'd6' },
      { phrase: 'White advances the queen pawn two squares.', code: '3.d4' },
      { phrase: 'Black captures the pawn on d4.', code: 'cxd4' },
      { phrase: 'White recaptures with the knight.', code: '4.Nxd4' },
      { phrase: 'Black develops the king knight to f6.', code: 'Nf6' },
      { phrase: 'White develops the queen knight to c3.', code: '5.Nc3' },
      { phrase: 'Black advances the queen rook pawn one square.', code: 'a6' },
    ],
    summaries: [
      {
        id: 'half',
        label: 'Summary',
        text: 'Both sides developed in the centre, White traded a pawn and recaptured with a ' +
          'knight, and Black prepared queenside expansion.',
      },
      { id: 'tenth', label: 'One line', text: 'A Sicilian, Najdorf variation.' },
    ],
  },
  {
    id: 'prose',
    label: 'Prose',
    credit: 'Lincoln, Gettysburg Address, 1863',
    codebook: 'no agreed codebook exists — this is the control case',
    cols: 32,
    lineFactor: 1.22,
    text:
      'Four score and seven years ago our fathers brought forth on this continent, a new ' +
      'nation, conceived in Liberty, and dedicated to the proposition that all men are ' +
      'created equal. Now we are engaged in a great civil war, testing whether that nation, ' +
      'or any nation so conceived and so dedicated, can long endure.',
    // Deliberately thin. There is no established shorthand for English prose, and inventing
    // one for the slide would be inventing the result — the honest answer is that this route
    // barely pays, and that is the diagonal the picker exists to show.
    dictionary: [
      { phrase: 'nation', code: 'natn' },
      { phrase: 'dedicated', code: 'dedic' },
      { phrase: 'conceived', code: 'concvd' },
      { phrase: 'proposition', code: 'propn' },
    ],
    summaries: [
      {
        id: 'half',
        label: 'Summary',
        text: 'Our fathers founded a new nation on this continent, dedicated to the ' +
          'proposition that all men are created equal. We are now at war, testing whether ' +
          'such a nation can endure.',
      },
      { id: 'tenth', label: 'One line', text: 'A nation founded on equality, at war with itself.' },
    ],
  },
]

export function summaryTextById(id: string): SummaryText {
  return SUMMARY_TEXTS.find(t => t.id === id) ?? SUMMARY_TEXTS[0]
}
