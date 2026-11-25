<!-- [bd-file:blog] -->
<script setup lang="ts">
/** A post in the list: cover, Pinned, date, reading time, title, excerpt, author. `lead` makes it the wide first card. */
import type { BlogPublicPost } from "@businessdash/sdk/contracts";
import { formatPostDate, readingMinutes } from "#shared/bd/blog";

withDefaults(defineProps<{ post: BlogPublicPost; lead?: boolean; blogHref?: string }>(), {
	lead: false,
	blogHref: "/blog",
});
</script>

<template>
	<li class="bd-card post-card" :class="{ 'post-card--lead': lead }">
		<NuxtLink :to="`${blogHref}/${post.slug}`" class="post-card__link">
			<img
				v-if="post.imageUrl"
				class="post-card__img"
				:src="post.imageUrl"
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
			<div class="post-card__body">
				<p class="post-card__meta">
					<span v-if="post.isPinned" class="bd-badge">Pinned</span>
					<span>{{ formatPostDate(post.publishedAt) }}</span>
					<span>· {{ readingMinutes(post.content || post.excerpt || "") }} min read</span>
				</p>
				<h2>{{ post.title }}</h2>
				<p v-if="post.excerpt" class="post-card__excerpt">{{ post.excerpt }}</p>
				<p v-if="post.authorName" class="post-card__author">{{ post.authorName }}</p>
			</div>
		</NuxtLink>
	</li>
</template>
