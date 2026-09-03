import type { HeroData } from "../../lib/bd-server-fns";

export function Hero(props: { hero: HeroData }) {
	return (
		<section class="hero" id="hero">
			<span class="bd-badge">Open · Mon–Sat</span>
			<h1 class="hero__title">{props.hero.title}</h1>
			<p class="hero__sub">{props.hero.tagline}</p>
			<a class="bd-btn" href={props.hero.ctaHref}>
				{props.hero.ctaLabel}
			</a>
		</section>
	);
}
