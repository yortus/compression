// Generic codec contract shared by every technique in the deck.
//
// Two things the talk keeps insisting on are baked into this interface:
//   1. Compression is a two-way transform — every codec must be able to `decode`.
//   2. You need the message *and* a shared primer — `primerBits` is separate from
//      `payloadBits` so palette tables, code tables and escape conventions show up
//      in the stats instead of being quietly ignored.

export interface Encoded<T> {
  /** The encoded payload, in whatever shape the codec finds natural. */
  data: T
  /** Bits needed for the payload itself. */
  payloadBits: number
  /** Bits needed for the primer both sides must share (tables, dictionaries, conventions). */
  primerBits: number
}

export interface Codec<TIn, TEncoded> {
  /** Short label used in the stats HUD, e.g. "RLE" or "Palette + RLE". */
  readonly name: string
  /** True if decode cannot reproduce the input exactly. */
  readonly lossy: boolean
  encode(input: TIn): Encoded<TEncoded>
  decode(encoded: Encoded<TEncoded>): TIn
  /** Bits the raw input would take with no compression at all. */
  rawBits(input: TIn): number
}

export function totalBits<T>(e: Encoded<T>): number {
  return e.payloadBits + e.primerBits
}

/** Round-trip check used by the codec tests and by any slide that wants to prove invertibility. */
export function roundTrips<TIn, TEncoded>(
  codec: Codec<TIn, TEncoded>,
  input: TIn,
  equals: (a: TIn, b: TIn) => boolean,
): boolean {
  return equals(input, codec.decode(codec.encode(input)))
}
