<!-- [bd-file:blog] -->
<script lang="ts">
	/**
	 * Add a comment, posted to the page's `?/comment` action; signed out, a
	 * link to sign in. `draft` is what was typed when posting failed, `error`
	 * what went wrong, `posted` the note once it's in.
	 */
	import { enhance } from '$app/forms';

	let {
		signedIn,
		signInHref,
		action = '?/comment',
		draft = '',
		error = null,
		posted = null
	}: {
		signedIn: boolean;
		signInHref: string;
		action?: string;
		draft?: string;
		error?: string | null;
		posted?: string | null;
	} = $props();
</script>

{#if signedIn}
	<form method="POST" {action} use:enhance class="comments__form">
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
		{#if error}<p class="post__error" role="alert">{error}</p>{/if}
		{#if posted}<p class="comments__ok" role="status">{posted}</p>{/if}
	</form>
{:else}
	<p class="comments__signin">
		<a class="bd-btn bd-btn--ghost" href={signInHref}>Sign in to comment</a>
	</p>
{/if}

<style>
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
	.post__error {
		color: var(--danger);
		font-size: 0.9rem;
	}
</style>
