<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'
import { createDeck, DECK_KEY } from './useDeck'
import { createStats, STATS_KEY } from '../stats/useStats'
import StatsHUD from '../stats/StatsHUD.vue'
import ControlBar from './ControlBar.vue'
import DeckNav from './DeckNav.vue'

/**
 * The one shell every slide lives in. It owns all the furniture — title, navigation,
 * global controls and the compression stats — so that nothing moves between slides
 * and every control is reachable from everywhere.
 */
const deck = createDeck()
provide(DECK_KEY, deck)

const stats = createStats()
provide(STATS_KEY, stats)

const showHelp = ref(false)

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
    case '?':
      showHelp.value = !showHelp.value; break
    case 'Escape':
      showHelp.value = false; break
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
      <span class="act">{{ deck.act.value.title }}</span>
      <h1>{{ deck.slide.value.title }}</h1>
      <span class="subtitle">{{ deck.slide.value.subtitle }}</span>
      <!-- Stats live up here beside the title: always visible, and no extra chrome height. -->
      <StatsHUD />
      <button v-if="deck.learnMode.value" class="mode" @click="deck.learnMode.value = false">learn mode</button>
      <button class="help-btn" title="Keyboard shortcuts" @click="showHelp = !showHelp">?</button>
    </header>

    <main class="slide-area">
      <component :is="deck.slide.value.component" :key="deck.slide.value.id" />
    </main>

    <div class="chrome-bottom">
      <ControlBar />
    </div>
    </div>

    <div v-if="showHelp" class="help-overlay" @click="showHelp = false">
      <div class="help-content" @click.stop>
        <h2>Keyboard</h2>
        <dl>
          <dt>→ ↓ Space</dt><dd>Next build step, then next slide</dd>
          <dt>← ↑</dt><dd>Back</dd>
          <dt>PgUp / PgDn</dt><dd>Skip a whole slide</dd>
          <dt>Home / End</dt><dd>First / last slide</dd>
          <dt>L</dt><dd>Learn mode — reveal every build step</dd>
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
  --chrome-top: 2.4rem;
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
    --chrome-top: 2.2rem;
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
  grid-template-rows: var(--chrome-top) 1fr var(--chrome-row);
  overflow: hidden;
}

.chrome-top {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  overflow: hidden;
}

.act {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  white-space: nowrap;
}

.chrome-top h1 {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex: none;
}

.chrome-top :deep(.stats-hud) {
  align-self: center;
  flex: 0 1 auto;
  min-width: 0;
}

/* The subtitle absorbs all the slack and truncates first, so the stats never move. */
.subtitle {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.68rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode {
  flex: none;
  font-size: 0.55rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  color: var(--accent);
  border-color: var(--accent-dim);
  align-self: center;
}

.help-btn {
  flex: none;
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  align-self: center;
}

.slide-area {
  min-height: 0;
  overflow: hidden;
  padding: 1rem 1.25rem 0.5rem;
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
</style>
