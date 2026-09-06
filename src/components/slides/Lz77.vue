<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import gsap from 'gsap'
import SlideLayout from '../../deck/SlideLayout.vue'
import { usePhaseStage } from '../../deck/usePhaseStage'
import { useStat } from '../../stats/useStats'
import { LZ77_TEXTS, lz77TextById } from '../../content/corpus'
import { tokenise, utf8Bytes } from '../../engine/codecs/tokenise'
import {
  encodeLz77, decodeLz77, lz77Bits, tokenCost, tokenSymbol,
  type Lz77Options, type Lz77Token,
} from '../../engine/codecs/lz77'
import { buildHuffman, countSymbols, payloadBits } from '../../engine/codecs/huffman'
import { layoutTextGrid, drawTextGrid, cellCentre, type TextGrid } from '../../rendering/textGrid'
import { layoutRibbon, drawRibbon, type Ribbon, type RibbonGlyph } from '../../rendering/ribbon'
import { tokenColour } from '../../rendering/tokenColours'
import { drawStamp } from '../../rendering/stamp'

/**
 * The sliding window: redundancy that is *distant* rather than adjacent.
 *
 * The deck teaches runs and it teaches frequency, and until this slide it never taught the
 * thing that actually compresses text and code. It is also the one slide that makes another
 * slide worth more: the last phase runs the existing Huffman coder over the token stream,
 * and that pairing is DEFLATE. Two slides that multiply rather than add.
 *
 * **The arcs are the idea.** Every match draws a curve from where it was found back to
 * where it was found *from*. On the repeated boilerplate the panel fills with long sweeps;
 * on noise there is not a single arc. Nothing else on the slide states the point as
 * directly, which is why the arcs get the whole left panel and no caption.
 *
 * **The window is a knob because the trade is real.** Shrinking it does two things at
 * once — distant matches stop being reachable, and every remaining match gets cheaper,
 * because `tokenCost` sizes the distance field from the window. Watching the ratio move in
 * both directions is the argument for why gzip has a window size at all.
 */

// --- Stage geometry ---------------------------------------------------------------

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

const RIBBON_X = CENTRE_X + 16
const RIBBON_Y = CENTRE_Y + 16
const RIBBON_W = CENTRE_W - 32
const RIBBON_H = 320
const RIBBON_FONT = 20
const BADGE_Y = CENTRE_Y + CENTRE_H - 96

const STAGES = ['text', 'matching', 'tokens', 'decoded', 'deflate'] as const
const STAGE_NAMES = ['Text', 'Matching', 'Tokens', 'Decoded', '+ Huffman'] as const

const WINDOWS = [32, 128, 512]

// --- Model --------------------------------------------------------------------------

interface Arc {
  /** Cell indices in the left grid: where the match is, and where it points back to. */
  toCell: number
  fromCell: number
  length: number
  colour: string
  /** Token order, so the arcs appear as the cursor reaches them. */
  order: number
}

interface Model {
  symbols: string[]
  tokens: Lz77Token[]
  grid: TextGrid
  /** Cell index for each source symbol, or -1 if the wrap swallowed it. */
  cellOf: Int32Array
  arcs: Arc[]
  ribbon: Ribbon
  rawBits: number
  encodedBits: number
  deflateBits: number
  deflateTableBits: number
  roundTrips: boolean
  matches: number
  literals: number
}

const textId = ref(LZ77_TEXTS[0].id)
const windowSize = ref(WINDOWS[2])
const sample = computed(() => lz77TextById(textId.value))
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

function optionsNow(): Lz77Options {
  return { window: windowSize.value, minMatch: 3, maxMatch: 258 }
}

