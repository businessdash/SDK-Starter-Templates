<!-- [bd-file:store] -->
<script setup lang="ts">
/** Lowest and highest price in dollars, with Apply; `range` is what the store's products cost. */
withDefaults(
	defineProps<{
		min?: number | null;
		max?: number | null;
		range?: { minDollars: number; maxDollars: number } | null;
	}>(),
	{ min: null, max: null, range: null },
);
const emit = defineEmits<{ apply: [min: string, max: string] }>();

function submit(event: Event) {
	const form = new FormData(event.target as HTMLFormElement);
	emit("apply", String(form.get("min") ?? "").trim(), String(form.get("max") ?? "").trim());
}
</script>

<template>
	<form class="store-facet" @submit.prevent="submit">
		<p class="store-facet__title">Price</p>
		<div class="store-price">
			<input
				class="bd-input"
				inputmode="numeric"
				name="min"
				aria-label="Lowest price"
				:placeholder="`$${range?.minDollars ?? 0}`"
				:value="min ?? ''"
			/>
			<span class="store-price__sep">–</span>
			<input
				class="bd-input"
				inputmode="numeric"
				name="max"
				aria-label="Highest price"
				:placeholder="`$${range?.maxDollars ?? 0}`"
				:value="max ?? ''"
			/>
		</div>
		<button type="submit" class="bd-btn bd-btn--ghost store-price__apply">Apply</button>
	</form>
</template>
