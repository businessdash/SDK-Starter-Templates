/**
 * Server functions — TanStack Start's `createServerFn` compiles
 * these as RPC endpoints. Bodies only ever run on the server;
 * client call sites turn into transparent fetches.
 *
 * Static page data is fetched once via `getHomeData` (called from
 * the route's `loader`). Interactive surfaces (slot fetch, booking
 * confirm, form submit) each have their own server fn callable
 * from the Solid components on the client.
 */

import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
	createBiabDevClient,
	getTenantSession,
	localBusiness,
	website,
} from "@businessdash/sdk";
import { llmsTxtHandler, productFeedUrl } from "@businessdash/sdk/distribution";
import type { FormSchema as SdkFormSchema } from "@businessdash/sdk/forms";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";
import type {
	CartSnapshot,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
	ReviewWallListResponse,
	StorefrontAddon,
	StorefrontCategory,
	StorefrontListProductsResponse,
	StorefrontProductCard,
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontRelatedProduct,
	StorefrontSort,
	SubscriptionOffering,
} from "@businessdash/sdk/contracts";
import {
	renderLegalPageHtml,
	resolveLegalPage,
} from "@businessdash/sdk/legal";
import {
	buildSitemap,
	minimalSitemapXml,
} from "@businessdash/sdk/sitemap";
import { createServerFn } from "@tanstack/solid-start";
import {
	getCookie,
	getRequestHeader,
	setCookie,
} from "@tanstack/solid-start/server";

import {
	type BundleBanner,
	type BundleReviews,
	type BundleUpdateItem,
	biabRawConfig,
	devwarn,
	getBannerFromBundle,
	getBiab,
	getBundle,
	getReviewsFromBundle,
	getUpdatesFromBundle,
} from "./biab";
import { getDistributionConfig } from "./biab-distribution";
import { listTodosWithImages, type TodosResult } from "./biab-todos";
import { TODO_FORM_SLUG } from "../../biab.data-model.config";

export type HeroData = {
	title: string;
	tagline: string;
	ctaLabel: string;
	ctaHref: string;
};

export type Service = {
	id: string;
	title: string;
	description: string;
	basePrice?: number;
	priceType?: string;
};

export type GalleryItem = {
	id: string;
	src?: string | null;
	title?: string | null;
	category?: string | null;
	blurDataURL?: string | null;
};

export type EventType = {
	id: string;
	name: string;
	slug: string;
	durationMinutes: number;
};

export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	excerpt?: string | null;
	publishedAt?: string | null;
};

export type FieldDef = {
	id: string;
	label: string;
	type: string;
	required: boolean;
	placeholder?: string;
	helpText?: string;
};

export type FormSchema = {
	id: string;
	slug: string;
	title?: string;
	description?: string | null;
	fields: FieldDef[];
};

export type HomeData = {
	hero: HeroData;
	about: string;
	services: Service[];
	gallery: GalleryItem[];
	eventTypes: EventType[];
	blogPosts: BlogPost[];
	formSchema: FormSchema;
	formSlug: string;
};

const HERO_DEFAULTS: HeroData = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#booking",
};

const ABOUT_FALLBACK =
	"We're a small team that takes pride in being available. Real schedule, real reviews, real follow-up — no automated runaround. Book a slot below or send us a note and we'll get right back to you.";

