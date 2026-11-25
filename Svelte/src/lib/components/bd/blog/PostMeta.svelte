<!-- [bd-file:blog] -->
<script lang="ts">
	/** The author's photo and name, the date, and the reading time. */
	import type { BlogPublicPost } from '@businessdash/sdk/contracts';
	import { formatPostDate } from '#lib/bd/blog.ts';

	let {
		post,
		minutes
	}: {
		post: Pick<BlogPublicPost, 'authorName' | 'authorAvatarUrl' | 'publishedAt'>;
		minutes: number;
	} = $props();
</script>

<p class="post__meta">
	{#if post.authorAvatarUrl}
		<img src={post.authorAvatarUrl} alt="" referrerpolicy="no-referrer" />
	{/if}
	{#if post.authorName}<span>{post.authorName}</span>{/if}
	<span>{formatPostDate(post.publishedAt)}</span>
	<span>· {minutes} min read</span>
</p>

<style>
	.post__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.post__meta img {
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		object-fit: cover;
	}
</style>
