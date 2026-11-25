<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `price` is from priceFor().
 */
import { formatDollars, type Price } from "#shared/bd/shop";

withDefaults(defineProps<{ price: Price | null; quantity?: number }>(), { quantity: 1 });
</script>

<template>
	<p class="product-detail__price">
		<template v-if="price?.amount != null">
			<span v-if="price.from" class="product-detail__from">From</span>
			{{ formatDollars(price.amount * quantity) }}
			<span v-if="quantity > 1" class="product-detail__each">
				({{ formatDollars(price.amount) }} each)
			</span>
		</template>
		<template v-else>Sold out</template>
	</p>
</template>