const SERVICES_FALLBACK: Service[] = [
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

const FORM_FALLBACK: FormSchema = {
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

const GALLERY_FIELDS = [
	"id",
	"src",
	"title",
	"category",
	"blurDataURL",
] as const;

/**
 * One round-trip fans five SDK calls into a single `Promise.all`.
 * Called from the route's `loader` so the home page renders with
 * everything resolved.
 */
export const getHomeData = createServerFn({ method: "GET" }).handler(
	async (): Promise<HomeData> => {
		const biab = getBiab();
		if (!biab) {
			return {
				hero: HERO_DEFAULTS,
				about: ABOUT_FALLBACK,
				services: SERVICES_FALLBACK,
				gallery: [],
				eventTypes: [],
				blogPosts: [],
				formSchema: FORM_FALLBACK,
				formSlug: FORM_SLUG,
			};
		}

		const [bundle, gallery, eventTypes, blog, formSchema] = await Promise.all([
			biab.marketing
				.getPageBundle({ pageKey: "home", locale: "en" })
				.catch(() => null),
			biab.gallery
				.list({ limit: 12, fields: GALLERY_FIELDS })
				.catch(() => []) as Promise<GalleryItem[]>,
			biab.scheduling.listEventTypes().catch(() => []) as Promise<EventType[]>,
			biab.blog
				.listPosts({ limit: 6 })
				.catch(() => ({ items: [] as BlogPost[] })),
			biab.forms.schema(FORM_SLUG).catch(() => FORM_FALLBACK),
		]);

		function readSection(name: string): Record<string, unknown> | null {
			const raw = (bundle as { sections?: Record<string, unknown> })
				?.sections?.[name];
			if (
				raw &&
				typeof raw === "object" &&
				"ok" in raw &&
				(raw as { ok: boolean }).ok
			) {
				return (raw as unknown as { data: Record<string, unknown> }).data;
			}
			return null;
		}

		const heroSection = readSection("hero");
		const aboutSection = readSection("about");
		const servicesSection = readSection("services");

		return {
			hero: {
				title: (heroSection?.title as string) ?? HERO_DEFAULTS.title,
				tagline: (heroSection?.tagline as string) ?? HERO_DEFAULTS.tagline,
				ctaLabel: (heroSection?.ctaLabel as string) ?? HERO_DEFAULTS.ctaLabel,
				ctaHref: (heroSection?.ctaHref as string) ?? HERO_DEFAULTS.ctaHref,
			},
			about:
				typeof aboutSection?.body === "string"
					? aboutSection.body
					: ABOUT_FALLBACK,
			services:
				Array.isArray(servicesSection?.items) &&
				(servicesSection.items as Service[]).length > 0
					? (servicesSection.items as Service[])
					: SERVICES_FALLBACK,
			gallery,
			eventTypes,
			blogPosts: ((blog as { items?: BlogPost[] })?.items as BlogPost[]) ?? [],
			formSchema,
			formSlug: FORM_SLUG,
		};
	},
);

/**
 * Resolve a legal page for the catch-all route.
 *
 * Returns `{ found: false }` rather than throwing: the ROUTE decides what a
 * missing document means, and this runs on every unmatched URL — a throw here
 * would take down paths that have nothing to do with legal pages.
 */
export const getLegalPage = createServerFn({ method: "GET" })
	.validator((data: { slug: string }) => data)
	.handler(async ({ data }) => {
		const biab = getBiab();
		if (!biab) return { found: false as const };
		const document = await resolveLegalPage({ client: biab, slug: data.slug });
		if (!document) return { found: false as const };
		return {
			found: true as const,
			title: document.title,
			html: renderLegalPageHtml(document),
		};
	});

export const fetchSlots = createServerFn({ method: "GET" })
	.validator((data: { slug: string; from: string; to: string }) => data)
	.handler(async ({ data }) => {
		const biab = getBiab();
		if (!biab) throw new Error("BIAB not configured. See .env.example.");
		return await biab.scheduling.getAvailableSlots(data.slug, {
			from: new Date(data.from),
			to: new Date(data.to),
		});
	});

export const confirmBooking = createServerFn({ method: "POST" })
	.validator(
		(data: {
			eventTypeSlug: string;
			startAt: string;
			invitee: {
				email: string;
				name: string;
				phone: string | null;
				timezone: string;
			};
			notes: string | null;
		}) => data,
	)
	.handler(async ({ data }) => {
		const biab = getBiab();
		if (!biab) throw new Error("BIAB not configured.");
		return await biab.scheduling.confirmBooking({
			eventTypeSlug: data.eventTypeSlug,
			startAt: new Date(data.startAt),
			invitee: data.invitee,
			notes: data.notes,
		});
	});

export const submitContactForm = createServerFn({ method: "POST" })
	.validator((data: { slug: string; values: Record<string, unknown> }) => data)
	.handler(async ({ data }) => {
		const biab = getBiab();
		if (!biab) throw new Error("BIAB not configured.");
		return await biab.forms.submit(data.slug, data.values, {
			submitterEmail: (data.values.email as string | undefined) ?? undefined,
			submitterName: (data.values.name as string | undefined) ?? undefined,
		});
	});

/* ────────────────────────────────────────────────────────────────────
 * Suspension handling
 *
 * Billing-lapsed / service-suspended orgs throw a typed error from any
 * bundle/store read. We catch it at each surface and surface a minimal
 * "site unavailable" state instead of a stack trace. Both errors extend
 * `BiabAccessRejectedError`.
 * ──────────────────────────────────────────────────────────────────── */

export function isSuspensionError(err: unknown): boolean {
	return (
		err instanceof BiabPaymentLapsedError ||
		err instanceof BiabServiceSuspendedError
	);
}

/* ────────────────────────────────────────────────────────────────────
 * Storefront — product list + detail
 * ──────────────────────────────────────────────────────────────────── */

export type StoreListResult =
	| { ok: true; products: StorefrontListProductsResponse["items"] }
	| { ok: false; reason: "unconfigured" | "suspended" | "error" };

export const getStoreProducts = createServerFn({ method: "GET" }).handler(
	async (): Promise<StoreListResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, reason: "unconfigured" };
		try {
			const res = await biab.storefront.listProducts({ limit: 24 });
			return { ok: true, products: res.items };
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("storefront.listProducts", err);
			return { ok: false, reason: "error" };
		}
	},
);

