<script lang="ts">
	import { browser } from '$app/environment';
	import type { BundleBanner } from '$lib/server/bd-bundle';

	/**
	 * Dismissible announcement bar fed by `bundle.banner`. Shows the first
	 * active message; once dismissed we remember it in localStorage by
	 * message id so it stays hidden across reloads. Renders nothing when
	 * there's no enabled banner (the unconfigured / empty case), so it's
	 * safe to mount unconditionally.
	 */
	let { banner }: { banner: BundleBanner | null } = $props();

	const message = $derived(banner?.messages?.[0] ?? null);
	const storageKey = $derived(message ? `bd_banner_dismissed_${message.id}` : '');

	let dismissed = $state(false);

	$effect(() => {
		if (browser && storageKey) {
			dismissed = localStorage.getItem(storageKey) === '1';
		}
	});

	function dismiss() {
		dismissed = true;
		if (browser && storageKey) localStorage.setItem(storageKey, '1');
	}
</script>

{#if message && !dismissed}
	<div class="bd-banner" class:bd-banner--urgent={message.urgent}>
		<span class="bd-banner__text">{message.text}</span>
		{#if message.linkUrl && message.buttonText}
			<a
				class="bd-banner__cta"
				href={message.linkUrl}
				target={message.openInNewTab ? '_blank' : undefined}
				rel={message.openInNewTab ? 'noreferrer' : undefined}
			>
				{message.buttonText}
			</a>
		{/if}
		<button class="bd-banner__close" onclick={dismiss} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.bd-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		flex-wrap: wrap;
		padding: 0.6rem 1.25rem;
		background: var(--accent);
		color: white;
		font-size: 0.9rem;
		text-align: center;
	}
	.bd-banner--urgent {
		background: var(--danger);
	}
	.bd-banner__cta {
		color: white;
		font-weight: 700;
		text-decoration: underline;
		border-bottom: none;
	}
	.bd-banner__close {
		position: absolute;
		right: 1rem;
		background: none;
		border: none;
		color: white;
		font-size: 1.2rem;
		line-height: 1;
	}
</style>
