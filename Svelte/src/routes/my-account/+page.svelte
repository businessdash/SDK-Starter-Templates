<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import type { ActionData, PageData } from './$types';
	import type { ReviewState } from './+page.server';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// SvelteKit's generated `ActionData` flattens the action's union; read the
	// review payload through the server-defined `ReviewState` so `fieldErrors`
	// narrows on `status`.
	const review = $derived(form?.review as ReviewState | undefined);
	const user = $derived(data.session?.user);
	const work = $derived(data.work);

	function displayName(): string {
		if (!user) return '';
		const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
		return name || user.email || 'there';
	}
</script>

<svelte:head><title>My account</title></svelte:head>

<Header />

<main class="bd-section bd-section--narrow">
	{#if !data.configured}
		<div class="bd-empty">
			Customer accounts aren't configured. Set <code>BD_AUTH_CALLBACK_URL</code>
			(plus the API key + base URL) to enable sign-in.
		</div>
	{:else if !data.session}
		<div class="bd-card account-signin">
			<h1 class="bd-section__title">My account</h1>
			<p>Sign in to view your jobs, quotes and invoices, and to leave a review.</p>
			<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
				<a class="bd-btn" href="/api/bd-auth/sign-in">Sign in</a>
				<a class="bd-btn bd-btn--ghost" href="/api/bd-auth/sign-up">Create account</a>
			</div>
		</div>
	{:else}
		<div class="bd-section__lead" style="text-align: left;">
			<span class="bd-section__eyebrow">Account</span>
			<h1 class="bd-section__title">Welcome back, {displayName()}.</h1>
		</div>

		<div class="bd-card account-card">
			<div class="account-card__head">
				<div>
					<strong>{user?.email ?? 'Signed in'}</strong>
					{#if data.session.role}
						<span class="bd-badge">{data.session.role}</span>
					{/if}
				</div>
				<a class="bd-btn bd-btn--ghost" href="/api/bd-auth/sign-out">Sign out</a>
			</div>

			{#if work}
				{#if work.unlinked}
					<p class="account-note">
						Your account isn't linked to a customer record yet. Once we connect
						your email to a project, your jobs and invoices will appear here.
					</p>
				{:else}
					<div class="account-stats">
						<div><span>{work.summary.openJobCount}</span>Open jobs</div>
						<div><span>{work.summary.pendingQuoteCount}</span>Pending quotes</div>
						<div><span>{work.summary.unpaidInvoiceCount}</span>Unpaid invoices</div>
						<div><span>{work.summary.awaitingSignatureCount}</span>Awaiting signature</div>
					</div>
					{#if work.jobs.length > 0}
						<div class="account-jobs">
							<h3>Recent jobs</h3>
							<ul>
								{#each work.jobs.slice(0, 5) as job (job.id)}
									<li>
										<strong>{job.name ?? 'Job'}</strong>
										<span class="bd-badge">{job.status}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			{/if}
		</div>

		<div class="bd-card account-card">
			<h3>Leave a review</h3>
			{#if review?.status === 'success'}
				<div class="account-msg account-msg--ok">{review.message}</div>
			{:else}
				<form method="POST" action="?/submitReview" use:enhance class="review-form">
					<div>
						<label class="bd-label" for="rating">Rating (1–5)</label>
						<input
							class="bd-input"
							id="rating"
							name="rating"
							type="number"
							min="1"
							max="5"
							value="5"
							style="max-width: 6rem;"
						/>
						{#if review?.status === 'error' && review.fieldErrors?.rating}
							<small style="color: var(--danger);">{review.fieldErrors.rating}</small>
						{/if}
					</div>
					<div>
						<label class="bd-label" for="title">Title (optional)</label>
						<input class="bd-input" id="title" name="title" type="text" />
					</div>
					<div>
						<label class="bd-label" for="body">Your review</label>
						<textarea class="bd-textarea" id="body" name="body" required></textarea>
						{#if review?.status === 'error' && review.fieldErrors?.body}
							<small style="color: var(--danger);">{review.fieldErrors.body}</small>
						{/if}
					</div>
					<button class="bd-btn" type="submit" style="align-self: flex-start;">
						Submit review
					</button>
					{#if review?.status === 'error'}
						<div class="account-msg account-msg--err">{review.message}</div>
					{/if}
				</form>
			{/if}
		</div>
	{/if}
</main>

<Footer />

<style>
	.account-signin,
	.account-card {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
	}
	.account-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.account-card__head .bd-badge {
		margin-left: 0.5rem;
	}
	.account-note {
		color: var(--text-muted);
	}
	.account-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 1rem;
	}
	.account-stats div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.account-stats span {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--title);
	}
	.account-jobs ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.account-jobs li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
	}
	.review-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.account-msg {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.9rem;
	}
	.account-msg--ok {
		background: var(--success-bg);
		color: var(--success);
	}
	.account-msg--err {
		background: var(--danger-bg);
		color: var(--danger);
	}
</style>