export type StoreProductResult =
	| { ok: true; product: StorefrontProductDetail }
	| { ok: false; reason: "unconfigured" | "suspended" | "notfound" };

export const getStoreProduct = createServerFn({ method: "GET" })
	.validator((data: { id: string }) => data)
	.handler(async ({ data }): Promise<StoreProductResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, reason: "unconfigured" };
		try {
			const product = await biab.storefront.getProduct(data.id);
			return { ok: true, product };
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("storefront.getProduct", err);
			return { ok: false, reason: "notfound" };
		}
	});

/* ────────────────────────────────────────────────────────────────────
 * Storefront — filterable listing grid (listProductsWithMeta + facets)
 *
 * `listProductsWithMeta` returns enriched per-card price/ratings/badges
 * plus `categoryCounts` and the catalog-wide `priceRange` for a sidebar.
 * `categoryCounts` carries ids only, so we pair it with `listCategories`
 * to label the facet list. Both calls are folded into one round-trip.
 * ──────────────────────────────────────────────────────────────────── */

export type StoreFilters = {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: StorefrontSort;
};

export type StoreListingResult =
	| {
			ok: true;
			items: StorefrontProductCard[];
			categories: StorefrontCategory[];
			categoryCounts: Array<{ categoryId: string; count: number }>;
			priceRange: { minDollars: number; maxDollars: number };
	  }
	| { ok: false; reason: "unconfigured" | "suspended" | "error" };

const STORE_LISTING_LIMIT = 48;

export const getStoreListing = createServerFn({ method: "GET" })
	.validator((data: StoreFilters) => data)
	.handler(async ({ data }): Promise<StoreListingResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, reason: "unconfigured" };
		try {
			const [meta, categories] = await Promise.all([
				biab.storefront.listProductsWithMeta({
					limit: STORE_LISTING_LIMIT,
					...(data.search ? { search: data.search } : {}),
					...(data.categoryId ? { categoryId: data.categoryId } : {}),
					...(data.minPriceCents != null
						? { minPriceCents: data.minPriceCents }
						: {}),
					...(data.maxPriceCents != null
						? { maxPriceCents: data.maxPriceCents }
						: {}),
					...(data.minRating != null ? { minRating: data.minRating } : {}),
					...(data.sort ? { sort: data.sort } : {}),
				}),
				biab.storefront.listCategories().catch((err) => {
					devwarn("storefront.listCategories", err);
					return { items: [] as StorefrontCategory[] };
				}),
			]);
			return {
				ok: true,
				items: meta.items,
				categories: categories.items,
				categoryCounts: meta.categoryCounts,
				priceRange: meta.priceRange,
			};
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("storefront.listProductsWithMeta", err);
			return { ok: false, reason: "error" };
		}
	});

/* ────────────────────────────────────────────────────────────────────
 * Storefront — product detail enrichment (reviews + related + addons)
 *
 * Folded into one round-trip from the detail loader. Each call degrades
 * to an empty shape so a missing/older endpoint just hides its section.
 * ──────────────────────────────────────────────────────────────────── */

export type StoreProductExtras = {
	reviews: StorefrontProductReviewsResponse | null;
	related: StorefrontRelatedProduct[];
	addons: StorefrontAddon[];
};