function buildModel(): Model | null {
  const s = sample.value
  const symbols = tokenise(s.text.replace(/\r\n/g, '\n'), s.tokeniser)
  if (!symbols.length) return null

  const grid = layoutTextGrid(symbols, { size: PANEL, cols: s.cols, lineFactor: s.lineFactor })
  const cellOf = new Int32Array(symbols.length).fill(-1)
  grid.cells.forEach((c, ci) => { cellOf[c.index] = ci })

  const opts = optionsNow()
  const tokens = encodeLz77(symbols, opts)
  const roundTrips = decodeLz77(tokens).join('') === symbols.join('')

  const arcs: Arc[] = []
  tokens.forEach((t, order) => {
    if (t.kind !== 'match') return
    const toCell = cellOf[t.at]
    const fromCell = cellOf[t.at - t.distance]
    if (toCell < 0 || fromCell < 0) return
    arcs.push({ toCell, fromCell, length: t.length, colour: tokenColour(order, 2, colours.dim), order })
  })

  // A literal shows as its own character; a match shows as the instruction it is. Both go
  // into one ribbon so the stream reads as a single thing the decoder walks.
  const glyphs: RibbonGlyph[] = []
  tokens.forEach((t, order) => {
    if (t.kind === 'literal') {
      const ch = t.value === '\n' ? '↵' : t.value === ' ' ? '·' : t.value
      glyphs.push({ ch, colour: colours.dim })
    } else {
      const colour = tokenColour(order, 2, colours.dim)
      for (const ch of `«${t.distance},${t.length}»`) glyphs.push({ ch, colour })
    }
  })
  const ribbon = layoutRibbon(glyphs, { width: RIBBON_W, height: RIBBON_H, fontSize: RIBBON_FONT })

  // The final phase: the existing Huffman coder, unchanged, over the token stream. That
  // pairing is DEFLATE, and running it here rather than describing it is the whole point.
  const keys = tokens.map(tokenSymbol)
  const counts = countSymbols(keys)
  const { codes } = buildHuffman(counts)
  const deflateBits = payloadBits(counts, codes)
  let deflateTableBits = 0
  for (const [sym, code] of codes) deflateTableBits += 8 + utf8Bytes(sym) * 8 + 5 + code.length

  return {
    symbols, tokens, grid, cellOf, arcs, ribbon,
    rawBits: utf8Bytes(symbols.join('')) * 8,
    encodedBits: lz77Bits(tokens, opts),
    deflateBits,
    deflateTableBits,
    roundTrips,
    matches: tokens.filter(t => t.kind === 'match').length,
    literals: tokens.filter(t => t.kind === 'literal').length,
  }
}

const lzRatio = computed(() => {
  const m = model.value
  return m && m.encodedBits > 0 ? m.rawBits / m.encodedBits : 1
})
const deflateRatio = computed(() => {
  const m = model.value
  return m && m.deflateBits > 0 ? m.rawBits / m.deflateBits : 1
})

useStat('lz77', () => {
  const m = model.value
  if (!m) return null
  const deflating = anim.deflate > 0.5
  return {
    label: `${deflating ? 'DEFLATE' : 'LZ77'} · ${sample.value.label}, window ${windowSize.value}`,
    rawBits: m.rawBits,
    encodedBits: deflating ? m.deflateBits : m.encodedBits,
    overheadBits: deflating ? m.deflateTableBits : 0,
    lossy: !m.roundTrips,
    note: `${m.matches} matches · ${m.literals} literals · ` +
      `${tokenCost(optionsNow()).matchBits} bits per match`,
  }
})

// --- Animation -----------------------------------------------------------------------

const anim = { match: 0, tokens: 0, decode: 0, badge: 0, deflate: 0 }

const MATCH_DUR = 1.8
const TOKEN_DUR = 1.2
const DEC_DUR = 1.4

function build() {
  const m = model.value
  if (!m) return null
  anim.match = 0; anim.tokens = 0; anim.decode = 0; anim.badge = 0; anim.deflate = 0

  const tl = gsap.timeline({ paused: true })
  tl.addLabel('text', 0)

  tl.fromTo(anim, { match: 0 }, { match: 1, duration: MATCH_DUR, ease: 'none' }, 0.1)
  const matchingAt = 0.1 + MATCH_DUR + 0.15
  tl.addLabel('matching', matchingAt)

  tl.fromTo(anim, { tokens: 0 }, { tokens: 1, duration: TOKEN_DUR, ease: 'none' }, matchingAt + 0.15)
  tl.fromTo(anim, { badge: 0 }, { badge: 1, duration: 0.6, ease: 'power2.out' },
    matchingAt + 0.15 + TOKEN_DUR * 0.6)
  const tokensAt = matchingAt + 0.15 + TOKEN_DUR + 0.4
  tl.addLabel('tokens', tokensAt)

  tl.fromTo(anim, { decode: 0 }, { decode: 1, duration: DEC_DUR, ease: 'none' }, tokensAt + 0.2)
  const decodedAt = tokensAt + 0.2 + DEC_DUR + 0.3
  tl.addLabel('decoded', decodedAt)

  tl.fromTo(anim, { deflate: 0 }, { deflate: 1, duration: 0.9, ease: 'power2.inOut' }, decodedAt + 0.2)
  const deflateAt = decodedAt + 0.2 + 0.9 + 0.2
  tl.addLabel('deflate', deflateAt)
  tl.to({}, { duration: 0.01 }, deflateAt)
  return tl
}

// --- Drawing -------------------------------------------------------------------------

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
 * One curve per match, from the reference back to what it refers to.
 *
 * Drawn over the source text rather than beside it, because the whole claim is that the
 * text already contained this. The bulge is proportional to the horizontal reach, so a
 * match to the line above is a shallow hop and a match to three lines back is a sweep.
 */
