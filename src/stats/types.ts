/**
 * What a slide reports to the always-on stats HUD.
 *
 * `overheadBits` is deliberately separate from `encodedBits` (which excludes it) so the
 * HUD can show the primer as its own slice — the "you need a shared codebook too" point
 * has to be visible in the numbers, not just said out loud.
 */
export interface StatSample {
  /** What was compressed, e.g. "Photo · RLE over RGB". */
  label: string
  rawBits: number
  /** Payload bits only. */
  encodedBits: number
  /** Primer/table bits that must also be transmitted. */
  overheadBits: number
  lossy: boolean
  /** Optional aside, e.g. "estimated from one block". */
  note?: string
}

export interface StatDerived extends StatSample {
  totalBits: number
  ratio: number
  /** Negative when the "compressed" form is bigger than the input — which some slides want. */
  savedPercent: number
  expanded: boolean
}

export function derive(s: StatSample): StatDerived {
  const totalBits = s.encodedBits + s.overheadBits
  const ratio = totalBits > 0 ? s.rawBits / totalBits : 0
  return {
    ...s,
    totalBits,
    ratio,
    savedPercent: s.rawBits > 0 ? (1 - totalBits / s.rawBits) * 100 : 0,
    expanded: totalBits > s.rawBits,
  }
}

export function formatBytes(bits: number): string {
  const bytes = bits / 8
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
