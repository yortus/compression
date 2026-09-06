<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { createDeck, DECK_KEY } from './useDeck'
import { createStats, STATS_KEY } from '../stats/useStats'
import ControlBar from './ControlBar.vue'
import DeckNav from './DeckNav.vue'
import Loupe from './Loupe.vue'
import { proseFor } from '../content'

/**
 * The one shell every slide lives in. It owns all the furniture — title, navigation
 * and global controls — so that nothing moves between slides and every control is
 * reachable from everywhere.
 *
 * The top bar carries the slide's own title and nothing else. The act is already named
 * in the ToC rail, so repeating it above every slide was chrome spent on something the
 * audience can see; the compression numbers that used to sit on the right went with it,
 * because a slide that has a number worth reading should show it where the number is
 * being made, not in a strip above the picture. Slides still publish through
 * `useStat` — the scoreboard `jpeg-pipeline` reads back is fed by that, not by
 * anything rendered here.
 */
const deck = createDeck()
provide(DECK_KEY, deck)

const stats = createStats()
provide(STATS_KEY, stats)

const showHelp = ref(false)
const showSpeakerNotes = ref(false)

// Slide words live in src/content, so they can be rewritten without touching layout.
const prose = computed(() => proseFor(deck.slide.value.id))

function onKeydown(e: KeyboardEvent) {
  // Never hijack keys while someone is typing in a slide's own input.
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  if (e.metaKey || e.ctrlKey || e.altKey) return

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
      e.preventDefault(); deck.next(); break
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault(); deck.prev(); break
    case 'PageDown':
      e.preventDefault(); deck.nextSlide(); break
    case 'PageUp':
      e.preventDefault(); deck.prevSlide(); break
    case 'Home':
      e.preventDefault(); deck.goTo(0); break
    case 'End':
      e.preventDefault(); deck.goTo(deck.slides.length - 1); break
    case 'l':
    case 'L':
      deck.learnMode.value = !deck.learnMode.value; break
    case 'n':
    case 'N':
      showSpeakerNotes.value = !showSpeakerNotes.value; break
    case '?':
      showHelp.value = !showHelp.value; break
    case 'Escape':
      showHelp.value = false
      showSpeakerNotes.value = false
      break
  }
}

onMounted(() => {
  deck.start()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="deck-shell">
    <aside class="rail">
      <DeckNav />
    </aside>

    <div class="main">
    <header class="chrome-top">
      <h1>{{ deck.slide.value.title }}</h1>
      <span class="subtitle">{{ deck.slide.value.subtitle }}</span>
      <div class="top-actions">
        <button v-if="deck.learnMode.value" class="mode" @click="deck.learnMode.value = false">learn mode</button>
        <button class="help-btn" title="Keyboard shortcuts" @click="showHelp = !showHelp">?</button>
      </div>
    </header>

    <!-- Always present, so the grid keeps four rows whether or not there is prose to show. -->
    <div class="prose-band">
      <p v-if="deck.learnMode.value && prose" class="prose learner">{{ prose.learner }}</p>
      <p v-else-if="showSpeakerNotes && prose" class="prose speaker">{{ prose.speaker }}</p>
    </div>

    <main class="slide-area">
      <component :is="deck.slide.value.component" :key="deck.slide.value.id" />
    </main>

    <div class="chrome-bottom">
      <ControlBar />
    </div>
    </div>

    <!-- Shared zoom loupe: any canvas marked v-loupe drives it. -->
    <Loupe />

    <div v-if="showHelp" class="help-overlay" @click="showHelp = false">
      <div class="help-content" @click.stop>
        <h2>Keyboard</h2>
        <dl>
          <dt>→ ↓ Space</dt><dd>Next build step, then next slide</dd>
          <dt>← ↑</dt><dd>Back</dd>
          <dt>PgUp / PgDn</dt><dd>Skip a whole slide</dd>
          <dt>Home / End</dt><dd>First / last slide</dd>
          <dt>L</dt><dd>Learn mode — reveal every build step, show the full explanation</dd>
          <dt>N</dt><dd>Speaker note for this slide</dd>
          <dt>?</dt><dd>This help</dd>
          <dt>Esc</dt><dd>Close</dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Chrome is budgeted up front as a fixed slice of the viewport. Slides get everything
 * that is left; a slide that wants more should dim the chrome, not remove it.
 */
.deck-shell {
  --chrome-top: 2.6rem;
  --chrome-row: 1.9rem;
  --rail: 8.5rem;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: var(--rail) minmax(0, 1fr);
  overflow: hidden;
}

/*
 * The base sizes assume a projector. On a laptop the chrome has to give some width
 * back, or the control bar runs off the end — controls disappearing is the one thing
 * the shell must never do.
 */
@media (max-width: 1500px) {
  .deck-shell {
    --rail: 6.6rem;
    --chrome-top: 2.4rem;
  }
}

/* Table of contents, full height down the left edge. */
.rail {
  min-height: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
}

.main {
  min-width: 0;
  display: grid;
  grid-template-rows: var(--chrome-top) auto 1fr var(--chrome-row);
  overflow: hidden;
}

/* Prose band under the title: the presenter's cue, or the paragraph that stands in
   for the presenter once the deck is published. */
.prose {
  padding: 0.5rem 1.25rem 0.1rem;
  font-size: 0.68rem;
  line-height: 1.5;
  max-width: 62rem;
}

.prose.learner {
  color: var(--text-secondary);
}

.prose.speaker {
  color: var(--warning);
  font-style: italic;
}

/*
 * Explicit columns rather than a flex row. Under a flex row a shrinkable item can be
 * squeezed narrower than its own text, and the text then spills over its neighbour. In a
 * grid each item owns a column, so the worst case is truncation, never overlap.
 *
 * title | subtitle (absorbs all slack) | buttons
 */
.chrome-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) max-content;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  overflow: hidden;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.chrome-top h1 {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/*
 * The subtitle is the expanded form of the title, and it owns the flexible column, so it
 * is the only thing in the bar that ever truncates.
 */
.subtitle {
  min-width: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode {
  font-size: 0.55rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  color: var(--accent);
  border-color: var(--accent-dim);
}

.help-btn {
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
}

/*
 * Tight on purpose. Slides here are fit-to-box rather than flowing text, so every rem of
 * padding comes straight off the thing the audience is looking at — on a laptop the old
 * 1rem/1.25rem cost about 70px of width and 42px of height. Slides that want breathing
 * room can add their own; the shell should not spend it on their behalf.
 */
.slide-area {
  min-height: 0;
  overflow: hidden;
  padding: 0.55rem 0.7rem 0.35rem;
}

/* Controls get the whole row — nothing may squeeze them off the bar. */
.chrome-bottom {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
}

.help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-content {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem 2rem;
  max-width: 560px;
}

.help-content h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}

.help-content dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1.5rem;
  margin: 0;
  font-size: 0.75rem;
}

.help-content dt {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
}

.help-content dd {
  margin: 0;
  color: var(--text-secondary);
}

/* Narrower than the deck was designed for: scale the bar's type down rather than
   start dropping the subtitle or the help button off the end. */
@media (max-width: 1150px) {
  .chrome-top h1 {
    font-size: 1.05rem;
  }

  .subtitle {
    font-size: 0.68rem;
  }
}
</style>
