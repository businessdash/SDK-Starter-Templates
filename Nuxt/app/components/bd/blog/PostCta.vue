<!-- [bd-file:blog] -->
<script setup lang="ts">
/** The post's call to action, when it has one. */
defineProps<{
	post: { ctaLabel: string | null; ctaHref: string | null; ctaDescription: string | null };
}>();
</script>

<template>
	<aside v-if="post.ctaHref && post.ctaLabel" class="bd-card post__cta">
		<p v-if="post.ctaDescription">{{ post.ctaDescription }}</p>
		<a class="bd-btn" :href="post.ctaHref">{{ post.ctaLabel }}</a>
	</aside>
</template>
