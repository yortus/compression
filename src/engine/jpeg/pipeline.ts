import type { Block, SubsamplingMode, AllBlocks, YcbcrData, SubsampledData, RLEPair, HuffmanResult } from './types'
import { imageToYcbcr, ycbcrToImageData } from './colorspace'
import { subsample, upsample } from './subsampling'
import { splitAllChannels, mergeBlocks } from './blocks'
import { forwardDCTBlocks, inverseDCTBlocks } from './dct'
import { scaleQTable, quantizeBlocks, dequantizeBlocks, LUMA_TABLE, CHROMA_TABLE } from './quantization'
import { zigzagScan } from './zigzag'
import { encodeRLE } from './rle'
import { encodeBlock } from './huffman'

export interface PipelineCache {
  ycbcr: YcbcrData
  subsampled: SubsampledData
  allBlocks: AllBlocks
  dctBlocks: AllBlocks
  quantizedBlocks: AllBlocks
  reconstructed: ImageData
}

export function runFullPipeline(
  source: ImageData,
  quality: number,
  subsamplingMode: SubsamplingMode,
): PipelineCache {
  // 1 — Color space
  const ycbcr = imageToYcbcr(source)

  // 2 — Chroma subsampling
  const subsampled = subsample(ycbcr, subsamplingMode)

  // 3 — Block splitting
  const allBlocks = splitAllChannels(subsampled)

  // 4 — DCT
  const dctBlocks: AllBlocks = {
    y: { ...allBlocks.y, blocks: forwardDCTBlocks(allBlocks.y.blocks) },
    cb: { ...allBlocks.cb, blocks: forwardDCTBlocks(allBlocks.cb.blocks) },
    cr: { ...allBlocks.cr, blocks: forwardDCTBlocks(allBlocks.cr.blocks) },
  }

  // 5 — Quantization
  const lumaQ = scaleQTable(LUMA_TABLE, quality)
  const chromaQ = scaleQTable(CHROMA_TABLE, quality)
  const quantizedBlocks: AllBlocks = {
    y: { ...dctBlocks.y, blocks: quantizeBlocks(dctBlocks.y.blocks, lumaQ) },
    cb: { ...dctBlocks.cb, blocks: quantizeBlocks(dctBlocks.cb.blocks, chromaQ) },
    cr: { ...dctBlocks.cr, blocks: quantizeBlocks(dctBlocks.cr.blocks, chromaQ) },
  }

  // --- Inverse for reconstruction ---
  const reconstructed = reconstruct(quantizedBlocks, quality, subsampled)

  return { ycbcr, subsampled, allBlocks, dctBlocks, quantizedBlocks, reconstructed }
}

// Fast path: only re-run quantization + reconstruction (skips colorspace, subsampling, blocks, DCT)
export function requantize(prev: PipelineCache, quality: number): PipelineCache {
  const lumaQ = scaleQTable(LUMA_TABLE, quality)
  const chromaQ = scaleQTable(CHROMA_TABLE, quality)
  const quantizedBlocks: AllBlocks = {
    y: { ...prev.dctBlocks.y, blocks: quantizeBlocks(prev.dctBlocks.y.blocks, lumaQ) },
    cb: { ...prev.dctBlocks.cb, blocks: quantizeBlocks(prev.dctBlocks.cb.blocks, chromaQ) },
    cr: { ...prev.dctBlocks.cr, blocks: quantizeBlocks(prev.dctBlocks.cr.blocks, chromaQ) },
  }
  const reconstructed = reconstruct(quantizedBlocks, quality, prev.subsampled)

  return { ...prev, quantizedBlocks, reconstructed }
}

export function reconstruct(
  quantizedBlocks: AllBlocks,
  quality: number,
  subsampled: SubsampledData,
): ImageData {
  const lumaQ = scaleQTable(LUMA_TABLE, quality)
  const chromaQ = scaleQTable(CHROMA_TABLE, quality)

  // Dequantize
  const dqY = dequantizeBlocks(quantizedBlocks.y.blocks, lumaQ)
  const dqCb = dequantizeBlocks(quantizedBlocks.cb.blocks, chromaQ)
  const dqCr = dequantizeBlocks(quantizedBlocks.cr.blocks, chromaQ)

  // Inverse DCT
  const reconY = inverseDCTBlocks(dqY)
  const reconCb = inverseDCTBlocks(dqCb)
  const reconCr = inverseDCTBlocks(dqCr)

  // Merge blocks back into channels
  const yChannel = mergeBlocks({ ...quantizedBlocks.y, blocks: reconY })
  const cbChannel = mergeBlocks({ ...quantizedBlocks.cb, blocks: reconCb })
  const crChannel = mergeBlocks({ ...quantizedBlocks.cr, blocks: reconCr })

  // Upsample chroma
  const upsampled = upsample({
    y: yChannel,
    cb: cbChannel,
    cr: crChannel,
    yWidth: subsampled.yWidth,
    yHeight: subsampled.yHeight,
    chromaWidth: subsampled.chromaWidth,
    chromaHeight: subsampled.chromaHeight,
    mode: subsampled.mode,
  })

  // YCbCr → RGB
  return ycbcrToImageData(upsampled)
}

/**
 * Estimated size of the whole encoded image, in bits.
 *
 * Huffman-codes a spread of blocks and scales up rather than extrapolating from a single
 * block, which was giving figures that swung wildly depending on which block happened to
 * be selected. Still an estimate — there is no real bitstream here, no DC differential
 * coding and no standard tables — but a stable one, and the same one everywhere.
 */
export function estimateEncodedBits(cache: PipelineCache, sampleCount = 64): number {
  let total = 0
  for (const channel of [cache.quantizedBlocks.y, cache.quantizedBlocks.cb, cache.quantizedBlocks.cr]) {
    const n = channel.blocks.length
    if (n === 0) continue
    const step = Math.max(1, Math.floor(n / sampleCount))
    let bits = 0
    let sampled = 0
    for (let i = 0; i < n; i += step) {
      bits += getBlockHuffman(channel.blocks[i]).totalBits
      sampled++
    }
    total += (bits / sampled) * n
  }
  return Math.round(total)
}

// Per-block helpers for visualisation steps 6-8
export function getBlockZigzag(block: Block): number[] {
  return zigzagScan(block)
}

export function getBlockRLE(block: Block): RLEPair[] {
  return encodeRLE(zigzagScan(block))
}

export function getBlockHuffman(block: Block): HuffmanResult {
  return encodeBlock(encodeRLE(zigzagScan(block)))
}