export const getStoreProductExtras = createServerFn({ method: "GET" })
	.validator((data: { id: string }) => data)
	.handler(async ({ data }): Promise<StoreProductExtras> => {
		const biab = getBiab();
		if (!biab) return { reviews: null, related: [], addons: [] };
		const [reviews, related, addons] = await Promise.all([
			biab.storefront.getProductReviews(data.id, { limit: 20 }).catch((err) => {
				devwarn("storefront.getProductReviews", err);
				return null;
			}),
			biab.storefront
				.getRelatedProducts(data.id, { limit: 6 })
				.then((res) => res.items)
				.catch((err) => {
					devwarn("storefront.getRelatedProducts", err);
					return [] as StorefrontRelatedProduct[];
				}),
			biab.storefront
				.getProductAddons(data.id)
				.then((res) => res.items)
				.catch((err) => {
					devwarn("storefront.getProductAddons", err);
					return [] as StorefrontAddon[];
				}),
		]);
		return { reviews, related, addons };
	});

/* ────────────────────────────────────────────────────────────────────
 * Cart — visitor-token pattern
 *
 * The shopper is identified by a UUID we own, stored in an httpOnly
 * cookie (`biab_cart_visitor`). Reads use the token if present; the
 * first mutation mints + sets it. `getCookie`/`setCookie` resolve the
 * active request context — valid inside `createServerFn` handlers.
 * ──────────────────────────────────────────────────────────────────── */

const VISITOR_COOKIE = "biab_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Read-only: current visitor token, or null if none minted yet. */
function readVisitorToken(): string | null {
	return getCookie(VISITOR_COOKIE) ?? null;
}

/** Mutation path: return the token, minting + setting the cookie on first use. */
function ensureVisitorToken(): string {
	const existing = readVisitorToken();
	if (existing) return existing;
	const token = crypto.randomUUID();
	setCookie(VISITOR_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: VISITOR_MAX_AGE,
	});
	return token;
}

export type CartResult =
	| { ok: true; snapshot: CartSnapshot }
	| { ok: false; error: string };

function cartErr(err: unknown): CartResult {
	return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

/** Read the current cart, or null when unconfigured / no cart yet (no token). */
export const getCart = createServerFn({ method: "GET" }).handler(
	async (): Promise<CartSnapshot | null> => {
		const biab = getBiab();
		if (!biab) return null;
		const token = readVisitorToken();
		if (!token) return null;
		try {
			return await biab.cart.forVisitor(token).get();
		} catch (err) {
			devwarn("cart.get", err);
			return null;
		}
	},
);

export const addToCart = createServerFn({ method: "POST" })
	.validator(
		(data: { productId: string; variantId?: string; quantity?: number }) =>
			data,
	)
	.handler(async ({ data }): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart
				.forVisitor(ensureVisitorToken())
				.addItem({
					productId: data.productId,
					variantId: data.variantId,
					quantity: data.quantity ?? 1,
				});
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	});

export const updateCartItem = createServerFn({ method: "POST" })
	.validator((data: { itemId: string; quantity: number }) => data)
	.handler(async ({ data }): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart
				.forVisitor(ensureVisitorToken())
				.updateItem(data.itemId, { quantity: data.quantity });
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	});

export const removeCartItem = createServerFn({ method: "POST" })
	.validator((data: { itemId: string }) => data)
	.handler(async ({ data }): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart
				.forVisitor(ensureVisitorToken())
				.removeItem(data.itemId);
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	});

export const applyCartCoupon = createServerFn({ method: "POST" })
	.validator((data: { code: string }) => data)
	.handler(async ({ data }): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart
				.forVisitor(ensureVisitorToken())
				.applyCoupon({ code: data.code });
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	});

export const removeCartCoupon = createServerFn({ method: "POST" }).handler(
	async (): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart
				.forVisitor(ensureVisitorToken())
				.removeCoupon();
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	},
);

export const clearCart = createServerFn({ method: "POST" }).handler(
	async (): Promise<CartResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, error: "Store isn't connected." };
		try {
			const snapshot = await biab.cart.forVisitor(ensureVisitorToken()).clear();
			return { ok: true, snapshot };
		} catch (err) {
			return cartErr(err);
		}
	},
);

/** Start Stripe-hosted checkout for the visitor's cart; returns the URL to
 *  redirect to. `origin` is the browser's `window.location.origin` so the
 *  success/cancel URLs land back on this site. */
export const startCheckout = createServerFn({ method: "POST" })
	.validator((data: { origin: string }) => data)
	.handler(
		async ({
			data,
		}): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
			const biab = getBiab();
			if (!biab) return { ok: false, error: "Store isn't connected." };
			const token = readVisitorToken();
			if (!token) return { ok: false, error: "Your cart is empty." };
			try {
				const res = await biab.checkout.forVisitor(token).start({
					successUrl: `${data.origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${data.origin}/store/cart`,
				});
				return { ok: true, url: res.stripeUrl };
			} catch (err) {
				return cartErr(err);
			}
		},
	);

