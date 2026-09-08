/**
 * Baseline JPEG AC entropy coding, priced with the *standard* luminance AC Huffman table
 * (ITU-T T.81, Table K.5). This is what actually decides whether a scan order is cheap.
 *
 * Walking the 63 AC coefficients in scan order, each non-zero becomes a `(RUNLENGTH, SIZE)`
 * symbol — how many zeros preceded it, and how many bits its magnitude needs — Huffman
 * coded from the fixed table, followed by SIZE raw amplitude bits. A run longer than 15 is
 * broken by ZRL `(15, 0)`, and once only zeros remain the block ends with a single EOB
 * `(0, 0)`. Zigzag order wins because it groups the non-zeros: the runs stay short (the
 * common, short-coded symbols) and every trailing zero is swallowed by that one EOB, where
 * row order scatters the non-zeros into long, rare, expensive runs and reaches EOB late.
 *
 * The DC coefficient is deliberately not priced here. JPEG codes it once, as the difference
 * from the previous block's DC (DPCM), and it sits at position 0 in every scan order — so it
 * is identical whichever way the AC coefficients are read, and cancels in any comparison.
 */

// Table K.5, verbatim: the count of codes of each length 1..16, then the symbols they map to
// in that order. A symbol byte is (run << 4) | size; 0x00 is EOB and 0xF0 is ZRL.
const BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125]
const HUFFVAL = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61,
  0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52,
  0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25,
  0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64,
  0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83,
  0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99,
  0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3,
  0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8,
  0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
]

const CODE_LEN: ReadonlyMap<number, number> = (() => {
  const len = new Map<number, number>()
  let k = 0
  for (let bitLen = 1; bitLen <= 16; bitLen++) {
    for (let n = 0; n < BITS[bitLen - 1]; n++) len.set(HUFFVAL[k++], bitLen)
  }
  return len
})()

/** JPEG size category: the number of bits the magnitude needs, and 0 for a zero. */
export function sizeCategory(value: number): number {
  let v = Math.abs(value)
  let s = 0
  while (v > 0) { s++; v = Math.floor(v / 2) }
  return s
}

/** Length of the `(RUNLENGTH, SIZE)` Huffman code; anything off the table falls back to 16. */
function codeLen(symbol: number): number {
  return CODE_LEN.get(symbol) ?? 16
}

/**
 * Total AC bits a 64-length block costs when read in a given scan order: the Huffman code
 * for each non-zero's `(run, size)` symbol plus its `size` amplitude bits, ZRL for any run
 * past 15, and a closing EOB whenever the block ends in zeros. DC (index 0) is skipped.
 */
export function acEncodedBits(seq: readonly number[]): number {
  let bits = 0
  let run = 0
  for (let i = 1; i < 64; i++) {
    if (seq[i] === 0) { run++; continue }
    while (run > 15) { bits += codeLen(0xf0); run -= 16 }
    const size = sizeCategory(seq[i])
    bits += codeLen((run << 4) | size) + size
    run = 0
  }
  if (run > 0) bits += codeLen(0x00) // EOB closes the trailing zeros
  return bits
}
