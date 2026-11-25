<!-- [bd-file:store] -->
<script setup lang="ts">
/** Add to cart; "Choose options" until every option is picked, Sold out when there's none, "Adding…" while it's sent. */
import { computed } from "vue";
import type { Price } from "#shared/bd/shop";

const props = withDefaults(defineProps<{ price: Price | null; busy?: boolean }>(), { busy: false });
const emit = defineEmits<{ add: [] }>();

const label = computed(() =>
	!props.price || props.price.amount === null
		? "Sold out"
		: !props.price.ready
			? "Choose options"
			: props.busy
				? "Adding…"
				: "Add to cart",
);
</script>

<template>
	<button
		class="bd-btn buy__add"
		type="button"
		:disabled="busy || !price?.ready"
		@click="emit('add')"
	>
		{{ label }}
	</button>
</template>
