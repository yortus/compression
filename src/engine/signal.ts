/**
 * One-dimensional cosine transform, for the slides that build up to the 2-D one.
 *
 * `engine/jpeg/dct.ts` is hard-wired to 8x8 blocks with the -128 level shift folded in,
 * which is exactly right for JPEG and useless for showing what a transform *is*. This is
 * the plain thing: a signal of any length, its cosine coefficients, and the way back.
 *
 * The transform is DCT-II, orthonormal — the same variant JPEG uses, scaled so that the
 * forward and inverse are exact inverses of each other and coefficient magnitudes are
 * directly comparable to sample magnitudes. That matters on these slides, where the whole
 * argument is "the same information, counted differently".
 */

export const SIGNAL_LENGTH = 64

const cosCache = new Map<number, Float64Array>()

/** cos(pi (2n+1) k / 2N) for every (k, n), computed once per length. */
function cosTable(n: number): Float64Array {
  let table = cosCache.get(n)
  if (table) return table
  table = new Float64Array(n * n)
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      table[k * n + i] = Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n))
    }
  }
  cosCache.set(n, table)
  return table
}

function alpha(k: number, n: number): number {
  return k === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n)
}

/** Forward DCT-II. Coefficient k is how much of basis wave k the signal contains. */
export function dct1d(x: readonly number[]): number[] {
  const n = x.length
  const cos = cosTable(n)
  const out = new Array<number>(n)
  for (let k = 0; k < n; k++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += x[i] * cos[k * n + i]
    out[k] = alpha(k, n) * sum
  }
  return out
}

/** Inverse (DCT-III). `idct1d(dct1d(x))` returns `x` to floating-point precision. */
export function idct1d(coeffs: readonly number[]): number[] {
  const n = coeffs.length
  const cos = cosTable(n)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) sum += alpha(k, n) * coeffs[k] * cos[k * n + i]
    out[i] = sum
  }
  return out
}

/** Basis wave k, at unit amplitude — the shapes every signal is built out of. */
export function basisVector(k: number, n = SIGNAL_LENGTH): number[] {
  const cos = cosTable(n)
  const a = alpha(k, n)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = a * cos[k * n + i]
  return out
}

/** Basis wave k scaled by its coefficient — one of the layers in the stack. */
export function component(coeffs: readonly number[], k: number): number[] {
  const basis = basisVector(k, coeffs.length)
  return basis.map(v => v * coeffs[k])
}

/** Everything but the first `keep` coefficients thrown away. */
export function keepFirst(coeffs: readonly number[], keep: number): number[] {
  const n = coeffs.length
  const k = Math.max(0, Math.min(n, keep))
  const out = new Array<number>(n).fill(0)
  for (let i = 0; i < k; i++) out[i] = coeffs[i]
  return out
}

/** Reconstruction from the first `keep` coefficients only. */
export function partialReconstruct(coeffs: readonly number[], keep: number): number[] {
  return idct1d(keepFirst(coeffs, keep))
}

export function rmse(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum / a.length)
}

/** Coefficients needed to hold `fraction` of the signal's energy, in order. */
export function energyRank(coeffs: readonly number[], fraction: number): number {
  const total = coeffs.reduce((s, c) => s + c * c, 0)
  if (total === 0) return 0
  let running = 0
  for (let k = 0; k < coeffs.length; k++) {
    running += coeffs[k] * coeffs[k]
    if (running / total >= fraction) return k + 1
  }
  return coeffs.length
}

// --- Signals to play with ---------------------------------------------------

export interface SignalPreset {
  name: string
  /** Why it is here — each one breaks or flatters the transform differently. */
  hint: string
  samples: number[]
}

function build(fn: (t: number, i: number) => number): number[] {
  return Array.from({ length: SIGNAL_LENGTH }, (_, i) => {
    const v = fn(i / (SIGNAL_LENGTH - 1), i)
    return Math.max(0, Math.min(1, v))
  })
}

// A fixed sequence, so the "noise" preset looks the same in every run of the talk.
function pseudoRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const noise = pseudoRandom(7)

export const SIGNAL_PRESETS: SignalPreset[] = [
  {
    name: 'Smooth',
    hint: 'a few low frequencies carry almost everything',
    // Half-cycle harmonics, so they land on the DCT's own basis rather than smearing
    // across it — the slide's claim is that a few coefficients suffice, and it should.
    samples: build(t => 0.5 + 0.33 * Math.cos(Math.PI * t) + 0.12 * Math.cos(3 * Math.PI * t)),
  },
  {
    name: 'Edge',
    hint: 'one sharp step needs every frequency to build the corner',
    samples: build(t => (t < 0.45 ? 0.2 : 0.85)),
  },
  {
    name: 'Ramp',
    hint: 'gentle, but the wrap-around at the ends still costs coefficients',
    samples: build(t => 0.1 + 0.8 * t),
  },
  {
    name: 'Spike',
    hint: 'the worst case — a single sample is spread across all 64 coefficients',
    samples: build((_, i) => (i === 24 ? 1 : 0.15)),
  },
  {
    name: 'Noise',
    hint: 'no structure to find, so no ordering of coefficients helps',
    samples: build(() => 0.15 + 0.7 * noise()),
  },
]
