import { getBd } from "../bd";
import { html, render } from "../html";

const defaults = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#contact",
};

export async function renderHero(): Promise<string> {
	let hero = defaults;
	const bd = getBd();
	if (bd) {
		try {
			const bundle = await bd.marketing.getPageBundle({
				pageKey: "home",
				locale: "en",
			});
			const raw = (bundle as { sections?: Record<string, unknown> })?.sections
				?.["hero"];
			if (
				raw &&
				typeof raw === "object" &&
				"ok" in raw &&
				(raw as { ok: boolean }).ok
			) {
				const data = (raw as unknown as { data: Record<string, unknown> }).data;
				hero = {
					title: (data?.["title"] as string) ?? defaults.title,
					tagline: (data?.["tagline"] as string) ?? defaults.tagline,
					ctaLabel: (data?.["ctaLabel"] as string) ?? defaults.ctaLabel,
					ctaHref: (data?.["ctaHref"] as string) ?? defaults.ctaHref,
				};
			}
		} catch {
			/* keep defaults */
		}
	}
	return render(html`
		<section class="hero" id="hero">
			<span class="bd-badge">Open · Mon–Sat</span>
			<h1 class="hero__title">${hero.title}</h1>
			<p class="hero__sub">${hero.tagline}</p>
			<a class="bd-btn" href="${hero.ctaHref}">${hero.ctaLabel}</a>
		</section>
	`);
}
