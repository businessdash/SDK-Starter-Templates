<!-- [bd-file:blog] -->
<script lang="ts">
	/** A post in the list: cover, Pinned, date, reading time, title, excerpt, author. `lead` makes it the wide first card. */
	import type { BlogPublicPost } from '@businessdash/sdk/contracts';
	import { formatPostDate, readingMinutes } from '#lib/bd/blog.ts';

	let {
		post,
		lead = false,
		blogHref = '/blog'
	}: { post: BlogPublicPost; lead?: boolean; blogHref?: string } = $props();
</script>

<li class="bd-card post-card" class:post-card--lead={lead}>
	<a href={`${blogHref}/${post.slug}`} class="post-card__link">
		{#if post.imageUrl}
			<img
				class="post-card__img"
				src={post.imageUrl}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
		{/if}
		<div class="post-card__body">
			<p class="post-card__meta">
				{#if post.isPinned}<span class="bd-badge">Pinned</span>{/if}
				<span>{formatPostDate(post.publishedAt)}</span>
				<span>· {readingMinutes(post.content || post.excerpt || '')} min read</span>
			</p>
			<h2>{post.title}</h2>
			{#if post.excerpt}<p class="post-card__excerpt">{post.excerpt}</p>{/if}
			{#if post.authorName}<p class="post-card__author">{post.authorName}</p>{/if}
		</div>
	</a>
</li>

<style>
	.post-card {
		overflow: hidden;
		padding: 0;
	}
	.post-card__link {
		display: flex;
		flex-direction: column;
		height: 100%;
		color: inherit;
		border-bottom: none;
	}
	.post-card__img {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		background: var(--bg-soft);
	}
	.post-card__body {
		display: grid;
		gap: 0.5rem;
		padding: 1.25rem;
	}
	.post-card__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.post-card h2 {
		margin: 0;
		font-size: 1.2rem;
		color: var(--title);
	}
	.post-card__excerpt {
		margin: 0;
		color: var(--text);
	}
	.post-card__author {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	/* After the card's own rules: `.post-card--lead h2` and `.post-card h2` weigh the same, so the later one wins. */
	@media (min-width: 900px) {
		.post-card--lead {
			grid-column: 1 / -1;
		}
		.post-card--lead .post-card__link {
			display: grid;
			grid-template-columns: 1.2fr 1fr;
		}
		.post-card--lead .post-card__body {
			align-content: center;
		}
		.post-card--lead .post-card__img {
			height: 100%;
			aspect-ratio: auto;
		}
		.post-card--lead h2 {
			font-size: 1.8rem;
		}
	}
</style>
