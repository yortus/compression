<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { usePhaseStage } from '../../deck/usePhaseStage'
import { useStat } from '../../stats/useStats'
import { SUMMARY_TEXTS, summaryTextById } from '../../content/summaries'
import { tokeniseWords, utf8Bytes } from '../../engine/codecs/tokenise'
import { abbreviate, expand, dictionaryBits, survivingTokens } from '../../engine/codecs/abbreviate'
import { layoutTextGrid, drawTextGrid, type TextGrid } from '../../rendering/textGrid'
import { drawStamp } from '../../rendering/stamp'

/**
 * Summarising is compression, and it is the cleanest way into lossy versus lossless
 * because it needs no bits at all.
 *
 * Rewrite an aerodrome forecast in METAR and you get it back word for word; write a précis
 * of the Gettysburg Address and you never do. Same slide, same animation, one toggle
 * between them — and the last phase runs the expansion on both, where one panel becomes the
 * source text again and the other simply stops. That contrast is the whole slide, and it is
 * why this sits in Act 0 before a single bit has been mentioned.
 *
 * **The picker is a diagonal, not a ladder.** Domains with an agreed codebook abbreviate
 * enormously and summarise terribly, because in a weather forecast the numbers *are* the
 * message. Prose is the other way round. Neither route is universally better, and which one
 * is available to you is a fact about the domain.
 *
 * **The summaries are hand-written and the slide says so.** There is no summariser here,
 * and faking one would break the deck's rule about never asserting what it can measure.
 * What it does measure is the size, and whether the expansion reproduces the original.
 * What it cannot measure — and admits — is whether a summary is any *good*. That asymmetry
 * is exactly why lossy codecs end up containing a model of a human, which Act 6 pays off.
 */

// --- Stage geometry -----------------------------------------------------------------

const STAGE_W = 1600
const STAGE_H = 816
const MARGIN = 16
const GAP = 22

const PANEL = 486
const GRID_Y = 14
const LEFT_X = MARGIN
const RIGHT_X = STAGE_W - MARGIN - PANEL

const CENTRE_X = LEFT_X + PANEL + GAP
const CENTRE_W = RIGHT_X - GAP - CENTRE_X
const CENTRE_Y = GRID_Y
const CENTRE_H = PANEL
/** The coded text is laid out on the same grid as the source, so it is drawn on it too. */
const CODED_X = CENTRE_X + (CENTRE_W - PANEL) / 2
const BADGE_Y = CENTRE_Y + CENTRE_H - 62

/**
 * The primer gets its own band across the foot of the stage.
 *
 * It is the half of the bargain that is easy to forget: `4.5× SMALLER` is only true for a
 * reader who already has the codebook, and the codebook is bigger than the message it
 * decodes. Showing the entries — rather than only counting their bytes in the HUD — is what
 * makes "you need the message *and* a shared primer" concrete instead of a slogan.
 */
const PRIMER_Y = GRID_Y + PANEL + 24
const PRIMER_H = STAGE_H - PRIMER_Y - 14
const PRIMER_COLS = 3
const PRIMER_ROWS = 5

const STAGES = ['message', 'marked', 'coded', 'result', 'back'] as const
const STAGE_NAMES = ['Message', 'Marked', 'Coded', 'Result', 'Back'] as const

// --- Model ---------------------------------------------------------------------------

interface Model {
  lossless: boolean
  source: TextGrid
  coded: TextGrid
  back: TextGrid
  /** Per source cell: does this word survive into the compressed form? */
  keptCell: boolean[]
  rawBits: number
  encodedBits: number
  overheadBits: number
  roundTrips: boolean
  codedText: string
  entries: number
  /** Share of the source's words that do not survive, measured rather than asserted. */
  lostPercent: number
}

const textId = ref(SUMMARY_TEXTS[0].id)
/** `-1` is the lossless route; otherwise an index into the text's summaries. */
const modeIndex = ref(-1)
const sample = computed(() => summaryTextById(textId.value))
const modeLabel = computed(() =>
  modeIndex.value < 0 ? sample.value.codebook
    : 'a human wrote this précis — nothing here generated it')
const model = shallowRef<Model | null>(null)

