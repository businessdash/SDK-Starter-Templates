<!-- [bd-file:blog] -->
<script lang="ts">
	/**
	 * ♡ Like and how many likes. It posts to the page's `?/like` action, so
	 * it works before the page's script loads; signed out, it leads to
	 * sign-in. `error` is what the action said went wrong.
	 */
	import { enhance } from '$app/forms';
	import type { BlogLikeResponse } from '@businessdash/sdk/contracts';

	let {
		likes,
		signedIn,
		signInHref,
		action = '?/like',
		error = null
	}: {
		likes: BlogLikeResponse;
		signedIn: boolean;
		signInHref: string;
		action?: string;
		error?: string | null;
	} = $props();
</script>

<form method="POST" {action} use:enhance class="post__like">
	{#if signedIn}
		<button type="submit" class="like" class:like--on={likes.liked} aria-pressed={likes.liked}>
			<span aria-hidden="true">{likes.liked ? '♥' : '♡'}</span>
			{likes.liked ? 'Liked' : 'Like'}
		</button>
	{:else}
		<a class="like" href={signInHref}><span aria-hidden="true">♡</span> Sign in to like</a>
	{/if}
	<span class="post__likes">{likes.likesCount} {likes.likesCount === 1 ? 'like' : 'likes'}</span>
	{#if error}<span class="post__error" role="alert">{error}</span>{/if}
</form>

<style>
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
</style>
