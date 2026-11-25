<!-- [bd-file:store] -->
<script setup lang="ts">
/** The subtotal. */
import { formatDollars } from "#shared/bd/shop";

defineProps<{ subtotal: number; currency: string }>();
</script>

<template>
	<div class="cart__totals">
		<span>Subtotal</span>
		<strong>{{ formatDollars(subtotal, currency) }}</strong>
	</div>
</template>
