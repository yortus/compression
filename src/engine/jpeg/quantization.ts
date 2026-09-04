import type { Block } from './types'

// Standard JPEG luminance quantization table (ITU-T T.81 Annex K)
export const LUMA_TABLE: Block = [
  [16, 11, 10, 16,  24,  40,  51,  61],
  [12, 12, 14, 19,  26,  58,  60,  55],
  [14, 13, 16, 24,  40,  57,  69,  56],
  [14, 17, 22, 29,  51,  87,  80,  62],
  [18, 22, 37, 56,  68, 109, 103,  77],
  [24, 35, 55, 64,  81, 104, 113,  92],
  [49, 64, 78, 87, 103, 121, 120, 101],
  [72, 92, 95, 98, 112, 100, 103,  99],
]

// Standard JPEG chrominance quantization table
export const CHROMA_TABLE: Block = [
  [17, 18, 24, 47, 99, 99, 99, 99],
  [18, 21, 26, 66, 99, 99, 99, 99],
  [24, 26, 56, 99, 99, 99, 99, 99],
  [47, 66, 99, 99, 99, 99, 99, 99],
  [99, 99, 99, 99, 99, 99, 99, 99],
  [99, 99, 99, 99, 99, 99, 99, 99],
  [99, 99, 99, 99, 99, 99, 99, 99],
  [99, 99, 99, 99, 99, 99, 99, 99],
]

export function scaleQTable(base: Block, quality: number): Block {
  const q = Math.max(1, Math.min(100, quality))
  const scale = q < 50 ? 5000 / q : 200 - 2 * q

  return base.map(row =>
    row.map(val => Math.max(1, Math.min(255, Math.floor((val * scale + 50) / 100))))
  )
}

export function quantize(dctBlock: Block, qTable: Block): Block {
  return dctBlock.map((row, u) =>
    row.map((val, v) => Math.round(val / qTable[u][v]))
  )
}

export function dequantize(quantized: Block, qTable: Block): Block {
  return quantized.map((row, u) =>
    row.map((val, v) => val * qTable[u][v])
  )
}

export function quantizeBlocks(blocks: Block[], qTable: Block): Block[] {
  return blocks.map(b => quantize(b, qTable))
}

export function dequantizeBlocks(blocks: Block[], qTable: Block): Block[] {
  return blocks.map(b => dequantize(b, qTable))
}
