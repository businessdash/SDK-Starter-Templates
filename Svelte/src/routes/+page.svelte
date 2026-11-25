<script lang="ts">
	import About from '#lib/components/bd/About.svelte';
	import Banner from '#lib/components/bd/Banner.svelte';
	// [bd:blog]
	import Blog from '#lib/components/bd/Blog.svelte';
	// [/bd:blog]
	// [bd:booking]
	import Booking from '#lib/components/bd/Booking.svelte';
	// [/bd:booking]
	import ContactForm from '#lib/components/bd/ContactForm.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import Gallery from '#lib/components/bd/Gallery.svelte';
	import Header from '#lib/components/bd/Header.svelte';
	import Hero from '#lib/components/bd/Hero.svelte';
	import Services from '#lib/components/bd/Services.svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<!-- Server-rendered LocalBusiness + WebSite JSON-LD (see bd-seo.ts). -->
	{@html data.jsonLd}
</svelte:head>

{#if data.unavailable}
	<Header />
	<main class="bd-section bd-section--narrow">
		<div class="bd-empty">
			<h1 class="bd-section__title" style="margin-bottom: 0.5rem;">Site temporarily unavailable</h1>
			<p>We're updating our billing and will be back shortly. Please check back soon.</p>
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
		<!-- [bd:booking] -->
		<Booking eventTypes={data.eventTypes} />
		<!-- [/bd:booking] -->
		<!-- [bd:blog] -->
		<Blog posts={data.blogPosts} />
		<!-- [/bd:blog] -->
		<ContactForm schema={data.formSchema} slug={data.formSlug} />
	</main>
	<Footer />
{/if}