/* ────────────────────────────────────────────────────────────────────
 * Subscriptions
 * ──────────────────────────────────────────────────────────────────── */

export type SubscriptionsResult =
	| { ok: true; items: SubscriptionOffering[] }
	| { ok: false; reason: "unconfigured" | "suspended" | "error" };

export const getSubscriptions = createServerFn({ method: "GET" }).handler(
	async (): Promise<SubscriptionsResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, reason: "unconfigured" };
		try {
			const res = await biab.subscriptions.list();
			return { ok: true, items: res.items };
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("subscriptions.list", err);
			return { ok: false, reason: "error" };
		}
	},
);

/** Start a Stripe-hosted subscription checkout; returns the URL to redirect to. */
export const startSubscriptionCheckout = createServerFn({ method: "POST" })
	.validator((data: { id: string; origin: string }) => data)
	.handler(
		async ({
			data,
		}): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
			const biab = getBiab();
			if (!biab) return { ok: false, error: "Store isn't connected." };
			try {
				const res = await biab.subscriptions.startCheckout(data.id, {
					successUrl: `${data.origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${data.origin}/subscriptions`,
				});
				return { ok: true, url: res.stripeUrl };
			} catch (err) {
				return cartErr(err);
			}
		},
	);

/* ────────────────────────────────────────────────────────────────────
 * Reviews wall — aggregate (off bundle) + paginated page (reviews.list)
 * ──────────────────────────────────────────────────────────────────── */

export type ReviewsWallData = {
	aggregate: BundleReviews | null;
	page: ReviewWallListResponse | null;
};

const REVIEWS_PAGE_SIZE = 8;

/** First load: aggregate (count / average) off the bundle + the first page
 *  of wall items. Both null when BIAB isn't configured. */
export const getReviewsWall = createServerFn({ method: "GET" }).handler(
	async (): Promise<ReviewsWallData> => {
		const biab = getBiab();
		if (!biab) return { aggregate: null, page: null };
		const [bundle, page] = await Promise.all([
			getBundle("home"),
			biab.reviews.list({ limit: REVIEWS_PAGE_SIZE }).catch((err) => {
				devwarn("reviews.list", err);
				return null;
			}),
		]);
		return { aggregate: getReviewsFromBundle(bundle), page };
	},
);

/** "Load more": one deeper page of wall items. `null` stops pagination. */
export const fetchReviewsPage = createServerFn({ method: "GET" })
	.validator((data: { offset: number }) => data)
	.handler(async ({ data }): Promise<ReviewWallListResponse | null> => {
		const biab = getBiab();
		if (!biab) return null;
		try {
			return await biab.reviews.list({
				limit: REVIEWS_PAGE_SIZE,
				offset: data.offset,
			});
		} catch (err) {
			devwarn("reviews.list(page)", err);
			return null;
		}
	});

/* ────────────────────────────────────────────────────────────────────
 * News banner + updates feed (both ride the marketing bundle)
 * ──────────────────────────────────────────────────────────────────── */

export type SiteContentExtras = {
	banner: BundleBanner | null;
	updates: BundleUpdateItem[];
};

/** Banner + updates for the dismissible bar and the /updates feed. Empty
 *  shapes when unconfigured or unseeded — both surfaces no-op gracefully. */
export const getSiteContentExtras = createServerFn({ method: "GET" }).handler(
	async (): Promise<SiteContentExtras> => {
		const bundle = await getBundle("home");
		return {
			banner: getBannerFromBundle(bundle),
			updates: getUpdatesFromBundle(bundle),
		};
	},
);

/* ────────────────────────────────────────────────────────────────────
 * Customer portal — session (biab_session) + work bundle + review submit
 *
 * Customer identity is WorkOS-backed BIAB auth: the `/api/biab-auth/*`
 * handler mints a `biab_session` httpOnly cookie. Portal calls run as
 * `customerPortal(org).withSession(token)` — the site key + session token
 * are the whole auth surface; the org comes from the validated session.
 * ──────────────────────────────────────────────────────────────────── */

const SESSION_COOKIE = "biab_session";

