<!-- [bd-file:store] -->
<script lang="ts">
/** The sorts, in the order they're offered. */
export const SORT_LABELS: Record<string, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};
</script>

<script setup lang="ts">
/** Featured, Newest, Price either way, Top rated; `sort` fires with the new one. */
withDefaults(defineProps<{ value?: string }>(), { value: "featured" });
const emit = defineEmits<{ sort: [sort: string] }>();
</script>

<template>
	<label class="store-sort">
		<span>Sort</span>
		<select
			class="bd-select"
			:value="value"
			@change="emit('sort', ($event.target as HTMLSelectElement).value)"
		>
			<option v-for="(label, key) in SORT_LABELS" :key="key" :value="key">
				{{ label }}
			</option>
		</select>
	</label>
</template>
