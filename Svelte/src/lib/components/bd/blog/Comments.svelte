<!-- [bd-file:blog] -->
<script lang="ts">
	/** "3 comments", the form to add one, and the list. */
	import type { ComponentProps } from 'svelte';
	import type { BlogPublicComment } from '@businessdash/sdk/contracts';
	import CommentForm from './CommentForm.svelte';
	import CommentList from './CommentList.svelte';

	let {
		comments,
		...form
	}: { comments: BlogPublicComment[] } & ComponentProps<typeof CommentForm> = $props();
</script>

<section class="comments" aria-labelledby="comments-title">
	<h2 id="comments-title">
		{comments.length}
		{comments.length === 1 ? 'comment' : 'comments'}
	</h2>
	<CommentForm {...form} />
	<CommentList {comments} />
</section>

<style>
	.comments {
		margin-top: 3rem;
	}
	.comments h2 {
		font-size: 1.3rem;
	}
</style>