export type CustomerSession = {
	token: string;
	organizationId: string;
	user: {
		id: string;
		email: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	role: string | null;
};

/** Read + validate the `biab_session` cookie. `null` when signed out or
 *  unconfigured. Server-only — `getTenantSession` uses the secret key. */
async function readCustomerSession(): Promise<CustomerSession | null> {
	const cfg = biabRawConfig();
	if (!cfg) return null;
	const token = getCookie(SESSION_COOKIE) ?? null;
	if (!token) return null;
	const session = await getTenantSession({
		cookieValue: token,
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
	}).catch((err) => {
		devwarn("getTenantSession", err);
		return null;
	});
	if (!session) return null;
	return {
		token,
		organizationId: session.organizationId,
		user: session.user,
		role: session.role,
	};
}

/** Session-scoped customer-portal client for an already-validated session. */
function portalFor(session: CustomerSession) {
	const cfg = biabRawConfig();
	if (!cfg) throw new Error("Customer portal isn't configured.");
	return createBiabDevClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })
		.customerPortal(session.organizationId)
		.withSession(session.token);
}

export type MyAccountData = {
	configured: boolean;
	session: {
		email: string | null;
		firstName: string | null;
		lastName: string | null;
		role: string | null;
	} | null;
	work: CustomerWorkBundle | null;
};

/** Everything the /my-account loader needs: configured flag, the signed-in
 *  user (or null), and their work bundle (jobs / quotes / invoices). */
export const getMyAccount = createServerFn({ method: "GET" }).handler(
	async (): Promise<MyAccountData> => {
		const cfg = biabRawConfig();
		const configured = cfg !== null && !!process.env.BIAB_AUTH_CALLBACK_URL;
		const session = await readCustomerSession();
		if (!session) return { configured, session: null, work: null };
		let work: CustomerWorkBundle | null = null;
		try {
			work = await portalFor(session).getWork();
		} catch (err) {
			devwarn("customerPortal.getWork", err);
		}
		return {
			configured,
			session: {
				email: session.user.email,
				firstName: session.user.firstName,
				lastName: session.user.lastName,
				role: session.role,
			},
			work,
		};
	},
);

export type ReviewSubmitResult =
	| { ok: true; status: string }
	| { ok: false; error: string };

/** Submit a review as the signed-in customer. Lands as `pending` until
 *  staff moderates. Requires a valid `biab_session`. */
export const submitCustomerReview = createServerFn({ method: "POST" })
	.validator(
		(data: { rating: number; title?: string; body: string; jobId?: string }) =>
			data,
	)
	.handler(async ({ data }): Promise<ReviewSubmitResult> => {
		const session = await readCustomerSession();
		if (!session) {
			return { ok: false, error: "Please sign in to leave a review." };
		}
		const rating = Math.max(1, Math.min(5, Math.round(data.rating)));
		const body = data.body.trim();
		if (!body) return { ok: false, error: "Please write a few words." };
		try {
			const res: CustomerReviewSubmitResponse = await portalFor(
				session,
			).submitReview({
				rating,
				body,
				title: data.title?.trim() || undefined,
				jobId: data.jobId || undefined,
			});
			return { ok: true, status: res.status ?? "pending" };
		} catch (err) {
			devwarn("customerPortal.submitReview", err);
			return {
				ok: false,
				error: "We couldn't submit your review. Please try again.",
			};
		}
	});

/* ────────────────────────────────────────────────────────────────────
 * Parallel pages (programmatic SEO) — /services/[service]/[area]
 * ──────────────────────────────────────────────────────────────────── */

const PARALLEL_KEY = "service-area";

export type ParallelVariant = { service: string; area: string };

/** List every (service × area) variant for the index page + link list. */
export const listServiceAreaVariants = createServerFn({
	method: "GET",
}).handler(async (): Promise<ParallelVariant[]> => {
	const biab = getBiab();
	if (!biab) return [];
	try {
		const { variants } = await biab.parallelPages.listVariants(PARALLEL_KEY);
		return variants.map((v) => ({
			service: v.service ?? "",
			area: v.area ?? "",
		}));
	} catch (err) {
		devwarn("parallelPages.listVariants", err);
		return [];
	}
});

export type ParallelPageResult =
	| {
			ok: true;
			meta: { title: string; description: string; canonical: string | null };
			body: unknown;
	  }
	| { ok: false; reason: "unconfigured" | "suspended" | "notfound" };

