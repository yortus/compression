/**
 * Two-dimensional cosine transform, for the slide that lifts `waves-intro` into 2-D.
 *
 * A 2-D shape is a grid of values, and — exactly as in one dimension — it is a sum of
 * fixed cosine patterns. The transform is *separable*: run the 1-D DCT along every row,
 * then along every column, and the result is the 2-D DCT. That reuses the tested,
 * orthonormal `dct1d`/`idct1d` from `signal.ts`, so magnitudes here are directly
 * comparable to the sample values, and `idct2d(dct2d(x))` returns `x` to floating point.
 *
 * Coefficients are kept in JPEG's own zigzag order, so "the first N waves" means the same
 * low-frequency-first thing it does on the 1-D slide, and foreshadows the Zigzag slide.
 */

import { dct1d, idct1d } from './signal'
import { ZIGZAG_ORDER } from './jpeg/zigzag'

export const GRID = 8

type Grid = number[][]

/** 1-D DCT along rows, then along columns — the separable 2-D forward transform. */
export function dct2d(grid: readonly number[][]): Grid {
  const n = grid.length
  const rows = grid.map(r => dct1d(r))
  const out: Grid = Array.from({ length: n }, () => new Array<number>(n))
  const col = new Array<number>(n)
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) col[r] = rows[r][c]
    const dc = dct1d(col)
    for (let r = 0; r < n; r++) out[r][c] = dc[r]
  }
  return out
}

/** Inverse of `dct2d`. `idct2d(dct2d(x))` reproduces `x` to floating-point precision. */
export function idct2d(coeffs: readonly number[][]): Grid {
  const n = coeffs.length
  const tmp: Grid = Array.from({ length: n }, () => new Array<number>(n))
  const col = new Array<number>(n)
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) col[r] = coeffs[r][c]
    const ic = idct1d(col)
    for (let r = 0; r < n; r++) tmp[r][c] = ic[r]
  }
  return tmp.map(r => idct1d(r))
}

/** Every coefficient past the first `keep` in zigzag order thrown away. */
export function keepZigzag2d(coeffs: readonly number[][], keep: number): Grid {
  const n = coeffs.length
  const out: Grid = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const k = Math.max(0, Math.min(ZIGZAG_ORDER.length, keep))
  for (let i = 0; i < k; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    out[r][c] = coeffs[r][c]
  }
  return out
}

/** Reconstruction from the first `keep` coefficients in zigzag order only. */
export function partialReconstruct2d(coeffs: readonly number[][], keep: number): Grid {
  return idct2d(keepZigzag2d(coeffs, keep))
}

/** Coefficients needed, in zigzag order, to hold `fraction` of the grid's energy. */
export function energyRank2d(coeffs: readonly number[][], fraction: number): number {
  let total = 0
  for (const [r, c] of ZIGZAG_ORDER) total += coeffs[r][c] * coeffs[r][c]
  if (total === 0) return 0
  let running = 0
  for (let i = 0; i < ZIGZAG_ORDER.length; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    running += coeffs[r][c] * coeffs[r][c]
    if (running / total >= fraction) return i + 1
  }
  return ZIGZAG_ORDER.length
}

export function rmse2d(a: readonly number[][], b: readonly number[][]): number {
  let sum = 0
  let n = 0
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[r].length; c++) {
      const d = a[r][c] - b[r][c]
      sum += d * d
      n++
    }
  }
  return Math.sqrt(sum / n)
}

// --- Shapes to play with ------------------------------------------------------

export interface ShapePreset {
  name: string
  /** Why it is here — each one breaks or flatters the transform differently. */
  hint: string
  grid: Grid
}

/** An 8×8 bitmap from ASCII art: `#` is full intensity, anything else is empty. */
function fromArt(rows: string[]): Grid {
  return rows.map(row => Array.from(row).map(ch => (ch === '#' ? 1 : 0)))
}

/** An 8×8 grid from a function of cell position, clamped to 0..1. */
function fromFn(fn: (i: number, j: number) => number): Grid {
  return Array.from({ length: GRID }, (_, i) =>
    Array.from({ length: GRID }, (_, j) => Math.max(0, Math.min(1, fn(i, j)))))
}

/** Rotate a square grid 90° anticlockwise, so a diagonal reads across the surface view. */
function rotateCCW(g: Grid): Grid {
  const n = g.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => g[j][n - 1 - i]))
}

export const SHAPE_PRESETS: ShapePreset[] = [
  {
    name: 'Heart',
    hint: 'a rounded blob — a handful of low patterns get most of the way there',
    grid: fromArt([
      '.##..##.',
      '########',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
      '........',
    ]),
  },
  {
    name: 'Arrow',
    hint: 'straight edges and a point — needs the diagonals as well as the low patterns',
    grid: fromArt([
      '...##...',
      '..####..',
      '.######.',
      '########',
      '...##...',
      '...##...',
      '...##...',
      '...##...',
    ]),
  },
  {
    name: 'Ring',
    hint: 'a hole in the middle — the edges cost more than the fill would have',
    grid: fromArt([
      '..####..',
      '.#....#.',
      '#......#',
      '#......#',
      '#......#',
      '#......#',
      '.#....#.',
      '..####..',
    ]),
  },
  {
    name: 'Gradient',
    hint: 'a smooth ramp — one or two patterns already have it',
    grid: rotateCCW(fromFn((i, j) => (i + j) / (2 * (GRID - 1)))),
  },
  {
    name: 'Edge',
    hint: 'a diagonal step — a corner is built out of nearly every pattern at once',
    grid: rotateCCW(fromFn((i, j) => (i + j < GRID - 1 ? 0.9 : 0.1))),
  },
  {
    name: 'Checker',
    hint: 'the worst case — all the energy sits in the single fastest pattern',
    grid: fromFn((i, j) => ((i + j) % 2 ? 0.9 : 0.1)),
  },
]
