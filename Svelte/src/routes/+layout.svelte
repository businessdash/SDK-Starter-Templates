<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { initBdAnalytics } from '@businessdash/sdk/analytics-core';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import SdkSetupBanner from '$lib/components/bd/SdkSetupBanner.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		if (!browser) return;
		const siteId = import.meta.env.PUBLIC_BD_SITE_ID;
		const baseUrl = import.meta.env.PUBLIC_BD_PACKAGE_API_BASE_URL;
		const apiKey = import.meta.env.PUBLIC_BD_PUBLIC_KEY;
		if (!siteId || !baseUrl || !apiKey) return;
		const tracker = initBdAnalytics({ siteId, baseUrl, apiKey });
		return () => tracker.stop();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<SdkSetupBanner />

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