/** Render one (service, area) variant: resolved meta + body. */
export const renderServiceAreaPage = createServerFn({ method: "GET" })
	.validator((data: { service: string; area: string }) => data)
	.handler(async ({ data }): Promise<ParallelPageResult> => {
		const biab = getBiab();
		if (!biab) return { ok: false, reason: "unconfigured" };
		try {
			const res = await biab.parallelPages.render(PARALLEL_KEY, {
				service: data.service,
				area: data.area,
			});
			return {
				ok: true,
				meta: {
					title: res.meta.title,
					description: res.meta.description,
					canonical: res.meta.canonical,
				},
				body: res.body,
			};
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("parallelPages.render", err);
			return { ok: false, reason: "notfound" };
		}
	});

/* ────────────────────────────────────────────────────────────────────
 * SEO — server-rendered JSON-LD (localBusiness + website)
 *
 * Built server-side from the bundle's company profile (with safe local
 * fallbacks) and injected into the document head as a <script> string.
 * ──────────────────────────────────────────────────────────────────── */

function siteOrigin(): string {
	const host = getRequestHeader("host");
	if (!host) return "https://example.com";
	const proto = getRequestHeader("x-forwarded-proto") ?? "https";
	return `${proto}://${host}`;
}

/** The JSON-LD graph (localBusiness + website) as a JSON string, ready to
 *  drop into a `<script type="application/ld+json">` in the route head.
 *  Built from the bundle's company profile with safe local fallbacks. */
export const getHomeJsonLd = createServerFn({ method: "GET" }).handler(
	async (): Promise<string> => {
		const bundle = await getBundle("home");
		const origin = siteOrigin();
		const company =
			(bundle as { company?: { profile?: Record<string, unknown> } } | null)
				?.company?.profile ?? null;
		const name = (company?.name as string | undefined) ?? "Your Business";
		const description =
			(company?.description as string | undefined) ??
			"A small business powered by Business in a Box.";
		const nodes = [
			localBusiness({
				siteUrl: origin,
				name,
				description,
				telephone: (company?.phone as string | undefined) ?? undefined,
				email: (company?.email as string | undefined) ?? undefined,
			}),
			website({ siteUrl: origin, name, description }),
		];
		return JSON.stringify(nodes);
	},
);

/* ────────────────────────────────────────────────────────────────────
 * SEO proxies — sitemap.xml + robots.txt
 *
 * BIAB auto-generates both (enumerates parallel-page URLs, swaps to an
 * empty/Disallow body when billing is fully suspended). We proxy through.
 * `parallelPages.sitemapUrl()` / `.robotsUrl()` return paths relative to
 * the base URL; resolve them and forward the upstream body + status.
 * ──────────────────────────────────────────────────────────────────── */

const ROBOTS_FALLBACK = "User-agent: *\nAllow: /\n";

async function proxyBiabEndpoint(
	relativePath: string,
	fallbackBody: string,
	contentType: string,
): Promise<Response> {
	const cfg = biabRawConfig();
	if (!cfg) {
		return new Response(fallbackBody, {
			status: 200,
			headers: { "Content-Type": contentType },
		});
	}
	const url = `${cfg.baseUrl}/${relativePath.replace(/^\//, "")}`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!res.ok) {
			return new Response(fallbackBody, {
				status: 200,
				headers: { "Content-Type": contentType },
			});
		}
		const body = await res.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch (err) {
		devwarn(`proxy ${relativePath}`, err);
		return new Response(fallbackBody, {
			status: 200,
			headers: { "Content-Type": contentType },
		});
	}
}

/** Proxy BIAB's auto-generated sitemap.xml (Response). */
/**
 * Pages that live in THIS repo. Keep in step with `src/routes/`.
 *
 * The platform cannot know these exist, so they are declared by hand.
 */
const SITEMAP_STATIC_PATHS = [
	"/",
	"/about",
	"/services",
	"/reviews",
	"/updates",
	"/store",
	"/todos",
	"/subscriptions",
];

/**
 * Build the sitemap from three sources: the pages above, what BusinessDash
 * owns the shape of (site pages, legal documents, programmatic pages), and
 * platform content mapped onto THIS app's routes.
 *
 * Everything in `routes` is opt-in — delete a line and those URLs vanish, which
 * is right for a business without that surface. A missing URL costs one page's
 * indexing; a sitemap full of 404s costs trust in every URL in the file. The
 * customer portal and other token-gated paths are excluded automatically.
 */
