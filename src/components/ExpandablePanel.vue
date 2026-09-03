<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  label?: string
}>()

const open = ref(false)
</script>

<template>
  <div class="expandable" :class="{ open }">
    <button class="toggle" @click="open = !open">
      <span class="arrow">▶</span>
      {{ label ?? 'Details' }}
    </button>
    <div v-if="open" class="body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.expandable {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.toggle {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.5rem 0.75rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.toggle:hover {
  background: var(--bg-surface);
}

.arrow {
  font-size: 0.75rem;
  transition: transform 0.2s;
}

.open .arrow {
  transform: rotate(90deg);
}

.body {
  padding: 0.5rem 0.75rem 0.75rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
