/**
 * Huffman coding over an arbitrary symbol type.
 *
 * `engine/jpeg/huffman.ts` codes packed (runLength, value) integers and nothing else.
 * The Codes-act slides want to build a tree over whatever the audience types, so this is
 * the same algorithm with the JPEG assumptions taken out.
 *
 * Two things here exist purely for the slide rather than for the codec:
 *
 *   - **`steps`.** Every merge is recorded with the pool as it stood afterwards, so the
 *     build can be replayed one combine at a time instead of appearing fully formed.
 *   - **Stable ids.** Ties are broken by insertion order rather than by whatever the
 *     sort happens to do, so the tree does not reshuffle itself while someone is typing.
 */

export interface HuffNode<S> {
  /** Insertion order — the tie-break, and a stable key for rendering. */
  id: number
  weight: number
  /** Present on leaves only. */
  symbol?: S
  left?: HuffNode<S>
  right?: HuffNode<S>
}

export interface MergeStep<S> {
  left: HuffNode<S>
  right: HuffNode<S>
  parent: HuffNode<S>
  /** The pool after this merge, lightest first — what is left on the table. */
  pool: HuffNode<S>[]
}

export interface HuffmanBuild<S> {
  tree: HuffNode<S> | null
  codes: Map<S, string>
  steps: MergeStep<S>[]
  /** Leaves in first-appearance order. */
  leaves: HuffNode<S>[]
}

export function countSymbols<S>(symbols: readonly S[]): Map<S, number> {
  const counts = new Map<S, number>()
  for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1)
  return counts
}

/** Lightest first; ties broken by insertion order so the shape never jitters. */
function lighter<S>(a: HuffNode<S>, b: HuffNode<S>) {
  return a.weight - b.weight || a.id - b.id
}

export function buildHuffman<S>(counts: Map<S, number>): HuffmanBuild<S> {
  let nextId = 0
  const leaves: HuffNode<S>[] = []
  for (const [symbol, weight] of counts) {
    leaves.push({ id: nextId++, weight, symbol })
  }

  if (leaves.length === 0) {
    return { tree: null, codes: new Map(), steps: [], leaves }
  }

  const pool = [...leaves]
  const steps: MergeStep<S>[] = []

  // A single distinct symbol still needs a code, so give it a one-bit one by pairing
  // it with nothing — otherwise the walk below assigns it the empty string.
  while (pool.length > 1) {
    pool.sort(lighter)
    const left = pool.shift()!
    const right = pool.shift()!
    const parent: HuffNode<S> = { id: nextId++, weight: left.weight + right.weight, left, right }
    pool.push(parent)
    pool.sort(lighter)
    steps.push({ left, right, parent, pool: [...pool] })
  }

  const tree = pool[0]
  return { tree, codes: buildCodes(tree), steps, leaves }
}

export function buildCodes<S>(tree: HuffNode<S>): Map<S, string> {
  const codes = new Map<S, string>()
  function walk(node: HuffNode<S>, prefix: string) {
    if (node.symbol !== undefined) {
      // The degenerate one-symbol alphabet still costs a bit per symbol.
      codes.set(node.symbol, prefix || '0')
      return
    }
    if (node.left) walk(node.left, prefix + '0')
    if (node.right) walk(node.right, prefix + '1')
  }
  walk(tree, '')
  return codes
}

export function encodeSymbols<S>(symbols: readonly S[], codes: Map<S, string>): string {
  const parts: string[] = []
  for (const s of symbols) parts.push(codes.get(s) ?? '')
  return parts.join('')
}

/** Bits the message itself costs, without materialising the bitstring. */
export function payloadBits<S>(counts: Map<S, number>, codes: Map<S, string>): number {
  let bits = 0
  for (const [symbol, count] of counts) bits += count * (codes.get(symbol)?.length ?? 0)
  return bits
}

/**
 * Cost of shipping the code table — the primer the decoder cannot work without.
 * One symbol, one 5-bit length, then the code itself.
 */
export function codeTableBits<S>(codes: Map<S, string>, symbolBits = 8): number {
  let bits = 0
  for (const [, code] of codes) bits += symbolBits + 5 + code.length
  return bits
}

/** Walks the tree — the proof that the prefix code is decodable at all. */
export function decodeBits<S>(tree: HuffNode<S>, bits: string): S[] {
  const out: S[] = []
  if (tree.symbol !== undefined) {
    // One-symbol alphabet: every bit is that symbol.
    for (let i = 0; i < bits.length; i++) out.push(tree.symbol)
    return out
  }
  let node = tree
  for (const bit of bits) {
    const next = bit === '0' ? node.left : node.right
    if (!next) break
    node = next
    if (node.symbol !== undefined) {
      out.push(node.symbol)
      node = tree
    }
  }
  return out
}

/** Depth of the deepest leaf — the longest code, and the height to draw. */
export function treeDepth<S>(node: HuffNode<S> | null): number {
  if (!node) return 0
  if (node.symbol !== undefined) return 1
  return 1 + Math.max(treeDepth(node.left ?? null), treeDepth(node.right ?? null))
}
