<!-- [bd-file:blog] -->
<script setup lang="ts">
/** The author's photo and name, the date, and the reading time. */
import { formatPostDate } from "#shared/bd/blog";

defineProps<{
	post: { authorName: string | null; authorAvatarUrl: string | null; publishedAt: string | null };
	minutes: number;
}>();
</script>

<template>
	<p class="post__meta">
		<img v-if="post.authorAvatarUrl" :src="post.authorAvatarUrl" alt="" referrerpolicy="no-referrer" />
		<span v-if="post.authorName">{{ post.authorName }}</span>
		<span>{{ formatPostDate(post.publishedAt) }}</span>
		<span>· {{ minutes }} min read</span>
	</p>
</template>
