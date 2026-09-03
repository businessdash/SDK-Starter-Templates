<script lang="ts">
	import About from '$lib/components/bd/About.svelte';
	import Banner from '$lib/components/bd/Banner.svelte';
	import Blog from '$lib/components/bd/Blog.svelte';
	import Booking from '$lib/components/bd/Booking.svelte';
	import ContactForm from '$lib/components/bd/ContactForm.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import Gallery from '$lib/components/bd/Gallery.svelte';
	import Header from '$lib/components/bd/Header.svelte';
	import Hero from '$lib/components/bd/Hero.svelte';
	import Services from '$lib/components/bd/Services.svelte';

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
			<h1 class="bd-section__title" style="margin-bottom: 0.5rem;">
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
