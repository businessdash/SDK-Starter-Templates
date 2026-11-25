<!-- [bd-file:blog] -->
<script setup lang="ts">
/** The post's tags, each linking to the posts with it. */
withDefaults(defineProps<{ tags: string[]; blogHref?: string }>(), { blogHref: "/blog" });
</script>

<template>
	<ul v-if="tags.length > 0" class="post__tags">
		<li v-for="tag in tags" :key="tag">
			<NuxtLink :to="{ path: blogHref, query: { tag } }">#{{ tag }}</NuxtLink>
		</li>
	</ul>
</template>
