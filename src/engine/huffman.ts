import type { HuffmanNode, HuffmanResult, RLEPair } from './types'

export function buildTree(frequencies: Map<number, number>): HuffmanNode {
  const nodes: HuffmanNode[] = []
  for (const [symbol, freq] of frequencies) {
    nodes.push({ symbol, frequency: freq })
  }

  if (nodes.length === 0) {
    return { frequency: 0 }
  }
  if (nodes.length === 1) {
    return { frequency: nodes[0].frequency, left: nodes[0] }
  }

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.frequency - b.frequency)
    const left = nodes.shift()!
    const right = nodes.shift()!
    nodes.push({
      frequency: left.frequency + right.frequency,
      left,
      right,
    })
  }

  return nodes[0]
}

export function buildCodeTable(tree: HuffmanNode): Map<number, string> {
  const codes = new Map<number, string>()

  function walk(node: HuffmanNode, prefix: string) {
    if (node.symbol !== undefined) {
      codes.set(node.symbol, prefix || '0')
      return
    }
    if (node.left) walk(node.left, prefix + '0')
    if (node.right) walk(node.right, prefix + '1')
  }

  walk(tree, '')
  return codes
}

// Encode a single block's RLE pairs for visualisation purposes.
// We pack (runLength, value) into a single integer key for frequency counting.
export function encodeBlock(rlePairs: RLEPair[]): HuffmanResult {
  // Build symbol set: pack (runLength << 16) | (value & 0xFFFF)
  const symbols: number[] = rlePairs.map(p => packSymbol(p.runLength, p.value))

  const freq = new Map<number, number>()
  for (const s of symbols) {
    freq.set(s, (freq.get(s) ?? 0) + 1)
  }

  const tree = buildTree(freq)
  const codes = buildCodeTable(tree)

  let bitstring = ''
  for (const s of symbols) {
    bitstring += codes.get(s) ?? ''
  }

  return {
    tree,
    codes,
    bitstring,
    totalBits: bitstring.length,
    originalBits: rlePairs.length * 16,
  }
}

export function packSymbol(runLength: number, value: number): number {
  return (runLength << 16) | (value & 0xFFFF)
}

export function unpackSymbol(packed: number): { runLength: number; value: number } {
  const runLength = (packed >>> 16) & 0xFF
  let value = packed & 0xFFFF
  if (value >= 0x8000) value -= 0x10000
  return { runLength, value }
}
