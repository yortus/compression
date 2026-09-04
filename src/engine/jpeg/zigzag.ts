import type { Block } from './types'

// Standard JPEG zigzag order: maps linear index → (row, col)
const ZIGZAG_ORDER: [number, number][] = [
  [0,0],[0,1],[1,0],[2,0],[1,1],[0,2],[0,3],[1,2],
  [2,1],[3,0],[4,0],[3,1],[2,2],[1,3],[0,4],[0,5],
  [1,4],[2,3],[3,2],[4,1],[5,0],[6,0],[5,1],[4,2],
  [3,3],[2,4],[1,5],[0,6],[0,7],[1,6],[2,5],[3,4],
  [4,3],[5,2],[6,1],[7,0],[7,1],[6,2],[5,3],[4,4],
  [3,5],[2,6],[1,7],[2,7],[3,6],[4,5],[5,4],[6,3],
  [7,2],[7,3],[6,4],[5,5],[4,6],[3,7],[4,7],[5,6],
  [6,5],[7,4],[7,5],[6,6],[5,7],[6,7],[7,6],[7,7],
]

// Inverse map: (row, col) → linear index
const ZIGZAG_INVERSE = new Uint8Array(64)
for (let i = 0; i < 64; i++) {
  const [r, c] = ZIGZAG_ORDER[i]
  ZIGZAG_INVERSE[r * 8 + c] = i
}

export { ZIGZAG_ORDER }

export function zigzagScan(block: Block): number[] {
  return ZIGZAG_ORDER.map(([r, c]) => block[r][c])
}

export function zigzagUnscan(flat: number[]): Block {
  const block: Block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  for (let i = 0; i < 64; i++) {
    const [r, c] = ZIGZAG_ORDER[i]
    block[r][c] = flat[i]
  }
  return block
}

export function zigzagIndex(row: number, col: number): number {
  return ZIGZAG_INVERSE[row * 8 + col]
}
