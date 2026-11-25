<!-- [bd-file:store] -->
<script setup lang="ts">
/** 4, 3 or 2 stars & up; `select` gets null when the chosen one is pressed again. */
import StarRating from "~/components/bd/StarRating.vue";

withDefaults(defineProps<{ selected?: number | null }>(), { selected: null });
const emit = defineEmits<{ select: [rating: number | null] }>();
</script>

<template>
	<div class="store-facet">
		<p class="store-facet__title">Rating</p>
		<ul class="store-facet__list">
			<li v-for="r in [4, 3, 2]" :key="r">
				<button
					type="button"
					class="store-facet__item store-facet__rating"
					:class="{ 'store-facet__item--active': selected === r }"
					@click="emit('select', selected === r ? null : r)"
				>
					<StarRating :rating="r" />
					<span class="store-facet__count">&amp; up</span>
				</button>
			</li>
		</ul>
	</div>
</template>
