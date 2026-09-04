export type Block = number[][]

export type SubsamplingMode = '4:4:4' | '4:2:2' | '4:2:0'

export interface YcbcrData {
  y: Float64Array
  cb: Float64Array
  cr: Float64Array
  width: number
  height: number
}

export interface SubsampledData {
  y: Float64Array
  cb: Float64Array
  cr: Float64Array
  yWidth: number
  yHeight: number
  chromaWidth: number
  chromaHeight: number
  mode: SubsamplingMode
}

export interface ChannelBlocks {
  blocks: Block[]
  blocksPerRow: number
  blocksPerCol: number
  paddedWidth: number
  paddedHeight: number
  originalWidth: number
  originalHeight: number
}

export interface AllBlocks {
  y: ChannelBlocks
  cb: ChannelBlocks
  cr: ChannelBlocks
}

export interface RLEPair {
  runLength: number
  value: number
}

export interface HuffmanNode {
  symbol?: number
  frequency: number
  left?: HuffmanNode
  right?: HuffmanNode
}

export interface HuffmanResult {
  tree: HuffmanNode
  codes: Map<number, string>
  bitstring: string
  totalBits: number
  originalBits: number
}
