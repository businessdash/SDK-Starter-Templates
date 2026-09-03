import { component$ } from "@builder.io/qwik";

export interface HeroData {
	title: string;
	tagline: string;
	ctaLabel: string;
	ctaHref: string;
}

export const Hero = component$<{ hero: HeroData }>(({ hero }) => {
	return (
		<section class="hero" id="hero">
			<span class="bd-badge">Open · Mon–Sat</span>
			<h1 class="hero__title">{hero.title}</h1>
			<p class="hero__sub">{hero.tagline}</p>
			<a class="bd-btn" href={hero.ctaHref}>
				{hero.ctaLabel}
			</a>
		</section>
	);
});
