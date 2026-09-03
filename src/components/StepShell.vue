<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="step-shell">
    <header class="step-header">
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </header>
    <main class="step-content">
      <slot />
    </main>
    <aside v-if="$slots.detail" class="step-detail">
      <slot name="detail" />
    </aside>
  </div>
</template>

<style scoped>
.step-shell {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  padding: 1.5rem 2rem 3.5rem;
  gap: 1rem;
  overflow: hidden;
}

.step-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.step-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
}

.step-content {
  overflow: hidden;
  display: flex;
  gap: 1.5rem;
  min-height: 0;
}

.step-detail {
  position: absolute;
  bottom: 3rem;
  right: 2rem;
  max-width: 500px;
  max-height: 40vh;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
