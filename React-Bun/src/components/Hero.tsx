import { useEffect, useState } from "react";

import { bd } from "../lib/bd";

type HeroData = {
	title: string;
	tagline: string;
	ctaLabel: string;
	ctaHref: string;
} | null;

// [bd:!booking]
/** Without booking, the hero's button goes to the contact form. */
const CONTACT_CTA = {
	tagline: "Tell us what you need. We'll handle the rest.",
	ctaLabel: "Get in touch",
	ctaHref: "#contact",
};
// [/bd:!booking]

const HERO_DEFAULTS = {
	title: "Service that shows up — on time.",
	// [bd:!booking]
	...CONTACT_CTA,
	// [/bd:!booking]
	// [bd:booking]
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#booking",
	// [/bd:booking]
};

/**
 * Hero pulled from the marketing bundle's `hero` section. Falls
 * back to local defaults when the bundle hasn't been authored yet
 * — same pattern the DGP-2026 + UrbanAirNYC sites use.
 */
export function Hero() {
	const [hero, setHero] = useState<HeroData>(null);

	useEffect(() => {
		bd.marketing
			.getPageBundle({ pageKey: "home" })
			.then((bundle) => {
				const raw = (bundle as { sections?: Record<string, unknown> })?.sections
					?.hero;
				if (
					raw &&
					typeof raw === "object" &&
					"ok" in raw &&
					(raw as { ok: boolean }).ok
				) {
					const data = (raw as unknown as { data: Record<string, unknown> })
						.data;
					setHero({
						title: (data?.title as string) ?? HERO_DEFAULTS.title,
						tagline: (data?.tagline as string) ?? HERO_DEFAULTS.tagline,
						ctaLabel: (data?.ctaLabel as string) ?? HERO_DEFAULTS.ctaLabel,
						ctaHref: (data?.ctaHref as string) ?? HERO_DEFAULTS.ctaHref,
					});
				}
			})
			.catch(() => undefined);
	}, []);

	const display = hero ?? HERO_DEFAULTS;

	return (
		<section className="hero">
			<span className="bd-badge">Open · Mon–Sat</span>
			<h1 className="hero__title">{display.title}</h1>
			<p className="hero__sub">{display.tagline}</p>
			<a className="bd-btn" href={display.ctaHref}>
				{display.ctaLabel}
			</a>
		</section>
	);
}
