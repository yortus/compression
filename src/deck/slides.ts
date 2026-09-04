import type { Act, SlideDef } from './types'

import Step0Source from '../components/steps/Step0Source.vue'
import Step1ColorSpace from '../components/steps/Step1ColorSpace.vue'
import Step2Subsampling from '../components/steps/Step2Subsampling.vue'
import Step3Blocks from '../components/steps/Step3Blocks.vue'
import Step4DCT from '../components/steps/Step4DCT.vue'
import Step5Quantization from '../components/steps/Step5Quantization.vue'
import Step6Zigzag from '../components/steps/Step6Zigzag.vue'
import Step7RLE from '../components/steps/Step7RLE.vue'
import Step8Huffman from '../components/steps/Step8Huffman.vue'
import Step9Summary from '../components/steps/Step9Summary.vue'

export const ACTS: Act[] = [
  { id: 'framing', label: 'Framing', title: 'Why compress anything?' },
  { id: 'simple', label: 'Simple', title: 'Start simple: run-length encoding' },
  { id: 'colour', label: 'Colour', title: 'Reframing colour' },
  { id: 'entropy', label: 'Entropy', title: 'Spending bits where they count' },
  { id: 'fourier', label: 'Waves', title: "Fourier's insight" },
  { id: 'jpeg', label: 'JPEG', title: 'Putting it all together' },
  { id: 'conclusions', label: 'Wider', title: 'Looking wider' },
]

/**
 * The deck, in narrative order — this array is the single source of truth for
 * order, navigation and deep links. See ROADMAP.md for the target slide set;
 * what follows is the existing material remapped onto the new acts, with the
 * remaining slides to be filled in act by act.
 */
export const SLIDES: SlideDef[] = [
  {
    id: 'source',
    act: 'framing',
    title: 'Source Image',
    subtitle: 'The starting point',
    component: Step0Source,
    tag: 'optional',
    controls: ['image'],
  },
  {
    id: 'ycbcr',
    act: 'colour',
    title: 'Colour Space',
    subtitle: 'RGB → YCbCr',
    component: Step1ColorSpace,
    tag: 'core',
    controls: ['image'],
  },
  {
    id: 'chroma-subsample',
    act: 'colour',
    title: 'Chroma Subsampling',
    subtitle: 'Reducing colour resolution',
    component: Step2Subsampling,
    tag: 'core',
    controls: ['image', 'subsampling'],
  },
  {
    id: 'huffman-codes',
    act: 'entropy',
    title: 'Huffman Coding',
    subtitle: 'Short codes for common symbols',
    component: Step8Huffman,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'blocks',
    act: 'fourier',
    title: '8×8 Blocks',
    subtitle: 'Per-block pipeline',
    component: Step3Blocks,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'dct-2d',
    act: 'fourier',
    title: 'DCT',
    subtitle: 'Discrete Cosine Transform',
    component: Step4DCT,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'quantisation',
    act: 'fourier',
    title: 'Quantization',
    subtitle: 'Controlled information loss',
    component: Step5Quantization,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'rle-on-coeffs',
    act: 'fourier',
    title: 'Run-Length Encoding',
    subtitle: 'Collapsing the zeros',
    component: Step7RLE,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'zigzag',
    act: 'fourier',
    title: 'Zigzag Scan',
    subtitle: 'Reordering for longer runs',
    component: Step6Zigzag,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
  },
  {
    id: 'jpeg-result',
    act: 'jpeg',
    title: 'Reconstruction',
    subtitle: 'Putting it back together',
    component: Step9Summary,
    tag: 'core',
    controls: ['image', 'quality', 'subsampling'],
  },
]

export function slideIndexById(id: string): number {
  return SLIDES.findIndex(s => s.id === id)
}

export function actOf(slide: SlideDef): Act {
  return ACTS.find(a => a.id === slide.act)!
}

/** Slides grouped by act, in deck order — drives the act-grouped navigation bar. */
export function slidesByAct(): { act: Act; slides: SlideDef[] }[] {
  return ACTS.map(act => ({ act, slides: SLIDES.filter(s => s.act === act.id) }))
    .filter(group => group.slides.length > 0)
}
