<script setup lang="ts">
import { inject, computed } from 'vue'
import { DECK_KEY } from './useDeck'
import { LEARN_MORE_KEY } from './useLearnMore'
import { proseFor } from '../content'

/**
 * The detail panel: one button, same place on every slide, and everything a slide knows
 * that did not earn a place on the stage.
 *
 * Meant to be browsed, not read like a page. It opens with the slide's own paragraph, then
 * shows the written detail as cards — a person is a portrait and two lines, a fact is a
 * pull-out, a link is a button — and finally whatever the slide has *measured* for the
 * controls currently on screen. Read at reading distance rather than from the back of a
 * room, so it is set smaller than a slide, but it is still the deck.
 */

const deck = inject(DECK_KEY)!
const registry = inject(LEARN_MORE_KEY)!

const prose = computed(() => proseFor(deck.slide.value.id))
const entry = computed(() => prose.value?.more ?? null)
const facts = computed(() => registry.facts.value)

const base = import.meta.env.BASE_URL

/** Portraits live in public/portraits/; other figures give a path under public/ or a URL. */
function portraitUrl(file: string) {
  return `${base}portraits/${file}`
}
function imageUrl(src: string) {
  return /^https?:\/\//.test(src) ? src : `${base}${src}`
}
/** Initials for the monogram a person with no freely-licensed photo falls back to. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

defineEmits<{ close: [] }>()
</script>

<template>
  <div class="scrim" @click="$emit('close')">
    <article class="panel" @click.stop>
      <header>
        <h2>{{ deck.slide.value.title }}</h2>
        <button class="close" title="Close (Esc)" @click="$emit('close')">✕</button>
      </header>

      <div class="body">
        <p v-if="prose" class="lead">{{ prose.learner }}</p>

        <h3 v-if="entry?.title" class="section">{{ entry.title }}</h3>
        <template v-for="(block, i) in entry?.blocks ?? []" :key="i">
          <p v-if="block.kind === 'para'">{{ block.text }}</p>

          <ul v-else-if="block.kind === 'list'">
            <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
          </ul>

          <!-- A pull-out fact: the thing worth remembering, set apart from the prose. -->
          <aside v-else-if="block.kind === 'fact'" class="fact-card">
            <span class="eyebrow">{{ block.label ?? 'Did you know?' }}</span>
            <p>{{ block.text }}</p>
          </aside>

          <!-- A person: portrait (or a monogram) and two lines. -->
          <component
            :is="block.href ? 'a' : 'div'"
            v-else-if="block.kind === 'person'"
            class="person"
            :href="block.href"
            :target="block.href ? '_blank' : undefined"
            :rel="block.href ? 'noreferrer' : undefined"
          >
            <img v-if="block.portrait" class="portrait" :src="portraitUrl(block.portrait)" :alt="block.name" />
            <span v-else class="portrait mono" aria-hidden="true">{{ initials(block.name) }}</span>
            <span class="who">
              <span class="name">{{ block.name }}</span>
              <span v-if="block.life || block.role" class="meta">
                <span v-if="block.life" class="life">{{ block.life }}</span>
                <span v-if="block.life && block.role"> · </span>
                <span v-if="block.role">{{ block.role }}</span>
              </span>
              <span class="blurb">{{ block.blurb }}</span>
            </span>
          </component>

          <!-- A figure with a caption and, where a licence needs it, a credit line. -->
          <figure v-else-if="block.kind === 'image'" class="figure">
            <a v-if="block.href" :href="block.href" target="_blank" rel="noreferrer">
              <img :src="imageUrl(block.src)" :alt="block.alt ?? ''" />
            </a>
            <img v-else :src="imageUrl(block.src)" :alt="block.alt ?? ''" />
            <figcaption v-if="block.caption || block.credit">
              <span v-if="block.caption">{{ block.caption }}</span>
              <span v-if="block.credit" class="credit">{{ block.credit }}</span>
            </figcaption>
          </figure>

          <p v-else-if="block.kind === 'link'" class="link">
            <a :href="block.href" target="_blank" rel="noreferrer">{{ block.label }} ↗</a>
          </p>
        </template>

        <!-- Measured, not written: whatever the slide has computed for the picker and
             slider positions currently on screen. -->
        <section v-if="facts.length" class="facts">
          <h3>On what is on screen right now</h3>
          <div v-for="(f, i) in facts" :key="i" class="fact">
            <span class="label">{{ f.label }}</span>
            <span class="value">{{ f.value }}</span>
            <span v-if="f.note" class="note">{{ f.note }}</span>
          </div>
        </section>

        <p v-if="!prose && !entry && !facts.length" class="empty">
          Nothing written for this slide yet.
        </p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.panel {
  width: min(46rem, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.2rem 0.6rem;
  border-bottom: 1px solid var(--border);
}

h2 {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.close {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  color: var(--text-secondary);
}

/* The one scrolling surface in the deck: a panel read at reading distance may run long. */
.body {
  min-height: 0;
  overflow-y: auto;
  padding: 0.9rem 1.2rem 1.2rem;
}

.body p {
  font-size: 0.68rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0 0 0.7rem;
}

/* The slide's own paragraph, and the reason most slides have a panel at all. */
.lead {
  color: var(--text) !important;
}

.section {
  margin: 1rem 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text);
}

.body ul {
  margin: 0 0 0.7rem;
  padding-left: 1rem;
}

.body li {
  font-size: 0.68rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.link a {
  color: var(--accent);
}

/* A pull-out fact — an accent-tinted card, so the memorable line is not lost in prose. */
.fact-card {
  margin: 0 0 0.9rem;
  padding: 0.6rem 0.8rem;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-left: 3px solid var(--accent);
  border-radius: 6px;
}

.fact-card .eyebrow {
  display: block;
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

.fact-card p {
  margin: 0;
  color: var(--text) !important;
}

/* A person: portrait beside two lines. A link makes the whole card clickable. */
.person {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  margin: 0 0 0.9rem;
  padding: 0.6rem 0.7rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s;
}

a.person:hover {
  border-color: var(--accent);
}

.portrait {
  flex: none;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 8px;
  object-fit: cover;
  background: var(--bg-surface);
}

/* The fallback when a person has no freely-licensed photo: initials on a tinted tile. */
.portrait.mono {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-surface));
  letter-spacing: 0.02em;
}

.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.who .name {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text);
}

.who .meta {
  font-size: 0.6rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.who .blurb {
  font-size: 0.66rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

a.person:hover .name {
  color: var(--accent);
}

/* A figure — image with a caption and, where a licence needs it, a credit line. */
.figure {
  margin: 0 0 0.9rem;
}

.figure img {
  max-width: 100%;
  border-radius: 8px;
  display: block;
}

.figure figcaption {
  margin-top: 0.35rem;
  font-size: 0.6rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.figure .credit {
  display: block;
  opacity: 0.7;
  font-size: 0.55rem;
}

.facts {
  margin-top: 0.4rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border);
}

.facts h3 {
  margin: 0 0 0.5rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-weight: 600;
}

.fact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border);
}

.fact .label {
  font-size: 0.68rem;
  color: var(--text);
}

.fact .value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.fact .note {
  grid-column: 1 / -1;
  font-size: 0.62rem;
  color: var(--text-secondary);
}

.empty {
  font-style: italic;
}
</style>
