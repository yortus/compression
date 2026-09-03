import type { Block, ChannelBlocks, SubsampledData, AllBlocks } from './types'

export function splitIntoBlocks(
  channel: Float64Array,
  width: number,
  height: number,
): ChannelBlocks {
  const paddedWidth = Math.ceil(width / 8) * 8
  const paddedHeight = Math.ceil(height / 8) * 8
  const blocksPerRow = paddedWidth / 8
  const blocksPerCol = paddedHeight / 8

  const blocks: Block[] = []
  for (let by = 0; by < blocksPerCol; by++) {
    for (let bx = 0; bx < blocksPerRow; bx++) {
      const block: Block = []
      for (let row = 0; row < 8; row++) {
        const blockRow: number[] = []
        for (let col = 0; col < 8; col++) {
          const pRow = Math.min(by * 8 + row, height - 1)
          const pCol = Math.min(bx * 8 + col, width - 1)
          blockRow.push(channel[pRow * width + pCol])
        }
        block.push(blockRow)
      }
      blocks.push(block)
    }
  }

  return { blocks, blocksPerRow, blocksPerCol, paddedWidth, paddedHeight, originalWidth: width, originalHeight: height }
}

export function mergeBlocks(channelBlocks: ChannelBlocks): Float64Array {
  const { blocks, blocksPerRow, originalWidth, originalHeight } = channelBlocks
  const result = new Float64Array(originalWidth * originalHeight)

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const bx = blockIdx % blocksPerRow
    const by = Math.floor(blockIdx / blocksPerRow)
    const block = blocks[blockIdx]

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pRow = by * 8 + row
        const pCol = bx * 8 + col
        if (pRow < originalHeight && pCol < originalWidth) {
          result[pRow * originalWidth + pCol] = block[row][col]
        }
      }
    }
  }

  return result
}

export function splitAllChannels(data: SubsampledData): AllBlocks {
  return {
    y: splitIntoBlocks(data.y, data.yWidth, data.yHeight),
    cb: splitIntoBlocks(data.cb, data.chromaWidth, data.chromaHeight),
    cr: splitIntoBlocks(data.cr, data.chromaWidth, data.chromaHeight),
  }
}
