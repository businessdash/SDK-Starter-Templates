<!-- [bd-file:store] -->
<script setup lang="ts">
/** One line in the cart: photo, name, option, the line's total, − and + around the quantity, and Remove. */
import type { CartSnapshot } from "@businessdash/sdk/contracts";
// Cart amounts are dollars (not cents), so they are formatted as they are.
import { formatDollars } from "#shared/bd/shop";

withDefaults(
	defineProps<{ item: CartSnapshot["items"][number]; currency: string; busy?: boolean }>(),
	{ busy: false },
);
const emit = defineEmits<{ quantity: [quantity: number]; remove: [] }>();
</script>

<template>
	<div class="cart-line">
		<img
			v-if="item.productImage"
			:alt="item.productName ?? 'Item'"
			class="cart-line__img"
			:src="item.productImage"
		/>
		<div class="cart-line__info">
			<div class="cart-line__name">{{ item.productName }}</div>
			<div v-if="item.variantTitle" class="cart-line__variant">
				{{ item.variantTitle }}
			</div>
			<div class="cart-line__price">
				{{ formatDollars(item.subtotal, currency) }}
			</div>
		</div>
		<div class="cart-line__qty">
			<button
				aria-label="Decrease quantity"
				class="qty-btn"
				:disabled="busy"
				type="button"
				@click="emit('quantity', item.quantity - 1)"
			>
				−
			</button>
			<span>{{ item.quantity }}</span>
			<button
				aria-label="Increase quantity"
				class="qty-btn"
				:disabled="busy"
				type="button"
				@click="emit('quantity', item.quantity + 1)"
			>
				+
			</button>
		</div>
		<button
			class="bd-btn bd-btn--ghost cart-line__remove"
			:disabled="busy"
			type="button"
			@click="emit('remove')"
		>
			Remove
		</button>
	</div>
</template>
