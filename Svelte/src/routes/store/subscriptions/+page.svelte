<script lang="ts">
	import Header from '$lib/components/biab/Header.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import StoreNav from '$lib/components/biab/StoreNav.svelte';
	import { formatCents } from '$lib/biab/cart-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);

	function intervalLabel(interval: string): string {
		return { day: 'day', week: 'week', month: 'mo', year: 'yr' }[interval] ?? interval;
	}

	async function subscribe(id: string) {
		busyId = id;
		error = null;
		try {
			const res = await fetch(
				`/api/biab/subscriptions/${encodeURIComponent(id)}/checkout`,
				{ method: 'POST' },
			);
			const body = (await res.json()) as
				| { ok: true; url: string }
				| { ok: false; error: string };
			if (body.ok) {
				window.location.href = body.url;
				return;
			}
			error = body.error;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Network error.';
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head><title>Subscriptions</title></svelte:head>

<Header />
<StoreNav cartCount={data.cartCount} />

<main class="biab-section">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">Memberships</span>
		<h1 class="biab-section__title">Subscriptions</h1>
		<p class="biab-section__sub">
			Recurring plans from the BIAB subscriptions surface. Checkout hands off to
			Stripe in subscription mode.
		</p>
	</div>

	{#if !data.configured}
		<div class="biab-empty">Store isn't connected.</div>
	{:else if data.subscriptions.length === 0}
		<div class="biab-empty">
			No subscription offerings yet. Create one in the BIAB dashboard and sync it
			to Stripe.
		</div>
	{:else}
		<div class="biab-grid-3">
			{#each data.subscriptions as sub (sub.id)}
				<article class="biab-card sub-card">
					{#if sub.imageUrl}
						<img class="sub-card__img" src={sub.imageUrl} alt={sub.name} loading="lazy" />
					{/if}
					<div class="sub-card__body">
						<h3>{sub.name}</h3>
						{#if sub.description}
							<p>{sub.description}</p>
						{/if}
						<div class="sub-card__price">
							{formatCents(sub.amountCents)}<span> / {intervalLabel(sub.interval)}</span>
						</div>
						<button
							class="biab-btn"
							onclick={() => subscribe(sub.id)}
							disabled={busyId === sub.id}
						>
							{busyId === sub.id ? 'Working…' : 'Subscribe'}
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if error}
		<div
			style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem; margin-top: 1rem;"
		>
			{error}
		</div>
	{/if}
</main>

<Footer />

<style>
	.sub-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.sub-card__img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
	}
	.sub-card__body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.sub-card__body p {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.sub-card__price {
		color: var(--accent);
		font-weight: 700;
		font-size: 1.2rem;
	}
	.sub-card__price span {
		color: var(--text-muted);
		font-weight: 500;
		font-size: 0.85rem;
	}
</style>
