<!-- [bd-file:blog] -->
<script setup lang="ts">
/** The comments, oldest first; replies are indented. */
import type { BlogPublicComment } from "@businessdash/sdk/contracts";
import { formatPostDate } from "#shared/bd/blog";

defineProps<{ comments: BlogPublicComment[] }>();
</script>

<template>
	<ol v-if="comments.length > 0" class="comments__list">
		<li
			v-for="comment in comments"
			:key="comment.id"
			class="comment"
			:class="{ 'comment--reply': comment.parentId !== null }"
		>
			<p class="comment__head">
				<strong>{{ comment.authorName ?? "Reader" }}</strong>
				<span>{{ formatPostDate(comment.createdAt) }}</span>
			</p>
			<p class="comment__body">{{ comment.content }}</p>
		</li>
	</ol>
</template>
