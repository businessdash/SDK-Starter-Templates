<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * All, each category, then each tag, as links. `link(kind, value)` builds
 * the link for a filter (null for none); the chosen ones are marked.
 */
import type { BlogCategory } from "@businessdash/sdk/contracts";
import type { RouteLocationRaw } from "vue-router";

withDefaults(
	defineProps<{
		categories: BlogCategory[];
		tags: string[];
		category?: string;
		tag?: string;
		link: (kind: "category" | "tag", value: string | null) => RouteLocationRaw;
	}>(),
	{ category: "", tag: "" },
);
</script>

<template>
	<nav v-if="categories.length > 0 || tags.length > 0" class="blog-filters" aria-label="Blog topics">
		<ul v-if="categories.length > 0">
			<li>
				<NuxtLink :to="link('category', null)" :aria-current="!category">All</NuxtLink>
			</li>
			<li v-for="c in categories" :key="c.id">
				<NuxtLink :to="link('category', c.id)" :aria-current="category === c.id">
					{{ c.name }}
				</NuxtLink>
			</li>
		</ul>
		<ul v-if="tags.length > 0" class="blog-filters__tags">
			<li v-for="t in tags" :key="t">
				<NuxtLink :to="link('tag', tag === t ? null : t)" :aria-current="tag === t">
					#{{ t }}
				</NuxtLink>
			</li>
		</ul>
	</nav>
</template>
