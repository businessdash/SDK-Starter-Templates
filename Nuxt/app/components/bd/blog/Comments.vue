<!-- [bd-file:blog] -->
<script setup lang="ts">
/** "3 comments", the form to add one, and the list; `refresh` reloads the list after a comment is added. */
import type { BlogPublicComment } from "@businessdash/sdk/contracts";
import CommentForm from "./CommentForm.vue";
import CommentList from "./CommentList.vue";

defineProps<{
	comments: BlogPublicComment[];
	signedIn: boolean;
	signInHref: string;
	commentUrl: string;
	refresh?: () => Promise<unknown>;
}>();
</script>

<template>
	<section class="comments" aria-labelledby="comments-title">
		<h2 id="comments-title">
			{{ comments.length }} {{ comments.length === 1 ? "comment" : "comments" }}
		</h2>
		<CommentForm
			:signed-in="signedIn"
			:sign-in-href="signInHref"
			:comment-url="commentUrl"
			:refresh="refresh"
		/>
		<CommentList :comments="comments" />
	</section>
</template>
