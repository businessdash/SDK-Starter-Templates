import { getBd } from "./bd.server";

/**
 * Server-only section loaders. Each loader runs inside the home
 * route's Remix `loader` and returns a typed shape the section
 * component renders. Defaults render immediately when the SDK
 * isn't configured (no crash, no blank page).
 */

const heroDefaults = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#contact",
};

export async function loadHero() {
	const bd = getBd();
	if (!bd) return heroDefaults;
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
			return {
				title: (data?.["title"] as string) ?? heroDefaults.title,
				tagline: (data?.["tagline"] as string) ?? heroDefaults.tagline,
				ctaLabel: (data?.["ctaLabel"] as string) ?? heroDefaults.ctaLabel,
				ctaHref: (data?.["ctaHref"] as string) ?? heroDefaults.ctaHref,
			};
		}
	} catch {
		/* keep defaults */
	}
	return heroDefaults;
}

const aboutDefaults: Array<{ heading: string; body: string }> = [
	{
		heading: "Family-run for 12 years",
		body: "Honest pricing, the same crew every visit, and the kind of follow-up your neighbour-recommended service should have.",
	},
];

export async function loadAbout() {
	const bd = getBd();
	if (!bd) return aboutDefaults;
	try {
		const bundle = await bd.marketing.getPageBundle({
			pageKey: "home",
			locale: "en",
		});
		const raw = (bundle as { sections?: Record<string, unknown> })?.sections
			?.["about"];
		if (
			raw &&
			typeof raw === "object" &&
			"ok" in raw &&
			(raw as { ok: boolean }).ok
		) {
			const data = (
				raw as unknown as {
					data: { blocks?: Array<{ heading: string; body: string }> };
				}
			).data;
			if (Array.isArray(data?.blocks) && data.blocks.length > 0) {
				return data.blocks;
			}
		}
	} catch {
		/* keep defaults */
	}
	return aboutDefaults;
}

const servicesDefaults = [
	{
		id: "tuneup",
		name: "Annual tune-up",
		description: "Pre-season inspection + tune-up.",
		priceLabel: "from $149",
	},
	{
		id: "install",
		name: "Install",
		description: "New equipment install with a 10-year warranty.",
		priceLabel: "quote on site",
	},
	{
		id: "repair",
		name: "Repair",
		description: "Same-day repair for most makes + models.",
		priceLabel: "$95 diagnostic",
	},
];

export async function loadServices() {
	const bd = getBd();
	if (!bd) return servicesDefaults;
	try {
		// `storefront.listProducts` is the catalog read. The product ROW carries
		// id/name/images/categoryId; price + description live on the variants /
		// passthrough, so read those defensively (see DGP `bd-store.ts`).
		const list = await bd.storefront.listProducts({ limit: 6 });
		if (Array.isArray(list?.items) && list.items.length > 0) {
			return list.items.map((p) => {
				const extra = p as Record<string, unknown>;
				const priceCents =
					typeof extra["priceCents"] === "number"
						? (extra["priceCents"] as number)
						: null;
				return {
					id: p.id,
					name: p.name,
					description:
						typeof extra["description"] === "string"
							? (extra["description"] as string)
							: "",
					priceLabel:
						priceCents != null
							? `from $${(priceCents / 100).toFixed(0)}`
							: "quote on site",
				};
			});
		}
	} catch {
		/* keep defaults */
	}
	return servicesDefaults;
}

export async function loadBlog() {
	const bd = getBd();
	if (!bd) return [];
	try {
		const list = await bd.blog.listPosts({ limit: 4 });
		if (Array.isArray(list?.items)) {
			return list.items.map((p) => ({
				slug: p.slug,
				title: p.title,
				excerpt: p.excerpt ?? "",
				publishedAt: String(p.publishedAt ?? ""),
			}));
		}
	} catch {
		/* keep empty */
	}
	return [];
}

export type GalleryTile = {
	id: string;
	src: string;
	alt: string;
	title: string;
};

/**
 * Public project-media gallery. Pulls newest-first from the BD media
 * library via the `gallery` resource with typed field selection. Returns
 * `[]` when unconfigured or empty, so the section renders a placeholder.
 */
export async function loadGallery(limit = 9): Promise<GalleryTile[]> {
	const bd = getBd();
	if (!bd) return [];
	try {
		const items = await bd.gallery.list({
			limit,
			fields: ["id", "src", "alt", "title"] as const,
		});
		return items.map((it) => ({
			id: it.id,
			src: it.src,
			alt: it.alt ?? it.title ?? "",
			title: it.title ?? "",
		}));
	} catch {
		return [];
	}
}

export async function submitContact(input: {
	name: string;
	email: string;
	message: string;
}): Promise<{ ok: boolean; reason?: string }> {
	const bd = getBd();
	if (!bd) {
		console.warn("[bd] contact submission received but SDK not configured");
		return { ok: true };
	}
	try {
		// `forms.submit(slug, data, opts?)` — positional args. The data map is
		// keyed by the form's field ids as configured in the BD Forms editor.
		await bd.forms.submit("general-inquiry", {
			name: input.name,
			email: input.email,
			message: input.message,
		});
		return { ok: true };
	} catch (err) {
		console.error("[bd] forms.submit failed:", err);
		return {
			ok: false,
			reason: err instanceof Error ? err.message : "Unknown error",
		};
	}
}
