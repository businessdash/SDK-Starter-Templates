<script lang="ts">
	import { enhance } from '$app/forms';

	import { checkReview, REVIEW_MAX_LENGTH, REVIEW_SENT } from '#lib/bd/reviews.ts';

	/**
	 * A signed-in customer writes a review of the business; it waits for the
	 * business to approve it. Signed out, it's a link to sign in. The form
	 * posts to the reviews page's `write` action, which checks it again.
	 */
	let { signedIn, signInHref }: { signedIn: boolean; signInHref: string } = $props();

	let open = $state(false);
	let rating = $state(0);
	let sending = $state(false);
	let sent = $state(false);
	let error = $state('');
	// svelte-ignore state_referenced_locally
	let signedOut = $state(!signedIn);
	let firstStar = $state<HTMLButtonElement>();

	function choose(star: number) {
		rating = star;
		error = '';
	}

	async function start() {
		open = true;
		await Promise.resolve();
		firstStar?.focus();
	}
</script>

{#if sent}
	<p class="review-writer__sent" role="status">{REVIEW_SENT}</p>
{:else if signedOut}
	<a class="bd-btn bd-btn--ghost" href={signInHref}>Sign in to write a review</a>
{:else if !open}
	<button class="bd-btn" type="button" onclick={start}>Write a review</button>
{:else}
	<form
		class="review-writer"
		method="POST"
		action="?/write"
		use:enhance={({ formData, cancel }) => {
			formData.set('rating', String(rating));
			const checked = checkReview({
				rating,
				title: formData.get('title'),
				body: formData.get('body')
			});
			if (!checked.ok) {
				error = checked.error;
				cancel();
				return;
			}
			sending = true;
			error = '';
			return async ({ result }) => {
				sending = false;
				if (result.type === 'success') sent = true;
				else if (result.type === 'failure' && result.status === 401) signedOut = true;
				else if (result.type === 'failure' && typeof result.data?.error === 'string')
					error = result.data.error;
				else error = "Couldn't send your review. Try again.";
			};
		}}
	>
		<fieldset class="review-writer__stars">
			<legend class="bd-label">Your rating</legend>
			{#each [1, 2, 3, 4, 5] as star (star)}
				{#if star === 1}
					<button
						bind:this={firstStar}
						class="review-writer__star"
						class:is-on={star <= rating}
						type="button"
						aria-label="1 star"
						aria-pressed={rating === 1}
						onclick={() => choose(1)}>{1 <= rating ? '★' : '☆'}</button
					>
				{:else}
					<button
						class="review-writer__star"
						class:is-on={star <= rating}
						type="button"
						aria-label={`${star} stars`}
						aria-pressed={rating === star}
						onclick={() => choose(star)}>{star <= rating ? '★' : '☆'}</button
					>
				{/if}
			{/each}
		</fieldset>
		<input type="hidden" name="rating" value={rating} />
		<label class="bd-label" for="review-title">Title (optional)</label>
		<input class="bd-input" id="review-title" name="title" maxlength="200" />
		<label class="bd-label" for="review-body">Your review</label>
		<textarea
			class="bd-textarea"
			id="review-body"
			name="body"
			maxlength={REVIEW_MAX_LENGTH}
			required
			rows="5"
		></textarea>
		<button class="bd-btn" type="submit" disabled={sending}
			>{sending ? 'Sending…' : 'Send review'}</button
		>
		{#if error}<p class="review-writer__error" role="alert">{error}</p>{/if}
	</form>
{/if}
