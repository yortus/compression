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

import RleText from '../components/slides/RleText.vue'
import RleTwoWay from '../components/slides/RleTwoWay.vue'
import RlePrimer from '../components/slides/RlePrimer.vue'
import RleBitmap from '../components/slides/RleBitmap.vue'
import RlePalette from '../components/slides/RlePalette.vue'
import RlePlanes from '../components/slides/RlePlanes.vue'
import LossyVsLossless from '../components/slides/LossyVsLossless.vue'

import TitleSlide from '../components/slides/TitleSlide.vue'
import WhyCare from '../components/slides/WhyCare.vue'
import InfoTheory from '../components/slides/InfoTheory.vue'
import Timeline from '../components/slides/Timeline.vue'
import Optimisation from '../components/slides/Optimisation.vue'
import HuffmanBuild from '../components/slides/HuffmanBuild.vue'
import WavesIntro from '../components/slides/WavesIntro.vue'
import Dct1D from '../components/slides/Dct1D.vue'
import Basis64 from '../components/slides/Basis64.vue'
import JpegPipeline from '../components/slides/JpegPipeline.vue'

import BrittleVsRobust from '../components/slides/BrittleVsRobust.vue'
import Reframing from '../components/slides/Reframing.vue'
import PointsSlide from '../components/slides/PointsSlide.vue'

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
    id: 'title',
    act: 'framing',
    title: 'Compression',
    subtitle: 'An interactive talk',
    component: TitleSlide,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'why-care',
    act: 'framing',
    title: 'Why Bother',
    subtitle: 'The numbers behind an ordinary photograph',
    component: WhyCare,
    tag: 'core',
    controls: ['image', 'quality'],
    fragments: 2,
  },
  {
    id: 'info-theory',
    act: 'framing',
    title: 'The Floor',
    subtitle: 'Shannon, 1948 — entropy as a hard limit',
    component: InfoTheory,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'timeline',
    act: 'framing',
    title: 'Who Worked This Out',
    subtitle: 'Two centuries of borrowed ideas',
    component: Timeline,
    tag: 'optional',
    fragments: 2,
  },
  {
    id: 'optimisation',
    act: 'framing',
    title: 'Compression as Optimisation',
    subtitle: 'Smaller, faster, truer — pick two',
    component: Optimisation,
    tag: 'core',
    fragments: 2,
  },
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
    id: 'rle-text',
    act: 'simple',
    title: 'Run-Length Encoding',
    subtitle: 'The simplest thing that could possibly work',
    component: RleText,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'rle-two-way',
    act: 'simple',
    title: 'Both Directions',
    subtitle: 'Encode is only half of a codec',
    component: RleTwoWay,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'rle-primer',
    act: 'simple',
    title: 'The Shared Primer',
    subtitle: 'What both sides must already agree on',
    component: RlePrimer,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'rle-bitmap',
    act: 'simple',
    title: 'RLE on a Bitmap',
    subtitle: 'The same encoder, pointed at pixels',
    component: RleBitmap,
    tag: 'core',
    controls: ['image'],
    fragments: 2,
  },
  {
    id: 'rle-palette',
    act: 'simple',
    title: 'Palettise, Then RLE',
    subtitle: 'Pixels become indices',
    component: RlePalette,
    tag: 'core',
    controls: ['image'],
    fragments: 2,
  },
  {
    id: 'rle-planes',
    act: 'simple',
    title: 'Colour Planes',
    subtitle: 'Same bytes, different order',
    component: RlePlanes,
    tag: 'core',
    controls: ['image'],
    fragments: 2,
  },
  {
    id: 'lossy-vs-lossless',
    act: 'simple',
    title: 'Lossy and Lossless',
    subtitle: 'Where the information goes',
    component: LossyVsLossless,
    tag: 'core',
    fragments: 2,
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
    id: 'huffman-build',
    act: 'entropy',
    title: 'Building the Tree',
    subtitle: 'Take the two rarest things and glue them together',
    component: HuffmanBuild,
    tag: 'core',
    fragments: 2,
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
    id: 'waves-intro',
    act: 'fourier',
    title: 'Everything Is Waves',
    subtitle: 'Any signal is a sum of fixed cosines',
    component: WavesIntro,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'dct-1d',
    act: 'fourier',
    title: 'One Dimension First',
    subtitle: 'Keep the coefficients that matter',
    component: Dct1D,
    tag: 'core',
    fragments: 2,
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
    id: 'basis-64',
    act: 'fourier',
    title: 'The 64 Patterns',
    subtitle: 'Adding a block back together, one at a time',
    component: Basis64,
    tag: 'core',
    controls: ['image', 'block'],
    fragments: 2,
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
    subtitle: 'Same numbers, read in a different order',
    component: Step6Zigzag,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
    fragments: 2,
  },
  {
    id: 'jpeg-pipeline',
    act: 'jpeg',
    title: 'The Whole Chain',
    subtitle: 'Every stage, priced',
    component: JpegPipeline,
    tag: 'core',
    controls: ['image', 'quality', 'subsampling'],
    fragments: 2,
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
  {
    id: 'wider-audio',
    act: 'conclusions',
    title: 'Sound',
    subtitle: 'The same skeleton, a different sense',
    component: PointsSlide,
    tag: 'core',
    fragments: 4,
  },
  {
    id: 'wider-general',
    act: 'conclusions',
    title: 'Everything Else',
    subtitle: 'Lossless data, with no perception to exploit',
    component: PointsSlide,
    tag: 'core',
    fragments: 4,
  },
  {
    id: 'modern',
    act: 'conclusions',
    title: 'After JPEG',
    subtitle: 'Better parts, same pipeline',
    component: PointsSlide,
    tag: 'optional',
    fragments: 4,
  },
  {
    id: 'brittle-vs-robust',
    act: 'conclusions',
    title: 'Brittle and Robust',
    subtitle: 'Why some schemes only work sometimes',
    component: BrittleVsRobust,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'lossiness-subjective',
    act: 'conclusions',
    title: 'Lossy Is About People',
    subtitle: 'Every codec contains a model of you',
    component: PointsSlide,
    tag: 'core',
    fragments: 4,
  },
  {
    id: 'reframing',
    act: 'conclusions',
    title: 'Reframing',
    subtitle: 'What actually did the work',
    component: Reframing,
    tag: 'core',
    fragments: 2,
  },
  {
    id: 'end',
    act: 'conclusions',
    title: 'Thank You',
    subtitle: 'Links, credits and questions',
    component: PointsSlide,
    tag: 'core',
    fragments: 4,
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