let colours = {
  bg: '#14141f', panel: '#0a0a0f', border: '#2a2a3a',
  text: '#e0e0e8', dim: '#8888a0', accent: '#6c8cff', good: '#4ade80', warn: '#fbbf24',
}

function readColours() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
  colours = {
    bg: v('--bg-surface', '#14141f'),
    panel: v('--bg', '#0a0a0f'),
    border: v('--border', '#2a2a3a'),
    text: v('--text', '#e0e0e8'),
    dim: v('--text-secondary', '#8888a0'),
    accent: v('--accent', '#6c8cff'),
    good: v('--positive', '#4ade80'),
    warn: v('--warning', '#fbbf24'),
  }
}

function gridFor(text: string, cols: number, lineFactor: number, fontSize?: number) {
  return layoutTextGrid(tokeniseWords(text), { size: PANEL, cols, lineFactor, fontSize })
}

function buildModel(): Model | null {
  const s = sample.value
  const lossless = modeIndex.value < 0
  const source = gridFor(s.text, s.cols, s.lineFactor)

  let codedText: string
  let backText: string
  let keptChars: [number, number][] = []
  let keptCell: boolean[]
  let overheadBits = 0
  let entries = 0

  if (lossless) {
    const result = abbreviate(s.text, s.dictionary)
    codedText = result.text
    backText = expand(codedText, s.dictionary)
    keptChars = result.hits.map(h => [h.start, h.end])
    overheadBits = dictionaryBits(s.dictionary)
    entries = s.dictionary.length

    // Character ranges into cell flags, via each token's offset in the source.
    const tokens = tokeniseWords(s.text)
    const offsets: number[] = []
    let at = 0
    for (const t of tokens) { offsets.push(at); at += t.length }
    keptCell = source.cells.map(cell => {
      const start = offsets[cell.index]
      const end = start + cell.text.length
      return keptChars.some(([a, b]) => start < b && end > a)
    })
  } else {
    const summary = s.summaries[Math.min(modeIndex.value, s.summaries.length - 1)]
    codedText = summary.text ?? ''
    // A summary expands to itself: the dropped words are not coming back, and the slide
    // shows that by running exactly the same "expand" step and getting nothing more.
    backText = codedText
    const tokens = tokeniseWords(s.text)
    const kept = survivingTokens(tokens, tokeniseWords(codedText))
    keptCell = source.cells.map(cell => kept[cell.index])
  }

  // All three panels share the source's grid, so switching mode cannot move anything and
  // a shorter message simply occupies fewer lines. Fitting each panel's text to its own
  // panel scaled the METAR up to fill the pane, which hid the very thing being shown.
  const coded = gridFor(codedText, s.cols, s.lineFactor, source.fontSize)
  const back = gridFor(backText, s.cols, s.lineFactor, source.fontSize)
  const roundTrips = backText === s.text

  return {
    lossless, source, coded, back, keptCell,
    rawBits: utf8Bytes(s.text) * 8,
    encodedBits: utf8Bytes(codedText) * 8,
    overheadBits,
    roundTrips,
    codedText,
    entries,
    lostPercent: Math.round((1 - back.cells.length / Math.max(1, source.cells.length)) * 100),
  }
}

const ratio = computed(() => {
  const m = model.value
  return m && m.encodedBits > 0 ? m.rawBits / m.encodedBits : 1
})

useStat('summarising', () => {
  const m = model.value
  if (!m) return null
  return {
    label: `${m.lossless ? 'Abbreviated' : 'Summarised'} · ${sample.value.label}`,
    rawBits: m.rawBits,
    encodedBits: m.encodedBits,
    overheadBits: m.overheadBits,
    lossy: !m.roundTrips,
    note: m.lossless
      ? `${m.entries} codebook entries, learned once per reader`
      : 'hand-written; size is measurable, quality is not',
  }
})

// --- Animation --------------------------------------------------------------------

const anim = { mark: 0, code: 0, badge: 0, back: 0 }

const MARK_DUR = 1.4
const CODE_DUR = 1.0
const BACK_DUR = 1.3