export async function buildSitemapResponse(request: Request): Promise<Response> {
	const baseUrl = new URL(request.url).origin;
	const biab = getBiab();

	// Unconfigured: one honest URL rather than an empty <urlset>, which would
	// affirmatively tell crawlers the site has no pages.
	const xml = biab
		? await buildSitemap({
				client: biab,
				siteId: biabRawConfig()?.siteId ?? "",
				baseUrl,
				staticPaths: SITEMAP_STATIC_PATHS,
				routes: { blog: "/updates", product: "/store" },
				onSkip: (section, reason) =>
					console.info(`[sitemap] skipped ${section}: ${reason}`),
			})
		: minimalSitemapXml(baseUrl);

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
}

/** Proxy BIAB's auto-generated robots.txt (Response). */
export async function buildRobotsResponse(): Promise<Response> {
	const biab = getBiab();
	const path = biab
		? biab.parallelPages.robotsUrl()
		: `sites/${biabRawConfig()?.siteId ?? ""}/robots.txt`;
	return proxyBiabEndpoint(path, ROBOTS_FALLBACK, "text/plain; charset=utf-8");
}

/* ────────────────────────────────────────────────────────────────────
 * AEO + MCP proxies (SDK 0.9.53)
 *
 * `/llms.txt` — the answer-engine index curated at BIAB → Marketing →
 * AI Distribution, served from this site's own root (the only place the
 * llms.txt convention works). `/api/mcp` + `/.well-known/mcp.json` — the
 * site's MCP connector on THIS domain, so the URL an org hands to Claude /
 * ChatGPT / Gemini is their own site; the platform still enforces the org's
 * MCP opt-in and per-tool write gates. `/ai/product-feed` — a convenience
 * redirect to the product feed's BIAB URL (submit that URL to merchant
 * programs directly). Plain server functions, called from route handlers
 * like `buildRobotsResponse` above.
 * ──────────────────────────────────────────────────────────────────── */

export async function buildLlmsTxtResponse(): Promise<Response> {
	const config = getDistributionConfig();
	if (!config) return new Response("Not found", { status: 404 });
	return llmsTxtHandler(config)();
}

export async function buildMcpPostResponse(request: Request): Promise<Response> {
	const config = getDistributionConfig();
	if (!config) {
		return Response.json(
			{
				jsonrpc: "2.0",
				id: null,
				error: { code: -32603, message: "BIAB is not configured." },
			},
			{ status: 503 },
		);
	}
	return mcpHandler(config).POST(request);
}

export async function buildMcpGetResponse(): Promise<Response> {
	return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function buildMcpManifestResponse(
	request: Request,
): Promise<Response> {
	const config = getDistributionConfig();
	if (!config) return Response.json({ error: "not_configured" }, { status: 404 });
	return mcpManifestHandler(config)(request);
}

export async function buildProductFeedRedirectResponse(): Promise<Response> {
	const config = getDistributionConfig();
	if (!config) return new Response("Not found", { status: 404 });
	return new Response(null, {
		status: 307,
		headers: { Location: productFeedUrl(config) },
	});
}

/* ────────────────────────────────────────────────────────────────────
 * Custom-collections demo (todos + todoImages)
 *
 * READ: `dataModel.listRecords` (join in `lib/biab-todos.ts`). WRITE: the
 * generated `todo-form` — custom-collection rows are created by submitting
 * the form's `create_records` action; there is no direct row-write API for
 * consumers. The form schema is `null` until the model is promoted and
 * "Todo Form" is set Live — the page shows a setup notice instead.
 * ──────────────────────────────────────────────────────────────────── */

export type TodosData = {
	result: TodosResult;
	formSchema: SdkFormSchema | null;
	formSlug: string;
};

export const getTodosData = createServerFn({ method: "GET" }).handler(
	async (): Promise<TodosData> => {
		const biab = getBiab();
		const [result, formSchema] = await Promise.all([
			listTodosWithImages(),
			biab
				? (biab.forms
						.schema(TODO_FORM_SLUG)
						.catch(() => null) as Promise<SdkFormSchema | null>)
				: Promise.resolve(null),
		]);
		return { result, formSchema, formSlug: TODO_FORM_SLUG };
	},
);

export const submitTodoForm = createServerFn({ method: "POST" })
	.validator((data: { values: Record<string, unknown> }) => data)
	.handler(async ({ data }) => {
		const biab = getBiab();
		if (!biab) throw new Error("BIAB not configured.");
		return await biab.forms.submit(TODO_FORM_SLUG, data.values, {
			source: "tanstack-start-starter",
		});
	});
