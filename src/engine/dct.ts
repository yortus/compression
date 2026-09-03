import type { Block } from './types'
import { ZIGZAG_ORDER } from './zigzag'

const SQRT2_INV = 1 / Math.sqrt(2)

// Precompute cos((2x+1)*u*PI/16) for x,u in [0..7]
const COS = new Float64Array(64)
for (let x = 0; x < 8; x++) {
  for (let u = 0; u < 8; u++) {
    COS[x * 8 + u] = Math.cos(((2 * x + 1) * u * Math.PI) / 16)
  }
}

// Separable transform matrix: A[k][n] = C(k) * cos((2n+1)*k*PI/16) * 0.5
const A = new Float64Array(64)
for (let k = 0; k < 8; k++) {
  const ck = k === 0 ? SQRT2_INV : 1
  for (let n = 0; n < 8; n++) {
    A[k * 8 + n] = ck * COS[n * 8 + k] * 0.5
  }
}

// Reusable scratch buffer — avoids allocation in hot loop
const _tmp = new Float64Array(64)

export function forwardDCT(block: Block): Block {
  const result: Block = Array.from({ length: 8 }, () => new Array<number>(8))

  // temp = A * (block - 128)
  for (let u = 0; u < 8; u++) {
    const uOff = u * 8
    for (let y = 0; y < 8; y++) {
      let sum = 0
      for (let x = 0; x < 8; x++) sum += A[uOff + x] * (block[x][y] - 128)
      _tmp[uOff + y] = sum
    }
  }

  // F = temp * A^T
  for (let u = 0; u < 8; u++) {
    const uOff = u * 8
    for (let v = 0; v < 8; v++) {
      const vOff = v * 8
      let sum = 0
      for (let y = 0; y < 8; y++) sum += _tmp[uOff + y] * A[vOff + y]
      result[u][v] = sum
    }
  }

  return result
}

export function inverseDCT(coefficients: Block): Block {
  const result: Block = Array.from({ length: 8 }, () => new Array<number>(8))

  // temp = A^T * F  (A^T[x][u] = A[u][x])
  for (let x = 0; x < 8; x++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0
      for (let u = 0; u < 8; u++) sum += A[u * 8 + x] * coefficients[u][v]
      _tmp[x * 8 + v] = sum
    }
  }

  // f = temp * A + 128
  for (let x = 0; x < 8; x++) {
    const xOff = x * 8
    for (let y = 0; y < 8; y++) {
      let sum = 0
      for (let v = 0; v < 8; v++) sum += _tmp[xOff + v] * A[v * 8 + y]
      result[x][y] = Math.round(sum + 128)
    }
  }

  return result
}

export function forwardDCTBlocks(blocks: Block[]): Block[] {
  return blocks.map(forwardDCT)
}

export function inverseDCTBlocks(blocks: Block[]): Block[] {
  return blocks.map(inverseDCT)
}

// Keep only the first `count` coefficients (zigzag order) and reconstruct
export function partialInverseDCT(coefficients: Block, count: number): Block {
  const clamped = Math.max(0, Math.min(64, count))
  const partial: Block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  for (let i = 0; i < clamped; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    partial[r][c] = coefficients[r][c]
  }
  return inverseDCT(partial)
}

// 8×8 DCT basis function image (values in 0..255 for rendering)
export function basisFunction(u: number, v: number): Block {
  const block: Block = Array.from({ length: 8 }, () => new Array<number>(8))
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      block[x][y] = 128 + 127 * COS[x * 8 + u] * COS[y * 8 + v]
    }
  }
  return block
}
