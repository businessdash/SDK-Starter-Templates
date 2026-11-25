<!-- [bd-file:blog] -->
<script lang="ts">
	import { page } from '$app/state';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import { formatPostDate, readingMinutes } from '#lib/bd/blog.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const activeCategory = $derived(data.categories.find((c) => c.id === data.categoryId));

	/** A link to this page with one filter changed and the paging reset. */
	function href(key: 'category' | 'tag', value: string | null): string {
		const params = new URLSearchParams(page.url.search);
		params.delete('cursor');
		if (value) params.set(key, value);
		else params.delete(key);
		const query = params.toString();
		return query ? `/blog?${query}` : '/blog';
	}

	function nextHref(cursor: number): string {
		const params = new URLSearchParams(page.url.search);
		params.set('cursor', String(cursor));
		return `/blog?${params}`;
	}
</script>

<svelte:head>
	<title>{activeCategory ? `${activeCategory.name} · Blog` : 'Blog'}</title>
	<meta name="description" content="News, guides and stories from the team." />
</svelte:head>

<Header />

<main class="bd-section">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Blog</span>
		<h1 class="bd-section__title">{activeCategory?.name ?? 'From the blog'}</h1>
		{#if activeCategory?.description}
			<p class="bd-section__sub">{activeCategory.description}</p>
		{/if}
	</div>

	{#if data.categories.length > 0 || data.tags.length > 0}
		<nav class="blog-filters" aria-label="Blog topics">
			{#if data.categories.length > 0}
				<ul>
					<li><a href={href('category', null)} aria-current={!data.categoryId}>All</a></li>
					{#each data.categories as category (category.id)}
						<li>
							<a
								href={href('category', category.id)}
								aria-current={data.categoryId === category.id}
							>
								{category.name}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.tags.length > 0}
				<ul class="blog-filters__tags">
					{#each data.tags as tag (tag)}
						<li>
							<a href={href('tag', data.tag === tag ? null : tag)} aria-current={data.tag === tag}>
								#{tag}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</nav>
	{/if}

	{#if !data.configured}
		<div class="bd-empty">The blog isn't connected yet.</div>
	{:else if data.posts.length === 0}
		<div class="bd-empty">
			{data.tag || data.categoryId
				? 'No posts here yet.'
				: "No posts published yet. Write one in Business Dash and it'll appear here."}
		</div>
	{:else}
		<ul class="posts">
			{#each data.posts as post, i (post.id)}
				<li
					class="bd-card post-card"
					class:post-card--lead={i === 0 && !page.url.searchParams.has('cursor')}
				>
					<a href={`/blog/${post.slug}`} class="post-card__link">
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
			{/each}
		</ul>
		{#if data.nextCursor !== null && !data.tag}
			<p class="posts__more">
				<a class="bd-btn bd-btn--ghost" href={nextHref(data.nextCursor)}>Older posts</a>
			</p>
		{/if}
	{/if}
</main>

<Footer />

<style>
	.blog-filters {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}
	.blog-filters ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.blog-filters a {
		display: inline-block;
		padding: 0.35rem 0.85rem;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
		color: var(--title);
		font-size: 0.88rem;
	}
	.blog-filters__tags a {
		border-style: dashed;
		color: var(--text-muted);
	}
	.blog-filters a[aria-current='true'] {
		border-color: var(--accent);
		background: var(--accent-bg);
		color: var(--accent);
	}
	.posts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: 1.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.post-card {
		overflow: hidden;
		padding: 0;
	}
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
	.posts__more {
		margin-top: 2rem;
		text-align: center;
	}
</style>
