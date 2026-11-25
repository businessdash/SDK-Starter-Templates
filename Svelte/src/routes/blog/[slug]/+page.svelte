<!-- [bd-file:blog] -->
<script lang="ts">
	/**
	 * One post, laid out from the blog's parts in `#lib/components/bd/blog/`:
	 * meta, body (or members-only), call to action, tags, the like button and
	 * comments. Likes and comments post to this page's actions, so they work
	 * before its script loads.
	 */
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import Comments from '#lib/components/bd/blog/Comments.svelte';
	import LikeButton from '#lib/components/bd/blog/LikeButton.svelte';
	import MembersOnly from '#lib/components/bd/blog/MembersOnly.svelte';
	import PostBody from '#lib/components/bd/blog/PostBody.svelte';
	import PostCta from '#lib/components/bd/blog/PostCta.svelte';
	import PostMeta from '#lib/components/bd/blog/PostMeta.svelte';
	import PostTags from '#lib/components/bd/blog/PostTags.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const likes = $derived(form && 'likes' in form && form.likes ? form.likes : data.likes);
	// What was typed comes back when a comment couldn't be posted.
	const draft = $derived.by(() => {
		const content = (form as { content?: unknown } | null)?.content;
		return typeof content === 'string' ? content : '';
	});
</script>

<svelte:head>
	<title>{data.post.title}</title>
	{#if data.post.excerpt}<meta name="description" content={data.post.excerpt} />{/if}
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.post.title} />
	<meta property="og:url" content={data.url} />
	{#if data.post.imageUrl}<meta property="og:image" content={data.post.imageUrl} />{/if}
	<link rel="canonical" href={data.url} />
</svelte:head>

<Header />

<main class="bd-section bd-section--narrow">
	<article class="post">
		<a class="post__back" href="/blog">← All posts</a>
		<header class="post__head">
			<h1>{data.post.title}</h1>
			<PostMeta post={data.post} minutes={data.minutes} />
		</header>

		{#if data.post.imageUrl}
			<img class="post__cover" src={data.post.imageUrl} alt="" referrerpolicy="no-referrer" />
		{/if}

		{#if data.paywalled}
			<MembersOnly signInHref={data.signInHref} />
		{:else}
			<!-- Rebuilt from an allowlist on the server: see #lib/bd/blog.ts. -->
			<PostBody html={data.html} />
		{/if}

		<PostCta post={data.post} />
		<PostTags tags={data.post.tags} />
		<LikeButton
			{likes}
			signedIn={data.signedIn}
			signInHref={data.signInHref}
			error={form && 'like' in form ? form.like : null}
		/>
	</article>

	<Comments
		comments={data.comments}
		signedIn={data.signedIn}
		signInHref={data.signInHref}
		{draft}
		error={form && 'comment' in form ? form.comment : null}
		posted={form && 'posted' in form ? form.posted : null}
	/>
</main>

<Footer />

<style>
	.post__back {
		font-size: 0.9rem;
		border-bottom: none;
	}
	.post__head h1 {
		margin: 1rem 0 0.75rem;
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1.1;
		color: var(--title);
	}
	.post__cover {
		width: 100%;
		margin: 2rem 0 0;
		border-radius: 1rem;
		object-fit: cover;
		max-height: 32rem;
	}
</style>