function build() {
  if (!model.value) return null
  anim.mark = 0; anim.code = 0; anim.badge = 0; anim.back = 0

  const tl = gsap.timeline({ paused: true })
  tl.addLabel('message', 0)
  tl.fromTo(anim, { mark: 0 }, { mark: 1, duration: MARK_DUR, ease: 'none' }, 0.1)
  const markedAt = 0.1 + MARK_DUR + 0.15
  tl.addLabel('marked', markedAt)

  tl.fromTo(anim, { code: 0 }, { code: 1, duration: CODE_DUR, ease: 'none' }, markedAt + 0.15)
  const codedAt = markedAt + 0.15 + CODE_DUR + 0.2
  tl.addLabel('coded', codedAt)

  tl.fromTo(anim, { badge: 0 }, { badge: 1, duration: 0.6, ease: 'power2.out' }, codedAt + 0.15)
  const resultAt = codedAt + 0.15 + 0.6 + 0.2
  tl.addLabel('result', resultAt)

  tl.fromTo(anim, { back: 0 }, { back: 1, duration: BACK_DUR, ease: 'none' }, resultAt + 0.2)
  const backAt = resultAt + 0.2 + BACK_DUR + 0.3
  tl.addLabel('back', backAt)
  tl.to({}, { duration: 0.01 }, backAt)
  return tl
}

// --- Drawing -----------------------------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = colours.panel
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = colours.border
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8)
  ctx.stroke()
}

/**
 * The codebook, drawn as the cost it is. Revealed with the coded panel, because it is the
 * thing that made the coded panel readable.
 */
function drawPrimer(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  const s = sample.value
  panel(ctx, MARGIN, PRIMER_Y, STAGE_W - MARGIN * 2, PRIMER_H)
  if (anim.code <= 0.01) return

  ctx.globalAlpha = anim.code
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = '600 17px Inter, system-ui, sans-serif'

  if (!m.lossless) {
    ctx.fillStyle = colours.dim
    ctx.font = '19px Inter, system-ui, sans-serif'
    ctx.fillText(
      'No codebook — a summary needs no shared key, and nothing has to be learned in advance to read one.',
      MARGIN + 24, PRIMER_Y + PRIMER_H / 2 - 18)
    ctx.fillStyle = colours.warn
    ctx.font = '600 19px Inter, system-ui, sans-serif'
    ctx.fillText(
      `That is also why there is no way back: ${m.lostPercent}% of the words are gone, and no key would bring them back.`,
      MARGIN + 24, PRIMER_Y + PRIMER_H / 2 + 18)
    ctx.globalAlpha = 1
    return
  }

  ctx.fillStyle = colours.warn
  ctx.fillText(
    `THE CODEBOOK · ${m.entries} ENTRIES · ${Math.round(m.overheadBits / 8)} BYTES` +
    ` — larger than the message it decodes, and learned once per reader`,
    MARGIN + 24, PRIMER_Y + 26)

  const slotW = (STAGE_W - MARGIN * 2 - 32) / PRIMER_COLS
  const top = PRIMER_Y + 52
  const slotH = (PRIMER_H - 66) / PRIMER_ROWS
  s.dictionary.forEach((entry, i) => {
    if (i >= PRIMER_COLS * PRIMER_ROWS) return
    const x = MARGIN + 16 + (i % PRIMER_COLS) * slotW
    const y = top + Math.floor(i / PRIMER_COLS) * slotH + slotH / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = colours.accent
    ctx.font = '19px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText(entry.code, x + 10, y, 124)
    ctx.fillStyle = colours.dim
    ctx.font = '16px Inter, system-ui, sans-serif'
    ctx.fillText(`= ${entry.phrase}`, x + 144, y, slotW - 160)
  })
  ctx.globalAlpha = 1
}

