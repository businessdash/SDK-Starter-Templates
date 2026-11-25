<!-- [bd-file:blog] -->
<script lang="ts">
	/** The comments, oldest first; replies are indented. */
	import type { BlogPublicComment } from '@businessdash/sdk/contracts';
	import { formatPostDate } from '#lib/bd/blog.ts';

	let { comments }: { comments: BlogPublicComment[] } = $props();
</script>

{#if comments.length > 0}
	<ol class="comments__list">
		{#each comments as comment (comment.id)}
			<li class="comment" class:comment--reply={comment.parentId !== null}>
				<p class="comment__head">
					<strong>{comment.authorName ?? 'Reader'}</strong>
					<span>{formatPostDate(comment.createdAt)}</span>
				</p>
				<p class="comment__body">{comment.content}</p>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.comments__list {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.comment {
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
	}
	.comment--reply {
		margin-left: 1.5rem;
	}
	.comment__head {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		margin: 0 0 0.35rem;
		color: var(--title);
	}
	.comment__head span {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.comment__body {
		margin: 0;
		white-space: pre-line;
	}
</style>
