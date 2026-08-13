<script lang="ts">
	import Header from '$lib/components/biab/Header.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The platform-resolved title is "{service} in {area} | {company}";
	// show the leading clause as the H1.
	const heading = $derived(data.meta.title.split(' | ')[0]);
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description} />
	{#if data.meta.canonical}
		<link rel="canonical" href={data.meta.canonical} />
	{/if}
	{#if data.meta.ogImage}
		<meta property="og:image" content={data.meta.ogImage} />
	{/if}
</svelte:head>

<Header />

<main class="biab-section biab-section--narrow">
	<header class="service-area__head">
		<h1>{heading}</h1>
		<p>{data.meta.description}</p>
	</header>
	{#if data.body?.PageTitle}
		<section class="service-area__body biab-card">
			<h2>{data.body.PageTitle}</h2>
			{#if data.body.PageHeadline}
				<p>{data.body.PageHeadline}</p>
			{/if}
		</section>
	{/if}
	<a class="biab-btn biab-btn--ghost" href="/services">← All service areas</a>
</main>

<Footer />

<style>
	.service-area__head {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-bottom: 2rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}
	.service-area__head h1 {
		font-size: clamp(1.75rem, 4vw, 2.5rem);
	}
	.service-area__head p {
		color: var(--text-muted);
		font-size: 1.05rem;
	}
	.service-area__body {
		padding: 2rem;
		margin-bottom: 2rem;
	}
	.service-area__body h2 {
		margin-bottom: 0.75rem;
	}
</style>
