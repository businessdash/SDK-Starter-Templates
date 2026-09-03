<script lang="ts">
	let {
		hero,
	}: {
		hero: {
			title: string;
			tagline: string;
			ctaLabel: string;
			ctaHref: string;
		};
	} = $props();
</script>

<section class="hero" id="hero">
	<span class="bd-badge">Open · Mon–Sat</span>
	<h1 class="hero__title">{hero.title}</h1>
	<p class="hero__sub">{hero.tagline}</p>
	<a class="bd-btn" href={hero.ctaHref}>{hero.ctaLabel}</a>
</section>