function draw(ctx: CanvasRenderingContext2D) {
  const m = model.value
  if (!m) return
  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  const total = Math.max(1, m.source.cells.length)
  const markHead = anim.mark * total

  // Source. Words that survive get a box in the mode's own colour; words that do not are
  // dimmed away rather than boxed, so the lossy route visibly *loses* the page.
  panel(ctx, LEFT_X, GRID_Y, PANEL, PANEL)
  drawTextGrid(ctx, m.source, LEFT_X, GRID_Y, {
    textAlpha: i => {
      const swept = Math.max(0, Math.min(1, markHead - i))
      if (m.keptCell[i]) return 1
      // Dropped words fade towards the background as the sweep passes them.
      return 1 - swept * 0.78
    },
    boxAlpha: i => (m.keptCell[i] ? Math.max(0, Math.min(1, markHead - i)) : 0),
    boxColour: () => (m.lossless ? colours.accent : colours.good),
    boxOpacity: 0.34,
    text: colours.text,
    dim: colours.border,
  })

  // The compressed form.
  panel(ctx, CENTRE_X, CENTRE_Y, CENTRE_W, CENTRE_H)
  const codedTotal = Math.max(1, m.coded.cells.length)
  const codeHead = anim.code * codedTotal
  drawTextGrid(ctx, m.coded, CODED_X, CENTRE_Y + 16, {
    textAlpha: i => Math.max(0, Math.min(1, codeHead - i)),
    text: m.lossless ? colours.accent : colours.text,
    dim: colours.border,
  })

  if (anim.badge > 0.01) {
    const shown = 1 + (ratio.value - 1) * anim.badge
    drawStamp(ctx, `${shown.toFixed(1)}× SMALLER`, CENTRE_X + CENTRE_W / 2, BADGE_Y,
      colours.good, { alpha: anim.badge })
  }

  // What comes back.
  panel(ctx, RIGHT_X, GRID_Y, PANEL, PANEL)
  const backTotal = Math.max(1, m.back.cells.length)
  const backHead = anim.back * backTotal
  drawTextGrid(ctx, m.back, RIGHT_X, GRID_Y, {
    textAlpha: i => Math.max(0, Math.min(1, backHead - i)),
    text: colours.text,
    dim: colours.border,
  })

  drawPrimer(ctx)

  const alpha = smoothstep(0.94, 1, anim.back)
  drawStamp(ctx, m.roundTrips ? 'LOSSLESS' : 'LOSSY', RIGHT_X + PANEL - 150, GRID_Y + PANEL - 42,
    m.roundTrips ? colours.good : colours.warn, { alpha })

}

const { canvas, stage, progress, selectStage, scrub, rebuild } = usePhaseStage({
  stages: STAGES,
  width: STAGE_W,
  height: STAGE_H,
  beforeBuild: () => { readColours(); model.value = buildModel() },
  build,
  draw,
})

watch([sample, modeIndex], () => rebuild(), { immediate: true })
</script>

<template>
  <SlideLayout column>
    <div class="sum">
      <div class="stage-wrap">
        <canvas ref="canvas" />
      </div>

      <div class="stage-controls">
        <div class="stage-picker">
          <span class="desc">{{ sample.credit }}</span>
          <div class="seg-group">
            <button
              v-for="t in SUMMARY_TEXTS" :key="t.id"
              :class="{ on: textId === t.id }"
              @click="textId = t.id"
            >{{ t.label }}</button>
          </div>
        </div>

        <div class="stage-picker">
          <span class="desc">{{ modeLabel }}</span>
          <div class="seg-group">
            <button :class="{ on: modeIndex === -1 }" @click="modeIndex = -1">Codebook</button>
            <button
              v-for="(s, i) in sample.summaries" :key="s.id"
              :class="{ on: modeIndex === i }"
              @click="modeIndex = i"
            >{{ s.label }}</button>
          </div>
        </div>

        <!-- Slider and buttons drive one playhead: the buttons jump to a labelled phase,
             the slider goes anywhere, and each shows what the other did. -->
        <div class="stage-picker">
          <input
            class="stage-scrub" type="range" min="0" max="1000" step="1"
            aria-label="Scrub the animation"
            :value="Math.round(progress * 1000)"
            @input="scrub(Number(($event.target as HTMLInputElement).value) / 1000)"
          />
          <div class="seg-group">
            <button
              v-for="(name, i) in STAGE_NAMES" :key="i"
              :class="{ on: stage === i }"
              @click="selectStage(i)"
            >{{ name }}</button>
          </div>
        </div>
      </div>
    </div>
  </SlideLayout>
</template>

<style scoped>
.sum {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.stage-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sized in JS from the wrapper — see `usePhaseStage`. `display: block` only stops the
   inline-element baseline gap from making the wrapper a few pixels taller than the canvas. */
canvas {
  display: block;
  border-radius: 8px;
  border: 1px solid var(--border);
}
</style>
