<!-- [bd-file:blog] -->
<script lang="ts">
	/**
	 * The blog, laid out from its parts in `#lib/components/bd/blog/`: the
	 * category and tag filters, and a post card per post. The filters and
	 * paging are in the URL, so they're plain links.
	 */
	import { page } from '$app/state';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import BlogFilters from '#lib/components/bd/blog/BlogFilters.svelte';
	import PostCard from '#lib/components/bd/blog/PostCard.svelte';
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

	<BlogFilters
		categories={data.categories}
		tags={data.tags}
		category={data.categoryId}
		tag={data.tag}
		{href}
	/>

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
				<PostCard {post} lead={i === 0 && !page.url.searchParams.has('cursor')} />
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
	.posts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: 1.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.posts__more {
		margin-top: 2rem;
		text-align: center;
	}
</style>