function drawArcs(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  const shown = anim.match * m.tokens.length
  ctx.lineCap = 'round'
  for (const arc of m.arcs) {
    const reveal = Math.max(0, Math.min(1, shown - arc.order))
    if (reveal <= 0.01) continue
    const to = cellCentre(m.grid, m.grid.cells[arc.toCell], LEFT_X, GRID_Y)
    const from = cellCentre(m.grid, m.grid.cells[arc.fromCell], LEFT_X, GRID_Y)
    const lift = Math.min(90, 16 + Math.abs(to.x - from.x) * 0.22 + Math.abs(to.y - from.y) * 0.3)
    ctx.globalAlpha = reveal * 0.5
    ctx.strokeStyle = arc.colour
    ctx.lineWidth = Math.min(4, 1 + arc.length * 0.12)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo((from.x + to.x) / 2, Math.min(from.y, to.y) - lift, to.x, to.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawCentre(ctx: CanvasRenderingContext2D) {
  const m = model.value!
  panel(ctx, CENTRE_X, CENTRE_Y, CENTRE_W, CENTRE_H)
  drawRibbon(ctx, m.ribbon, RIBBON_X, RIBBON_Y, anim.tokens)

  if (m.ribbon.hidden > 0 && anim.tokens > 0.98) {
    ctx.fillStyle = colours.dim
    ctx.font = '14px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+ ${m.ribbon.hidden} more`, RIBBON_X + RIBBON_W, RIBBON_Y + RIBBON_H + 6)
  }

  if (anim.badge <= 0.01) return
  // One number, interpolated from what LZ77 alone managed to what it manages once the
  // token stream is Huffman-coded. The label under it is the payoff.
  const from = 1 + (lzRatio.value - 1) * anim.badge
  const shown = from + (deflateRatio.value - from) * anim.deflate
  drawStamp(ctx, `${shown.toFixed(1)}× SMALLER`, CENTRE_X + CENTRE_W / 2, BADGE_Y,
    colours.good, { alpha: anim.badge })

  if (anim.deflate > 0.01) {
    ctx.globalAlpha = anim.deflate
    ctx.fillStyle = colours.accent
    ctx.font = '600 24px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LZ77 + Huffman — that is DEFLATE', CENTRE_X + CENTRE_W / 2, BADGE_Y + 62)
    ctx.font = '16px Inter, system-ui, sans-serif'
    ctx.fillStyle = colours.dim
    ctx.fillText(`gzip, zip, PNG and HTTP all ship this pair`, CENTRE_X + CENTRE_W / 2, BADGE_Y + 92)
    ctx.globalAlpha = 1
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  const m = model.value
  if (!m) return
  ctx.fillStyle = colours.bg
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  const total = Math.max(1, m.grid.cells.length)
  const decHead = anim.decode * total

  panel(ctx, LEFT_X, GRID_Y, PANEL, PANEL)
  drawTextGrid(ctx, m.grid, LEFT_X, GRID_Y, {
    textAlpha: () => 1,
    text: colours.text,
    dim: colours.border,
  })
  drawArcs(ctx)

  panel(ctx, RIGHT_X, GRID_Y, PANEL, PANEL)
  drawTextGrid(ctx, m.grid, RIGHT_X, GRID_Y, {
    textAlpha: i => Math.max(0, Math.min(1, decHead - i)),
    text: colours.text,
    dim: colours.border,
  })

  drawCentre(ctx)

  const text = m.roundTrips ? 'LOSSLESS' : 'LOSSY'
  drawStamp(ctx, text, RIGHT_X + PANEL - 150, GRID_Y + PANEL - 42,
    m.roundTrips ? colours.good : colours.warn,
    { alpha: smoothstep(0.94, 1, anim.decode) })
}

const { canvas, stage, progress, selectStage, scrub, rebuild } = usePhaseStage({
  stages: STAGES,
  width: STAGE_W,
  height: STAGE_H,
  beforeBuild: () => { readColours(); model.value = buildModel() },
  build,
  draw,
})

watch([sample, windowSize], () => rebuild(), { immediate: true })
</script>

<template>
  <SlideLayout column>
    <div class="lz">
      <div class="stage-wrap">
        <canvas ref="canvas" />
      </div>

      <div class="stage-controls">
        <div class="stage-picker">
          <span class="desc">{{ sample.credit }}</span>
          <div class="seg-group">
            <button
              v-for="t in LZ77_TEXTS" :key="t.id"
              :class="{ on: textId === t.id }"
              @click="textId = t.id"
            >{{ t.label }}</button>
          </div>
        </div>

        <div class="stage-picker">
          <span class="desc">how far back a match may reach</span>
          <div class="seg-group">
            <button
              v-for="w in WINDOWS" :key="w"
              :class="{ on: windowSize === w }"
              @click="windowSize = w"
            >{{ w }}</button>
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
.lz {
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
