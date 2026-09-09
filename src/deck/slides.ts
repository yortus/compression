import type { Act, SlideDef } from './types'

import Step6Zigzag from '../components/steps/Step6Zigzag.vue'
import Step9Summary from '../components/steps/Step9Summary.vue'

import RleBitmap from '../components/slides/RleBitmap.vue'

import ColourSpaces from '../components/slides/ColourSpaces.vue'
import RgbSubsample from '../components/slides/RgbSubsample.vue'
import ChromaSubsample from '../components/slides/ChromaSubsample.vue'

import TitleSlide from '../components/slides/TitleSlide.vue'
import AiGenius from '../components/slides/AiGenius.vue'
import WhyCare from '../components/slides/WhyCare.vue'
import HowItWorks from '../components/slides/HowItWorks.vue'
import Summarising from '../components/slides/Summarising.vue'
import Timeline from '../components/slides/Timeline.vue'
import HuffmanCodes from '../components/slides/HuffmanCodes.vue'
import Lz77 from '../components/slides/Lz77.vue'
import WavesIntro from '../components/slides/WavesIntro.vue'
import Waves2D from '../components/slides/Waves2D.vue'
import Basis64 from '../components/slides/Basis64.vue'
import JpegPipeline from '../components/slides/JpegPipeline.vue'

import Reframing from '../components/slides/Reframing.vue'
import BulletSlide from '../components/slides/BulletSlide.vue'
import ThankYou from '../components/slides/ThankYou.vue'

export const ACTS: Act[] = [
  { id: 'framing', label: 'Intro', title: 'Why compress anything?' },
  { id: 'codes', label: 'Codes', title: 'Finding the redundancy' },
  { id: 'colour', label: 'Colour', title: 'Reframing colour' },
  { id: 'fourier', label: 'Waves', title: "Fourier's insight" },
  { id: 'jpeg', label: 'JPEG', title: 'Putting it all together' },
  { id: 'conclusions', label: 'Outro', title: 'Looking wider' },
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
  },
  {
    id: 'ai-genius',
    act: 'framing',
    title: 'Too Good To Be True',
    component: AiGenius,
    tag: 'core',
  },
  {
    id: 'why-care',
    act: 'framing',
    title: 'Why Bother',
    subtitle: 'The numbers behind an ordinary photograph',
    component: WhyCare,
    tag: 'core',
    controls: ['image', 'quality'],
  },
  {
    id: 'how-it-works',
    act: 'framing',
    title: 'How does it Work?',
    subtitle: 'A map of what the talk will cover',
    component: HowItWorks,
    tag: 'core',
  },
  {
    id: 'timeline',
    act: 'framing',
    title: 'Timeline',
    subtitle: 'Two centuries of ideas',
    component: Timeline,
    tag: 'core',
  },
  {
    id: 'summarising',
    act: 'codes',
    title: 'Familiar Codes',
    subtitle: 'Summaries, shorthand, and other human codes',
    component: Summarising,
    tag: 'core',
    fragments: 5,
  },
  {
    id: 'rle-bitmap',
    act: 'codes',
    title: 'Run-Length Encoding',
    subtitle: 'Counting runs of the same value',
    component: RleBitmap,
    tag: 'core',
    // No image or quality control: the artwork belongs to this slide, which is what lets
    // the whole byte stream fit on screen and lets the picker span the outcome space.
    fragments: 4,
  },
  {
    id: 'huffman-codes',
    act: 'codes',
    title: 'Huffman Codes',
    subtitle: 'Shorter codes for commoner things',
    component: HuffmanCodes,
    tag: 'core',
    // One fragment per phase of the round trip, so the arrow keys drive the animation
    // like the build on any other slide.
    fragments: 6,
  },
  {
    id: 'lz77',
    act: 'codes',
    title: 'LZ77',
    subtitle: 'Backreferences to earlier data',
    component: Lz77,
    tag: 'core',
    fragments: 4,
  },
  {
    id: 'colour-spaces',
    act: 'colour',
    title: 'Colour Spaces',
    subtitle: 'Different representations of light',
    component: ColourSpaces,
    tag: 'core',
  },
  {
    id: 'rgb-subsample',
    act: 'colour',
    title: 'RGB',
    subtitle: 'Three primary colours',
    component: RgbSubsample,
    tag: 'core',
    controls: ['image'],
  },
  {
    id: 'chroma-subsample',
    act: 'colour',
    title: 'YCbCr',
    subtitle: 'Luminance and chrominance',
    component: ChromaSubsample,
    tag: 'core',
    controls: ['image', 'subsampling'],
  },
  {
    id: 'waves-intro',
    act: 'fourier',
    title: 'Waves in 1D',
    subtitle: 'A signal is a sum of fixed cosine waves',
    component: WavesIntro,
    tag: 'core',
  },
  {
    id: 'waves-2d',
    act: 'fourier',
    title: 'Waves in 2D',
    subtitle: 'A shape is a sum of 2-D cosine waves',
    component: Waves2D,
    tag: 'core',
  },
  {
    id: 'basis-64',
    act: 'fourier',
    title: 'DCT',
    subtitle: 'The Discrete Cosine Transform',
    component: Basis64,
    tag: 'core',
    // Quality matters here now: it decides how many patterns survive the middle act.
    controls: ['image', 'quality', 'block'],
    // One fragment per phase, so the arrow keys drive the animation like any other build.
    fragments: 4,
  },
  {
    id: 'zigzag',
    act: 'fourier',
    title: 'Zigzag',
    subtitle: 'Same numbers, read in a different order',
    component: Step6Zigzag,
    tag: 'core',
    controls: ['image', 'quality', 'block'],
    fragments: 3,
  },
  {
    id: 'jpeg-pipeline',
    act: 'jpeg',
    title: 'The Whole Chain',
    subtitle: 'Every stage of JPEG compression',
    component: JpegPipeline,
    tag: 'core',
    controls: ['image', 'quality', 'subsampling'],
  },
  {
    id: 'jpeg-result',
    act: 'jpeg',
    title: 'Reconstruction',
    subtitle: 'From original to compressed',
    component: Step9Summary,
    tag: 'core',
    controls: ['image', 'quality', 'subsampling'],
  },
  {
    id: 'many-techniques',
    act: 'conclusions',
    title: 'So Many Techniques',
    subtitle: 'But only two kinds',
    component: BulletSlide,
    tag: 'core',
  },
  {
    id: 'reframing',
    act: 'conclusions',
    title: 'Reframing',
    subtitle: 'Formats matter',
    component: Reframing,
    tag: 'core',
  },
  {
    id: 'tradeoffs',
    act: 'conclusions',
    title: 'Different Tradeoffs',
    subtitle: '',
    component: BulletSlide,
    tag: 'core',
  },
  {
    id: 'entropy-limit',
    act: 'conclusions',
    title: 'There\'s a Limit',
    subtitle: 'How low we can go',
    component: BulletSlide,
    tag: 'core',
  },
  {
    id: 'wider',
    act: 'conclusions',
    title: 'What We Didn\u2019t Cover',
    subtitle: '',
    component: BulletSlide,
    tag: 'core',
  },
  {
    id: 'end',
    act: 'conclusions',
    title: 'Thank You',
    subtitle: 'Questions, and where to go next',
    component: ThankYou,
    tag: 'core',
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
