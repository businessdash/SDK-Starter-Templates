import type { PageServerLoad } from "./$types";

import { bd } from "$lib/server/bd";
import {
	fetchBundleSafe,
	getBannerFromBundle,
	readSection,
	type BundleBanner,
} from "$lib/server/bd-bundle";
import { buildHomeJsonLd } from "$lib/server/bd-seo";

/**
 * Server-side load — runs on every request and only on the server, so the
 * bearer key never enters the client bundle. We fetch every "static"
 * surface in parallel so SSR rendering blocks on whichever SDK call is
 * slowest (rarely > 200ms in practice).
 *
 * Interactive surfaces (slot computation, booking submit, contact submit,
 * cart) hit `+server.ts` endpoints under `src/routes/api/bd/` so client
 * `fetch()` never sees the bearer key.
 *
 * The bundle fetch goes through `fetchBundleSafe`, which turns the
 * billing-suspension errors into a structured `unavailable` result so the
 * page can render a minimal "site unavailable" state instead of crashing.
 */

const HERO_DEFAULTS = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#booking",
};

const ABOUT_FALLBACK =
	"We're a small team that takes pride in being available. Real schedule, real reviews, real follow-up — no automated runaround. Book a slot below or send us a note and we'll get right back to you.";

const SERVICES_FALLBACK = [
	{
		id: "f1",
		title: "Standard Service Call",
		description: "Initial visit, diagnosis, and a written estimate.",
		basePrice: 95,
		priceType: "flat",
	},
	{
		id: "f2",
		title: "Tune-up + Inspection",
		description: "Annual maintenance with a 14-point checklist.",
		basePrice: 149,
		priceType: "flat",
	},
	{
		id: "f3",
		title: "Emergency Visit",
		description: "Same-day arrival for urgent issues.",
		basePrice: 225,
		priceType: "starting",
	},
];

const FORM_SLUG = "general-inquiry";
const FORM_FALLBACK = {
	id: "fallback",
	slug: FORM_SLUG,
	title: "Get in touch",
	description: "We'll get back within one business day.",
	fields: [
		{ id: "name", label: "Name", type: "text", required: true },
		{ id: "email", label: "Email", type: "email", required: true },
		{ id: "message", label: "Message", type: "textarea", required: true },
	],
};

const GALLERY_FIELDS = ["id", "src", "title", "category", "blurDataURL"] as const;

const SITE_URL = "https://example.com";
const COMPANY_NAME = "Your Business";

export const load: PageServerLoad = async () => {
	const jsonLd = buildHomeJsonLd({
		name: COMPANY_NAME,
		siteUrl: SITE_URL,
		description: HERO_DEFAULTS.tagline,
	});

	if (!bd) {
		return {
			configured: false as const,
			unavailable: false as const,
			hero: HERO_DEFAULTS,
			about: ABOUT_FALLBACK,
			services: SERVICES_FALLBACK,
			gallery: [],
			eventTypes: [],
			blogPosts: [],
			formSchema: FORM_FALLBACK,
			formSlug: FORM_SLUG,
			banner: null as BundleBanner | null,
			jsonLd,
		};
	}

	const [bundleResult, gallery, eventTypes, blog, formSchema] = await Promise.all([
		fetchBundleSafe("home", "en"),
		bd.gallery.list({ limit: 12, fields: GALLERY_FIELDS }).catch(() => []),
		bd.scheduling.listEventTypes().catch(() => []),
		bd.blog.listPosts({ limit: 6 }).catch(() => ({ items: [] as unknown[] })),
		bd.forms.schema(FORM_SLUG).catch(() => FORM_FALLBACK),
	]);

	// Billing suspended / payment lapsed → minimal unavailable state.
	if (bundleResult.status === "unavailable") {
		return {
			configured: true as const,
			unavailable: true as const,
			reason: bundleResult.reason,
			jsonLd,
		};
	}

	const bundle = bundleResult.bundle;
	const heroSection = readSection(bundle, "hero");
	const aboutSection = readSection(bundle, "about");
	const servicesSection = readSection(bundle, "services");
	const companySection = readSection(bundle, "companyInfo");

	return {
		configured: true as const,
		unavailable: false as const,
		hero: {
			title: (heroSection?.title as string) ?? HERO_DEFAULTS.title,
			tagline: (heroSection?.tagline as string) ?? HERO_DEFAULTS.tagline,
			ctaLabel: (heroSection?.ctaLabel as string) ?? HERO_DEFAULTS.ctaLabel,
			ctaHref: (heroSection?.ctaHref as string) ?? HERO_DEFAULTS.ctaHref,
		},
		about:
			typeof aboutSection?.body === "string" ? aboutSection.body : ABOUT_FALLBACK,
		services:
			Array.isArray(servicesSection?.items) && servicesSection.items.length > 0
				? (servicesSection.items as typeof SERVICES_FALLBACK)
				: SERVICES_FALLBACK,
		gallery,
		eventTypes,
		blogPosts:
			((blog as { items?: unknown[] })?.items as Array<{
				id: string;
				slug: string;
				title: string;
				excerpt?: string | null;
				publishedAt?: string | null;
			}>) ?? [],
		formSchema,
		formSlug: FORM_SLUG,
		banner: getBannerFromBundle(bundle),
		// Prefer the bundle's company identity for JSON-LD when present.
		jsonLd: buildHomeJsonLd({
			name: (companySection?.name as string) ?? COMPANY_NAME,
			siteUrl: SITE_URL,
			description:
				(heroSection?.tagline as string) ??
				(companySection?.name as string) ??
				HERO_DEFAULTS.tagline,
			telephone: companySection?.phone as string | undefined,
			email: companySection?.email as string | undefined,
			city: companySection?.city as string | undefined,
		}),
	};
};
