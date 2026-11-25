<script setup lang="ts">
/** All, then each platform the reviews come from (Google, Yelp…); shown when there's more than one. */
import { sourceLabel } from "#shared/bd/reviews";

withDefaults(defineProps<{ sources: string[]; selected?: string | null; reviewsHref?: string }>(), {
	selected: null,
	reviewsHref: "/reviews",
});
</script>

<template>
	<nav v-if="sources.length > 1" aria-label="Platform">
		<ul class="reviews-filter">
			<li>
				<NuxtLink :to="reviewsHref" :aria-current="selected ? 'false' : 'true'">All</NuxtLink>
			</li>
			<li v-for="source in sources" :key="source">
				<NuxtLink
					:to="`${reviewsHref}?source=${source}`"
					:aria-current="selected === source ? 'true' : 'false'"
					>{{ sourceLabel(source) }}</NuxtLink
				>
			</li>
		</ul>
	</nav>
</template>
