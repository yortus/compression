<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'
</script>

<template>
  <SlideLayout column>
    <div class="title-slide">
      <p class="kicker">an interactive slide deck about</p>
      <h1>Compression</h1>
      <p class="sub">How does a 768 KB photograph become 30 KB?</p>
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
</style>
