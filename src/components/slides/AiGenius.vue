<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'

/**
 * A full-bleed image and nothing else — a satirical news clipping that promises photos
 * compressed "to mere bytes" by having an AI describe and later regenerate them. It opens
 * the framing act as the fantasy the rest of the talk argues against: the file that is a
 * prompt is not the photo back, only a plausible substitute for it.
 *
 * The image lives at public/ai-genius.png; drop the clipping there. It is bound as a
 * runtime URL rather than a static `src` because `public/` assets are not in the module
 * graph — a literal `src="/ai-genius.png"` makes the compiler try to import it and fails.
 */
const src = `${import.meta.env.BASE_URL}ai-genius.png`
</script>

<template>
  <SlideLayout>
    <img class="clipping" :src="src" alt="" />
    <a
      class="source"
      href="https://www.facebook.com/groups/runlocalai/posts/1475180314409678/"
      target="_blank"
      rel="noopener noreferrer"
    >Source: Facebook</a>
  </SlideLayout>
</template>

<style scoped>
.clipping {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}

.source {
  position: absolute;
  right: 0;
  bottom: 0;
  font-size: 0.62rem;
  color: var(--text-secondary);
  text-decoration: underline;
}

.source:hover {
  color: var(--accent);
}
</style>
