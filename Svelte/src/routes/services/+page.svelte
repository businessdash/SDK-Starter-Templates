<script lang="ts">
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function label(key: string): string {
		return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<svelte:head><title>Service areas</title></svelte:head>

<Header />

<main class="bd-section">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Coverage</span>
		<h1 class="bd-section__title">Services by area</h1>
		<p class="bd-section__sub">
			Programmatic pages generated from your services × service-areas in
			<code>bd.config.ts</code>. Each link is a fully SEO-rendered page.
		</p>
	</div>

	{#if data.variants.length === 0}
		<div class="bd-empty">
			No programmatic pages yet. Add services and service areas in the BD
			dashboard, publish your schema with <code>npm run sync-schema</code>, and the
			combinations will appear here.
		</div>
	{:else}
		<ul class="services-index">
			{#each data.variants as variant (`${variant.service}/${variant.area}`)}
				<li>
					<a href={`/services/${encodeURIComponent(variant.service)}/${encodeURIComponent(variant.area)}`}>
						{label(variant.service)} — {label(variant.area)}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<Footer />

<style>
	.services-index {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.75rem;
	}
	.services-index a {
		display: block;
		padding: 0.85rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		color: var(--text);
		font-weight: 600;
	}
	.services-index a:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
