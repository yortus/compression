<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'
import Fragment from '../../deck/Fragment.vue'
</script>

<template>
  <SlideLayout column>
    <div class="title-slide">
      <p class="kicker">an interactive talk about</p>
      <h1>Compression</h1>
      <p class="sub">How a 768 KB photograph becomes 30 KB, and what that costs</p>

      <Fragment :index="1">
        <div class="hints">
          <span><kbd>→</kbd> next</span>
          <span><kbd>?</kbd> all keys</span>
          <span class="muted">every slide is live — change the image, move the sliders</span>
        </div>
      </Fragment>
    </div>
  </SlideLayout>
</template>

<style scoped>
.title-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 100%;
  text-align: center;
}

.kicker {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--text-secondary);
}

h1 {
  font-size: 3.4rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  background: linear-gradient(100deg, var(--text) 25%, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-top: 0.3rem;
}

.hints {
  display: flex;
  gap: 1.2rem;
  align-items: center;
  margin-top: 1.6rem;
  font-size: 0.65rem;
  color: var(--text-secondary);
}

kbd {
  font-family: monospace;
  font-size: 0.62rem;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0.05rem 0.3rem;
  margin-right: 0.2rem;
  color: var(--accent);
}

.muted {
  opacity: 0.6;
  font-style: italic;
}
</style>
