<!-- [bd-file:store] -->
<script setup lang="ts">
/** − and + around how many to add (`v-model`), from 1 up to what's in stock. */
defineProps<{ max?: number | null }>();
const quantity = defineModel<number>({ default: 1 });
</script>

<template>
	<div class="qty" role="group" aria-label="Quantity">
		<button
			type="button"
			aria-label="One fewer"
			:disabled="quantity <= 1"
			@click="quantity = Math.max(1, quantity - 1)"
		>
			−
		</button>
		<span aria-live="polite">{{ quantity }}</span>
		<button
			type="button"
			aria-label="One more"
			:disabled="max != null && quantity >= max"
			@click="quantity = Math.min(999, quantity + 1)"
		>
			+
		</button>
	</div>
</template>
