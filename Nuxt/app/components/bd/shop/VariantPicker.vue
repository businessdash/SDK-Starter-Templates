<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
 * ones can't be pressed. Nothing shows for a product with one variant. A
 * variant's price shows on its button while it has no options of its own.
 */
import { formatDollars, type ProductVariant } from "#shared/bd/shop";

defineProps<{ variants: ProductVariant[]; selected: string; showPrices: boolean }>();
const emit = defineEmits<{ pick: [variantId: string] }>();
</script>

<template>
	<fieldset v-if="variants.length > 1" class="choice">
		<legend class="bd-label">Option</legend>
		<div class="choice__values">
			<button
				v-for="v in variants"
				:key="v.id"
				type="button"
				class="choice__value"
				:class="{ 'choice__value--on': v.id === selected }"
				:aria-pressed="v.id === selected"
				:disabled="!v.available"
				@click="emit('pick', v.id)"
			>
				{{ v.name }}
				<small v-if="v.price != null && showPrices">
					{{ formatDollars(v.price) }}
				</small>
			</button>
		</div>
	</fieldset>
</template>
