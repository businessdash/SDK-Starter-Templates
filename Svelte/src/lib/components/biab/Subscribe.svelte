<!--
  Subscribe — newsletter signup wired to BIAB followers.

  Browser-safe: it talks to the followers surface (`followers:self`) through a
  PUBLISHABLE token (`pk_…`, origin-locked, rate-limited) via the core client —
  no backend, no bearer key. SvelteKit doesn't ship a `useFollowers` hook, so
  the per-browser "already subscribed" hint is implemented here directly: after
  a successful `join` we persist `{ email, at }` under `biab.followers.<siteId>`
  in localStorage and read it on mount, exactly like `useFollowers` does in
  React (see `@businessdash/sdk/react`).

  Graceful split (mirrors DGP `SubscribeStub`):
    - Live mode (PK + SITE_ID set)  → real join, shows "You're subscribed".
    - Placeholder mode (env unset)  → identical fields, submit shows "coming soon".

  One shared component, used in BOTH the footer and the about section.

  Env (SvelteKit public, `$env/static/public`):
    PUBLIC_BIAB_PK                       publishable followers token
    PUBLIC_BIAB_SITE_ID                  the site UUID
    PUBLIC_BIAB_PACKAGE_API_BASE_URL     optional, defaults to production apex
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createBiabClient } from '@businessdash/sdk';
	import {
		PUBLIC_BIAB_PK,
		PUBLIC_BIAB_SITE_ID,
		PUBLIC_BIAB_PACKAGE_API_BASE_URL,
	} from '$env/static/public';

	let {
		label = 'Get updates in your inbox',
		placeholder = 'you@example.com',
		buttonLabel = 'Subscribe',
		/** Tags the follower row so the org sees where they signed up. */
		source = 'subscribe',
		idPrefix = 'subscribe',
	}: {
		label?: string;
		placeholder?: string;
		buttonLabel?: string;
		source?: string;
		idPrefix?: string;
	} = $props();

	// Publishable creds are browser-safe. When unset → placeholder mode so the
	// template still renders in an unconfigured checkout.
	const PK = PUBLIC_BIAB_PK;
	const SITE_ID = PUBLIC_BIAB_SITE_ID;
	const BASE_URL = PUBLIC_BIAB_PACKAGE_API_BASE_URL;
	const enabled = Boolean(PK && SITE_ID);

	const STORE_KEY = `biab.followers.${SITE_ID}`;

	type Status = 'idle' | 'submitting' | 'done' | 'error';
	let status = $state<Status>('idle');
	// Per-browser "already subscribed" hint (anonymous). Read on mount so SSR
	// always renders the form; the client hides it if this browser subscribed.
	let subscribedLocally = $state(false);

	// The core client is constructed lazily (live mode only) and bound to the
	// publishable token. The bearer key never appears here.
	const client = enabled
		? createBiabClient({
				apiKey: PK,
				siteId: SITE_ID,
				...(BASE_URL ? { baseUrl: BASE_URL } : {}),
			})
		: null;

	onMount(() => {
		if (!enabled || typeof window === 'undefined') return;
		try {
			const raw = window.localStorage.getItem(STORE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as { email?: unknown };
				subscribedLocally = typeof parsed?.email === 'string';
			}
		} catch {
			// storage disabled / quota — the local hint is best-effort.
		}
	});

	function rememberLocally(email: string): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(STORE_KEY, JSON.stringify({ email, at: Date.now() }));
		} catch {
			// ignore — best-effort UX hint only.
		}
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const email = String(new FormData(form).get('email') ?? '').trim();
		if (!email) return;

		// Placeholder mode: no creds — just acknowledge.
		if (!client) {
			status = 'done';
			return;
		}

		status = 'submitting';
		try {
			await client.followers.join({ email, source });
			rememberLocally(email);
			subscribedLocally = true;
			status = 'done';
		} catch {
			status = 'error';
		}
	}

	const doneMessage = $derived(
		enabled ? "You're subscribed — thanks!" : 'Thanks — newsletter signup is coming soon.',
	);
</script>

{#if subscribedLocally || status === 'done'}
	<p class="subscribe__done">{doneMessage}</p>
{:else}
	<form class="subscribe" onsubmit={handleSubmit}>
		<label class="biab-label" for={`${idPrefix}-email`}>{label}</label>
		<div class="subscribe__row">
			<input
				class="biab-input"
				id={`${idPrefix}-email`}
				name="email"
				type="email"
				autocomplete="email"
				placeholder={placeholder}
				required
				disabled={status === 'submitting'}
			/>
			<button class="biab-btn" type="submit" disabled={status === 'submitting'}>
				{status === 'submitting' ? 'Joining…' : buttonLabel}
			</button>
		</div>
		{#if status === 'error'}
			<p class="subscribe__error">Couldn't subscribe — please try again.</p>
		{/if}
	</form>
{/if}

<style>
	.subscribe {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		max-width: 26rem;
	}
	.subscribe__row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}
	.subscribe__row .biab-input {
		flex: 1;
	}
	.subscribe__row .biab-btn {
		white-space: nowrap;
		flex-shrink: 0;
	}
	.subscribe__done {
		color: var(--success);
		font-size: 0.9rem;
		font-weight: 600;
	}
	.subscribe__error {
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
