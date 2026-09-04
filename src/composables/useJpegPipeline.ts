import { ref, shallowRef, computed, watch, type InjectionKey } from 'vue'
import type { SubsamplingMode, AllBlocks, YcbcrData, SubsampledData, Block, RLEPair, HuffmanResult } from '../engine/jpeg/types'
import { runFullPipeline, requantize, getBlockZigzag, getBlockRLE, getBlockHuffman, type PipelineCache } from '../engine/jpeg/pipeline'

export function createJpegPipeline() {
  const sourceImageData = shallowRef<ImageData | null>(null)
  const quality = ref(50)
  const subsamplingMode = ref<SubsamplingMode>('4:2:0')
  const selectedBlockIndex = ref(0)
  const cache = shallowRef<PipelineCache | null>(null)

  function loadImage(imgData: ImageData) {
    sourceImageData.value = imgData
    selectedBlockIndex.value = 0
    run()
  }

  function run() {
    const src = sourceImageData.value
    if (!src) return
    cache.value = runFullPipeline(src, quality.value, subsamplingMode.value)
  }

  let rafId = 0
  function onQualityChange() {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      const prev = cache.value
      if (!prev) return
      cache.value = requantize(prev, quality.value)
    })
  }

  watch(quality, onQualityChange)
  watch(subsamplingMode, run)

  const ycbcr = computed<YcbcrData | null>(() => cache.value?.ycbcr ?? null)
  const subsampled = computed<SubsampledData | null>(() => cache.value?.subsampled ?? null)
  const allBlocks = computed<AllBlocks | null>(() => cache.value?.allBlocks ?? null)
  const dctBlocks = computed<AllBlocks | null>(() => cache.value?.dctBlocks ?? null)
  const quantizedBlocks = computed<AllBlocks | null>(() => cache.value?.quantizedBlocks ?? null)
  const reconstructed = computed<ImageData | null>(() => cache.value?.reconstructed ?? null)

  const selectedBlock = computed<Block | null>(() => {
    const b = allBlocks.value
    if (!b) return null
    return b.y.blocks[selectedBlockIndex.value] ?? null
  })

  const selectedDCT = computed<Block | null>(() => {
    const b = dctBlocks.value
    if (!b) return null
    return b.y.blocks[selectedBlockIndex.value] ?? null
  })

  const selectedQuantized = computed<Block | null>(() => {
    const b = quantizedBlocks.value
    if (!b) return null
    return b.y.blocks[selectedBlockIndex.value] ?? null
  })

  const selectedZigzag = computed<number[] | null>(() => {
    const b = selectedQuantized.value
    return b ? getBlockZigzag(b) : null
  })

  const selectedRLE = computed<RLEPair[] | null>(() => {
    const b = selectedQuantized.value
    return b ? getBlockRLE(b) : null
  })

  const selectedHuffman = computed<HuffmanResult | null>(() => {
    const b = selectedQuantized.value
    return b ? getBlockHuffman(b) : null
  })

  return {
    sourceImageData,
    quality,
    subsamplingMode,
    selectedBlockIndex,
    ycbcr,
    subsampled,
    allBlocks,
    dctBlocks,
    quantizedBlocks,
    reconstructed,
    selectedBlock,
    selectedDCT,
    selectedQuantized,
    selectedZigzag,
    selectedRLE,
    selectedHuffman,
    loadImage,
  }
}

export type JpegPipeline = ReturnType<typeof createJpegPipeline>
export const PIPELINE_KEY = Symbol('pipeline') as InjectionKey<JpegPipeline>
