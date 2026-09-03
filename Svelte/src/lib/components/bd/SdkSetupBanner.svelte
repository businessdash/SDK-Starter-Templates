<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	/**
	 * Dismissable "not connected yet" banner. The template renders all its
	 * content with local fallbacks when BD env is missing (so it runs
	 * unconfigured) — this just tells you how to connect it. It disappears
	 * automatically once PUBLIC_BD_SITE_ID + PUBLIC_BD_PUBLIC_KEY are set,
	 * and can be dismissed for this browser in the meantime.
	 */
	const DISMISS_KEY = 'bd-sdk-setup-banner-dismissed';
	const siteId = env.PUBLIC_BD_SITE_ID;
	const pk = env.PUBLIC_BD_PUBLIC_KEY;
	const baseUrl = env.PUBLIC_BD_PACKAGE_API_BASE_URL || 'https://www.biab.app';

	let hidden = $state(true);

	onMount(() => {
		if (!browser) return;
		if (siteId && pk) return; // configured — nothing to show
		if (localStorage.getItem(DISMISS_KEY) === '1') return;
		hidden = false;
	});

	function dismiss() {
		localStorage.setItem(DISMISS_KEY, '1');
		hidden = true;
	}
</script>

{#if !hidden}
	<div class="bd-setup-banner">
		<span class="bd-setup-banner__msg">
			<strong>Not connected to BD yet.</strong>
			Add your <code>.env</code> to render live content — grab every variable (site
			ID, keys, revalidation secret) from the guided wizard.
		</span>
		<a
			class="bd-setup-banner__cta"
			href={`${baseUrl}/login?returnTo=/dashboard/settings/web-content`}
			target="_blank"
			rel="noreferrer"
		>
			Open setup wizard ↗
		</a>
		<button
			class="bd-setup-banner__close"
			type="button"
			aria-label="Dismiss"
			onclick={dismiss}
		>
			✕
		</button>
	</div>
{/if}

<style>
	.bd-setup-banner {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		z-index: 9999;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(15, 23, 42, 0.96);
		color: white;
		border-top: 1px solid rgba(45, 212, 191, 0.35);
		backdrop-filter: blur(8px);
		font-size: 0.875rem;
	}

	.bd-setup-banner__msg {
		flex: 1 1 260px;
		min-width: 0;
	}

	.bd-setup-banner__msg strong {
		color: rgb(94, 234, 212);
	}

	.bd-setup-banner__cta {
		flex-shrink: 0;
		border-radius: 0.5rem;
		border: 1px solid rgba(45, 212, 191, 0.5);
		background: rgba(45, 212, 191, 0.12);
		padding: 0.4rem 0.8rem;
		color: rgb(153, 246, 228);
		font-weight: 600;
		text-decoration: none;
	}

	.bd-setup-banner__close {
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		padding: 0.25rem;
	}
</style>
