<!-- [bd-file:store] -->
<script setup lang="ts">
/** Clear cart, and Checkout ("Starting…" on the way to Stripe). */
withDefaults(defineProps<{ busy?: boolean; checkingOut?: boolean }>(), {
	busy: false,
	checkingOut: false,
});
const emit = defineEmits<{ clear: []; checkout: [] }>();
</script>

<template>
	<div class="cart__actions">
		<button class="bd-btn bd-btn--ghost" :disabled="busy" type="button" @click="emit('clear')">
			Clear cart
		</button>
		<button
			class="bd-btn"
			:disabled="checkingOut || busy"
			type="button"
			@click="emit('checkout')"
		>
			{{ checkingOut ? "Starting…" : "Checkout" }}
		</button>
	</div>
</template>
