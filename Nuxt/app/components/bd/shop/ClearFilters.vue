<!-- [bd-file:store] -->
<script setup lang="ts">
/** Clear all filters. */
const emit = defineEmits<{ clear: [] }>();
</script>

<template>
	<button type="button" class="store-clear" @click="emit('clear')">Clear all filters</button>
</template>
