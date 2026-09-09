<script setup lang="ts">
import SlideLayout from '../../deck/SlideLayout.vue'
import { THANK_YOU_LINKS } from '../../content/outro'

/** The close: a thank-you and a short list of places to go next. No build, no detail. */
</script>

<template>
  <SlideLayout column>
    <div class="thanks">
      <p class="kicker"></p>
      <h1>Thank you</h1>
      <p class="sub">Questions?</p>

      <ul class="links">
        <li v-for="l in THANK_YOU_LINKS" :key="l.href">
          <a :href="l.href" target="_blank" rel="noreferrer">{{ l.label }}</a>
        </li>
      </ul>
    </div>
  </SlideLayout>
</template>

<style scoped>
.thanks {
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

.links {
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1.4rem;
}

.links a {
  font-size: 0.95rem;
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.links a:hover {
  border-bottom-color: var(--accent);
}
</style>
