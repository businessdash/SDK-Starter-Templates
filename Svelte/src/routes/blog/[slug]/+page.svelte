<!-- [bd-file:blog] -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import { formatPostDate } from '#lib/bd/blog.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const likes = $derived(form && 'likes' in form && form.likes ? form.likes : data.likes);
	// What was typed comes back when a comment couldn't be posted.
	const draft = $derived.by(() => {
		const content = (form as { content?: unknown } | null)?.content;
		return typeof content === 'string' ? content : '';
	});

	function commentDate(iso: string): string {
		return formatPostDate(iso);
	}
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
			<p class="post__meta">
				{#if data.post.authorAvatarUrl}
					<img src={data.post.authorAvatarUrl} alt="" referrerpolicy="no-referrer" />
				{/if}
				{#if data.post.authorName}<span>{data.post.authorName}</span>{/if}
				<span>{formatPostDate(data.post.publishedAt)}</span>
				<span>· {data.minutes} min read</span>
			</p>
		</header>

		{#if data.post.imageUrl}
			<img class="post__cover" src={data.post.imageUrl} alt="" referrerpolicy="no-referrer" />
		{/if}

		{#if data.paywalled}
			<div class="bd-empty">
				This post is for members.
				<p><a class="bd-btn" href={data.signInHref}>Sign in to read it</a></p>
			</div>
		{:else}
			<!-- Rebuilt from an allowlist on the server: see #lib/bd/blog.ts. -->
			<div class="post__body">{@html data.html}</div>
		{/if}

		{#if data.post.ctaHref && data.post.ctaLabel}
			<aside class="bd-card post__cta">
				{#if data.post.ctaDescription}<p>{data.post.ctaDescription}</p>{/if}
				<a class="bd-btn" href={data.post.ctaHref}>{data.post.ctaLabel}</a>
			</aside>
		{/if}

		{#if data.post.tags.length > 0}
			<ul class="post__tags">
				{#each data.post.tags as tag (tag)}
					<li><a href={`/blog?tag=${encodeURIComponent(tag)}`}>#{tag}</a></li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/like" use:enhance class="post__like">
			{#if data.signedIn}
				<button type="submit" class="like" class:like--on={likes.liked} aria-pressed={likes.liked}>
					<span aria-hidden="true">{likes.liked ? '♥' : '♡'}</span>
					{likes.liked ? 'Liked' : 'Like'}
				</button>
			{:else}
				<a class="like" href={data.signInHref}><span aria-hidden="true">♡</span> Sign in to like</a>
			{/if}
			<span class="post__likes">{likes.likesCount} {likes.likesCount === 1 ? 'like' : 'likes'}</span
			>
			{#if form && 'like' in form}<span class="post__error" role="alert">{form.like}</span>{/if}
		</form>
	</article>

	<section class="comments" aria-labelledby="comments-title">
		<h2 id="comments-title">
			{data.comments.length}
			{data.comments.length === 1 ? 'comment' : 'comments'}
		</h2>

		{#if data.signedIn}
			<form method="POST" action="?/comment" use:enhance class="comments__form">
				<label class="bd-label" for="comment">Add a comment</label>
				<textarea
					id="comment"
					name="content"
					class="bd-textarea"
					rows="4"
					maxlength="5000"
					required
					value={draft}
				></textarea>
				<button class="bd-btn" type="submit">Post comment</button>
				{#if form && 'comment' in form}<p class="post__error" role="alert">{form.comment}</p>{/if}
				{#if form && 'posted' in form}<p class="comments__ok" role="status">{form.posted}</p>{/if}
			</form>
		{:else}
			<p class="comments__signin">
				<a class="bd-btn bd-btn--ghost" href={data.signInHref}>Sign in to comment</a>
			</p>
		{/if}

		{#if data.comments.length > 0}
			<ol class="comments__list">
				{#each data.comments as comment (comment.id)}
					<li class="comment" class:comment--reply={comment.parentId !== null}>
						<p class="comment__head">
							<strong>{comment.authorName ?? 'Reader'}</strong>
							<span>{commentDate(comment.createdAt)}</span>
						</p>
						<p class="comment__body">{comment.content}</p>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
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
	.post__cover {
		width: 100%;
		margin: 2rem 0 0;
		border-radius: 1rem;
		object-fit: cover;
		max-height: 32rem;
	}
	.post__body {
		margin-top: 2rem;
		color: var(--text);
		font-size: 1.08rem;
		line-height: 1.75;
		overflow-wrap: anywhere;
	}
	.post__body :global(h2),
	.post__body :global(h3) {
		margin: 2rem 0 0.75rem;
		color: var(--title);
		line-height: 1.25;
	}
	.post__body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}
	.post__body :global(blockquote) {
		margin: 1.5rem 0;
		padding-left: 1rem;
		border-left: 3px solid var(--accent);
		color: var(--subtitle);
	}
	.post__body :global(pre) {
		overflow-x: auto;
		padding: 1rem;
		border-radius: 0.6rem;
		background: var(--bg-soft);
		font-family: var(--mono);
		font-size: 0.9rem;
	}
	.post__body :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
	}
	.post__body :global(th),
	.post__body :global(td) {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
	}
	.post__cta {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		margin-top: 2rem;
		padding: 1.5rem;
	}
	.post__cta p {
		margin: 0;
	}
	.post__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
	}
	.post__tags a {
		color: var(--text-muted);
		font-size: 0.88rem;
	}
	.post__like {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}
	.like {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
		background: var(--card);
		color: var(--title);
		font: inherit;
		cursor: pointer;
	}
	.like--on {
		border-color: var(--accent);
		background: var(--accent-bg);
		color: var(--accent);
	}
	.post__likes {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.post__error {
		color: var(--danger);
		font-size: 0.9rem;
	}
	.comments {
		margin-top: 3rem;
	}
	.comments h2 {
		font-size: 1.3rem;
	}
	.comments__signin {
		margin: 1rem 0 1.5rem;
	}
	.comments__form {
		display: grid;
		gap: 0.6rem;
		justify-items: start;
		margin: 1rem 0 2rem;
	}
	.comments__form textarea {
		width: 100%;
	}
	.comments__ok {
		color: var(--success);
	}
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
