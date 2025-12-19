<template>
  <div
    ref="handleRef"
    class="resize-handle group"
    @mousedown="startResize"
    role="separator"
    aria-orientation="horizontal"
    :aria-valuenow="percentage"
    tabindex="0"
    @keydown="handleKeyDown"
  >
    <div class="resize-handle-inner">
      <div class="resize-handle-dots"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  percentage: number;
}>();

const emit = defineEmits<{
  'resize': [percentage: number];
}>();

const handleRef = ref<HTMLDivElement>();
const isResizing = ref(false);

function startResize(event: MouseEvent) {
  event.preventDefault();
  isResizing.value = true;

  const startY = event.clientY;
  const startPercentage = props.percentage;
  const viewportHeight = window.innerHeight;

  function onMouseMove(e: MouseEvent) {
    if (!isResizing.value) return;

    const deltaY = e.clientY - startY;
    const deltaPercentage = (deltaY / viewportHeight) * 100;
    let newPercentage = startPercentage + deltaPercentage;

    // Clamp between 20% and 80%
    newPercentage = Math.max(20, Math.min(80, newPercentage));

    emit('resize', newPercentage);
  }

  function onMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function handleKeyDown(event: KeyboardEvent) {
  const step = 5;
  let newPercentage = props.percentage;

  if (event.key === 'ArrowUp') {
    newPercentage = Math.max(20, props.percentage - step);
    emit('resize', newPercentage);
    event.preventDefault();
  } else if (event.key === 'ArrowDown') {
    newPercentage = Math.min(80, props.percentage + step);
    emit('resize', newPercentage);
    event.preventDefault();
  }
}
</script>

<style scoped>
.resize-handle {
  position: relative;
  height: 12px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  margin: 0 16px;
  transition: all 0.2s ease;
}

.resize-handle:hover,
.resize-handle:focus {
  outline: none;
}

.resize-handle-inner {
  width: 100%;
  height: 4px;
  background: rgba(122, 162, 247, 0.2);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.resize-handle:hover .resize-handle-inner,
.resize-handle:focus .resize-handle-inner {
  background: rgba(122, 162, 247, 0.4);
  height: 6px;
}

.resize-handle:active .resize-handle-inner {
  background: rgba(122, 162, 247, 0.6);
  height: 8px;
}

.resize-handle-dots {
  width: 40px;
  height: 3px;
  background-image: radial-gradient(circle, rgba(122, 162, 247, 0.8) 1px, transparent 1px);
  background-size: 6px 3px;
  background-position: center;
  background-repeat: repeat-x;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.resize-handle:hover .resize-handle-dots,
.resize-handle:focus .resize-handle-dots {
  opacity: 1;
}

@media (max-width: 640px) {
  .resize-handle {
    height: 16px;
    margin: 0 8px;
  }

  .resize-handle-inner {
    height: 6px;
  }

  .resize-handle:hover .resize-handle-inner,
  .resize-handle:focus .resize-handle-inner {
    height: 8px;
  }
}
</style>
