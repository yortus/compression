import type { YcbcrData, SubsampledData, SubsamplingMode } from './types'

export function subsample(ycbcr: YcbcrData, mode: SubsamplingMode): SubsampledData {
  const { y, cb, cr, width, height } = ycbcr

  if (mode === '4:4:4') {
    return {
      y: Float64Array.from(y),
      cb: Float64Array.from(cb),
      cr: Float64Array.from(cr),
      yWidth: width,
      yHeight: height,
      chromaWidth: width,
      chromaHeight: height,
      mode,
    }
  }

  const chromaWidth = Math.ceil(width / 2)
  const chromaHeight = mode === '4:2:0' ? Math.ceil(height / 2) : height

  const subCb = new Float64Array(chromaWidth * chromaHeight)
  const subCr = new Float64Array(chromaWidth * chromaHeight)

  if (mode === '4:2:2') {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < chromaWidth; col++) {
        const srcCol = col * 2
        const srcCol2 = Math.min(srcCol + 1, width - 1)
        const srcIdx1 = row * width + srcCol
        const srcIdx2 = row * width + srcCol2
        const dstIdx = row * chromaWidth + col
        subCb[dstIdx] = (cb[srcIdx1] + cb[srcIdx2]) * 0.5
        subCr[dstIdx] = (cr[srcIdx1] + cr[srcIdx2]) * 0.5
      }
    }
  } else {
    // 4:2:0 — average 2×2 blocks
    for (let row = 0; row < chromaHeight; row++) {
      for (let col = 0; col < chromaWidth; col++) {
        const srcRow = row * 2
        const srcRow2 = Math.min(srcRow + 1, height - 1)
        const srcCol = col * 2
        const srcCol2 = Math.min(srcCol + 1, width - 1)
        const i00 = srcRow * width + srcCol
        const i01 = srcRow * width + srcCol2
        const i10 = srcRow2 * width + srcCol
        const i11 = srcRow2 * width + srcCol2
        const dstIdx = row * chromaWidth + col
        subCb[dstIdx] = (cb[i00] + cb[i01] + cb[i10] + cb[i11]) * 0.25
        subCr[dstIdx] = (cr[i00] + cr[i01] + cr[i10] + cr[i11]) * 0.25
      }
    }
  }

  return {
    y: Float64Array.from(y),
    cb: subCb,
    cr: subCr,
    yWidth: width,
    yHeight: height,
    chromaWidth,
    chromaHeight,
    mode,
  }
}

export function upsample(data: SubsampledData): YcbcrData {
  const { y, cb, cr, yWidth, yHeight, chromaWidth, chromaHeight, mode } = data

  if (mode === '4:4:4') {
    return { y: Float64Array.from(y), cb: Float64Array.from(cb), cr: Float64Array.from(cr), width: yWidth, height: yHeight }
  }

  const fullCb = new Float64Array(yWidth * yHeight)
  const fullCr = new Float64Array(yWidth * yHeight)

  // Bilinear-ish upsampling: nearest neighbour for simplicity
  for (let row = 0; row < yHeight; row++) {
    const chromaRow = mode === '4:2:0' ? Math.min(Math.floor(row / 2), chromaHeight - 1) : row
    for (let col = 0; col < yWidth; col++) {
      const chromaCol = Math.min(Math.floor(col / 2), chromaWidth - 1)
      const srcIdx = chromaRow * chromaWidth + chromaCol
      const dstIdx = row * yWidth + col
      fullCb[dstIdx] = cb[srcIdx]
      fullCr[dstIdx] = cr[srcIdx]
    }
  }

  return { y: Float64Array.from(y), cb: fullCb, cr: fullCr, width: yWidth, height: yHeight }
}
