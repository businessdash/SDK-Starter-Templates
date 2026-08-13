<script lang="ts">
	import About from '$lib/components/biab/About.svelte';
	import Banner from '$lib/components/biab/Banner.svelte';
	import Blog from '$lib/components/biab/Blog.svelte';
	import Booking from '$lib/components/biab/Booking.svelte';
	import ContactForm from '$lib/components/biab/ContactForm.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import Gallery from '$lib/components/biab/Gallery.svelte';
	import Header from '$lib/components/biab/Header.svelte';
	import Hero from '$lib/components/biab/Hero.svelte';
	import Services from '$lib/components/biab/Services.svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<!-- Server-rendered LocalBusiness + WebSite JSON-LD (see biab-seo.ts). -->
	{@html data.jsonLd}
</svelte:head>

{#if data.unavailable}
	<Header />
	<main class="biab-section biab-section--narrow">
		<div class="biab-empty">
			<h1 class="biab-section__title" style="margin-bottom: 0.5rem;">
				Site temporarily unavailable
			</h1>
			<p>
				We're updating our billing and will be back shortly. Please check back
				soon.
			</p>
		</div>
	</main>
	<Footer />
{:else}
	<Banner banner={data.banner} />
	<Header />
	<main>
		<Hero hero={data.hero} />
		<About body={data.about} />
		<Services services={data.services} />
		<Gallery items={data.gallery} />
		<Booking eventTypes={data.eventTypes} />
		<Blog posts={data.blogPosts} />
		<ContactForm schema={data.formSchema} slug={data.formSlug} />
	</main>
	<Footer />
{/if}
