<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * Save a product to the wishlist, or add it to the compare table. Both lists
 * live in this browser (see `#shared/bd/shop`), so the buttons learn their
 * state once the page is in the browser.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { compareList, type SavedProduct, wishlist } from "#shared/bd/shop";

const props = withDefaults(
	defineProps<{ product: SavedProduct; compact?: boolean }>(),
	{ compact: false },
);

const saved = ref(false);
const comparing = ref(false);
const compareFull = ref(false);
let stop: (() => void)[] = [];

function sync() {
	saved.value = wishlist.has(props.product.id);
	comparing.value = compareList.has(props.product.id);
	compareFull.value =
		!comparing.value && compareList.read().length >= compareList.limit;
}

onMounted(() => {
	sync();
	stop = [wishlist.subscribe(sync), compareList.subscribe(sync)];
});
onBeforeUnmount(() => stop.forEach((off) => off()));

// Inside a product card (a link), pressing a button must not follow it.
function press(event: MouseEvent, action: () => void) {
	event.preventDefault();
	event.stopPropagation();
	action();
}
</script>

<template>
	<div class="save-buttons" :class="{ 'save-buttons--compact': compact }">
		<button
			type="button"
			class="save-buttons__btn"
			:class="{ 'save-buttons__btn--on': saved }"
			:aria-pressed="saved"
			:aria-label="
				saved
					? `Remove ${product.name} from your wishlist`
					: `Save ${product.name} to your wishlist`
			"
			@click="press($event, () => wishlist.toggle(product))"
		>
			<span aria-hidden="true">{{ saved ? "♥" : "♡" }}</span>
			<template v-if="!compact">{{ saved ? "Saved" : "Save" }}</template>
		</button>
		<button
			type="button"
			class="save-buttons__btn"
			:class="{ 'save-buttons__btn--on': comparing }"
			:aria-pressed="comparing"
			:disabled="compareFull"
			:title="compareFull ? `The compare table holds ${compareList.limit}` : undefined"
			:aria-label="comparing ? `Remove ${product.name} from compare` : `Compare ${product.name}`"
			@click="press($event, () => compareList.toggle(product))"
		>
			<span aria-hidden="true">⇄</span>
			<template v-if="!compact">{{ comparing ? "Comparing" : "Compare" }}</template>
		</button>
	</div>
</template>
