<!-- [bd-file:store] -->
<script setup lang="ts">
/** All products, then each category with how many products it has; `select` gets null for all. */
withDefaults(
	defineProps<{
		categories: { id: string; name: string; count: number }[];
		selected?: string | null;
	}>(),
	{ selected: null },
);
const emit = defineEmits<{ select: [categoryId: string | null] }>();
</script>

<template>
	<div v-if="categories.length" class="store-facet">
		<p class="store-facet__title">Category</p>
		<ul class="store-facet__list">
			<li>
				<button
					type="button"
					class="store-facet__item"
					:class="{ 'store-facet__item--active': !selected }"
					@click="emit('select', null)"
				>
					All products
				</button>
			</li>
			<li v-for="c in categories" :key="c.id">
				<button
					type="button"
					class="store-facet__item store-facet__item--row"
					:class="{ 'store-facet__item--active': selected === c.id }"
					@click="emit('select', selected === c.id ? null : c.id)"
				>
					<span>{{ c.name }}</span>
					<span class="store-facet__count">{{ c.count }}</span>
				</button>
			</li>
		</ul>
	</div>
</template>
