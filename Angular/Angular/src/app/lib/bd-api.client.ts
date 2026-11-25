/**
 * Browser → local-server API client.
 *
 * The Angular browser bundle never holds the BD API key. Instead it
 * fetches the small JSON endpoints the SSR Express server exposes (see
 * `src/server/bd-api.ts`). Those endpoints are the only place the key
 * lives. During SSR these same fetches resolve same-origin; in the browser
 * they hit the running Node server.
 *
 * Every method tolerates an unconfigured site: the server answers with
 * empty/placeholder shapes and these helpers pass that through, so the UI
 * keeps rendering its demo content.
 */

// [bd:store]
// Types only: the elements themselves load in the browser.
import type { CompareColumn, ProductPageData } from "../shop/shop-elements";
// [/bd:store]
// [bd:blog]
import type {
	BlogCategory,
	BlogLikeResponse,
	BlogPublicComment,
	BlogPublicPost,
} from "@businessdash/sdk/contracts";
// [/bd:blog]
import type { ReviewsPageData } from "../shop/reviews-page";

/** Resolve a path against the current origin (works in SSR + browser). */
function apiUrl(path: string): string {
	if (typeof window !== "undefined" && window.location?.origin) {
		return new URL(path, window.location.origin).toString();
	}
	// SSR / tests: a bare path is fine for the platform's fetch.
	return path;
}

async function getJson<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

async function sendJson<T>(
	path: string,
	method: "POST" | "PATCH" | "DELETE",
	body?: unknown,
): Promise<T | null> {
	try {
		const res = await fetch(apiUrl(path), {
			method,
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

// ── Shared response shapes (loose; mirror the server payloads) ──────

export type HomePayload = {
	configured: boolean;
	hero?: { headline?: string; subheadline?: string; ctaText?: string; ctaLink?: string } | null;
	about?: { heading?: string; body?: string } | null;
	services?: {
		heading?: string;
		items?: Array<{ type: string; description: string; link?: string }>;
	} | null;
	reviewsCfg?: { heading?: string; subheading?: string } | null;
	banner?: BannerPayload | null;
	updates?: UpdateItem[];
	reviews?: ReviewsAggregate | null;
};

export type BannerMessage = {
	id: string;
	enabled: boolean;
	text: string;
	linkUrl?: string;
	buttonText?: string;
	openInNewTab?: boolean;
	urgent?: boolean;
};
export type BannerPayload = { enabled: boolean; messages: BannerMessage[] };

export type UpdateItem = {
	id: string;
	title: string | null;
	body: string;
	link: string | null;
	imageUrl: string | null;
	postedAt: string | null;
};

export type ReviewsAggregate = {
	rating: number | null;
	totalCount: number | null;
	items: Array<{ reviewerName?: string; reviewee?: string; description?: string; text?: string; rating: number; date?: string }>;
};

export type ReviewWallPage = {
	items: Array<{
		id: string;
		reviewerName: string;
		rating: number;
		text: string;
		timeCreated: string;
		source: string;
	}>;
	totalCount: number;
	nextOffset: number | null;
};

// [bd:store]
export type Product = {
	id: string;
	name: string;
	images?: string[] | null;
	categoryId?: string | null;
	[key: string]: unknown;
};
export type ProductListPayload = { items: Product[]; nextCursor: number | null; configured?: boolean };

/** Storefront listing sort options (mirrors the SDK's StorefrontSort union). */
export type StoreSort = "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";

/** Filters the storefront grid binds to (and reflects into the URL). */
export type StoreFilters = {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: StoreSort;
	limit?: number;
};

/** Enriched grid card from `listProductsWithMeta` — price, ratings, badges. */
export type ProductCard = {
	id: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	coverImage: string | null;
	cheapestPriceCents: number | null;
	comparePriceCents: number | null;
	isOnSale: boolean;
	isLowStock: boolean;
	hasMultipleVariants: boolean;
	avgRating: number;
	reviewCount: number;
	isBestSeller: boolean;
	isNew: boolean;
};

export type CategoryCount = { categoryId: string; count: number };
export type ProductCategory = { id: string; name: string; description: string | null };

export type ProductsMetaPayload = {
	items: ProductCard[];
	categoryCounts: CategoryCount[];
	priceRange: { minDollars: number; maxDollars: number };
	configured?: boolean;
};

export type ProductReview = {
	id: string;
	productId: string;
	rating: number;
	title?: string | null;
	body?: string | null;
	content?: string | null;
	reviewerName?: string | null;
	createdAt?: string | null;
};
export type ProductReviewsPayload = {
	items: ProductReview[];
	nextCursor: number | null;
	avgRating: number;
	totalCount: number;
};

export type RelatedProduct = {
	id: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	coverImageUrl: string | null;
	minPriceDollars: number | null;
	reasons?: string[];
};
export type RelatedProductsPayload = { items: RelatedProduct[] };

export type ProductAddon = {
	id: string;
	addonProductId: string;
	addonName: string;
	addonDescription: string | null;
	kind: string;
	groupLabel: string | null;
	priceCents: number | null;
	originalPriceCents: number | null;
	imageUrl: string | null;
};
export type ProductAddonsPayload = { items: ProductAddon[] };
// [/bd:store]

// [bd:subscriptions]
export type Subscription = {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	amountCents: number;
	interval: string;
};
export type SubscriptionsPayload = {
	items: Subscription[];
	configured?: boolean;
	/** Subscribing needs a signed-in customer. */
	signedIn?: boolean;
};
/** The customer's plan, as the portal reports it. */
export type CustomerPlan = {
	hasAccess: boolean;
	cancelledButActive: boolean;
	type: string | null;
	expiresAt: string | null;
	plan: { name: string } | null;
};
// [/bd:subscriptions]

// [bd:store]
export type CartItem = {
	id: string;
	productName: string | null;
	variantTitle: string | null;
	productImage: string | null;
	quantity: number;
	unitPrice: number;
	subtotal: number;
};
export type CartSnapshot = {
	id: string;
	couponCode: string | null;
	currency: string;
	items: CartItem[];
	subtotal: number;
	itemCount: number;
} | null;
// [/bd:store]

// [bd:blog]
export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	publishedAt: string | null;
};

/** A page of the blog, as `blog.listPosts` returns it. */
export type BlogPostsPayload = { items: BlogPublicPost[]; nextCursor: number | null };

/** One post, ready for the page: the server has made its HTML safe. */
export type BlogPostPayload = {
	post: {
		title: string;
		slug: string;
		excerpt: string | null;
		imageUrl: string | null;
		publishedAt: string | null;
		authorName: string | null;
		authorAvatarUrl: string | null;
		tags: string[];
		ctaLabel: string | null;
		ctaHref: string | null;
		ctaDescription: string | null;
	};
	html: string;
	minutes: number;
	paywalled: boolean;
	likes: BlogLikeResponse;
	comments: BlogPublicComment[];
	signedIn: boolean;
};
// [/bd:blog]

export type PortalMe = {
	signedIn: boolean;
	// [bd:subscriptions]
	plan?: CustomerPlan | null;
	// [/bd:subscriptions]
	user?: { email: string | null; firstName: string | null; lastName: string | null };
	organizationId?: string;
	role?: string | null;
	work?: {
		unlinked: boolean;
		jobs: Array<{ id: string; name: string | null; status: string; dueDate: string | null }>;
		summary?: {
			openJobCount: number;
			pendingQuoteCount: number;
			unpaidInvoiceCount: number;
			unpaidBalance: number;
		};
	} | null;
};

// [bd:booking]
export type EventType = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	durationMinutes: number;
};
export type Slot = { startAt: string; endAt: string };
// [/bd:booking]

export type ParallelPageRender = {
	meta: { title: string; description: string; canonical?: string; ogImage?: string };
	body: unknown;
};

// Todos — the relational custom-collections demo (`bd.data-model.config.ts`).
export type TodoImage = { url: string; alt: string | null; label: string | null };
export type TodoItem = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	createdAt: string;
	images: TodoImage[];
};
export type TodosPayload = {
	available: boolean;
	reason: string | null;
	todos: TodoItem[];
};

// ── Endpoint methods ───────────────────────────────────────────────

export const bdApi = {
	home: () => getJson<HomePayload>("/api/bd/home"),
	// [bd:blog]
	blog: () => getJson<{ items: BlogPost[] }>("/api/bd/blog"),
	blogPosts: (input: { limit: number; cursor?: number | null; categoryId?: string | null }) => {
		const q = new URLSearchParams({ limit: String(input.limit) });
		if (input.cursor != null) q.set("cursor", String(input.cursor));
		if (input.categoryId) q.set("categoryId", input.categoryId);
		return getJson<BlogPostsPayload>(`/api/bd/blog/posts?${q}`);
	},
	blogCategories: () => getJson<{ items: BlogCategory[] }>("/api/bd/blog/categories"),
	blogTags: () => getJson<{ items: string[] }>("/api/bd/blog/tags"),
	/** null when the post isn't there (or the blog isn't connected). */
	blogPost: (slug: string) => getJson<BlogPostPayload>(`/api/bd/blog/post/${encodeURIComponent(slug)}`),
	// [/bd:blog]

	// [bd:store]
	products: (cursor?: number | null, categoryId?: string) => {
		const q = new URLSearchParams();
		if (cursor != null) q.set("cursor", String(cursor));
		if (categoryId) q.set("categoryId", categoryId);
		const qs = q.toString();
		return getJson<ProductListPayload>(`/api/bd/store/products${qs ? `?${qs}` : ""}`);
	},
	product: (id: string) => getJson<Product>(`/api/bd/store/products/${encodeURIComponent(id)}`),

	/** Filterable grid + facets (categoryCounts, priceRange) + richer cards. */
	productsMeta: (filters: StoreFilters = {}) => {
		const q = new URLSearchParams();
		if (filters.search) q.set("search", filters.search);
		if (filters.categoryId) q.set("categoryId", filters.categoryId);
		if (filters.minPriceCents != null) q.set("minPriceCents", String(filters.minPriceCents));
		if (filters.maxPriceCents != null) q.set("maxPriceCents", String(filters.maxPriceCents));
		if (filters.minRating != null) q.set("minRating", String(filters.minRating));
		if (filters.sort) q.set("sort", filters.sort);
		if (filters.limit != null) q.set("limit", String(filters.limit));
		const qs = q.toString();
		return getJson<ProductsMetaPayload>(`/api/bd/store/products-meta${qs ? `?${qs}` : ""}`);
	},
	categories: () => getJson<{ items: ProductCategory[] }>("/api/bd/store/categories"),
	productReviews: (id: string, limit = 20) =>
		getJson<ProductReviewsPayload>(
			`/api/bd/store/products/${encodeURIComponent(id)}/reviews?limit=${limit}`,
		),
	relatedProducts: (id: string, limit = 6) =>
		getJson<RelatedProductsPayload>(
			`/api/bd/store/products/${encodeURIComponent(id)}/related?limit=${limit}`,
		),
	productAddons: (id: string) =>
		getJson<ProductAddonsPayload>(`/api/bd/store/products/${encodeURIComponent(id)}/addons`),

	/**
	 * Everything `<bd-product>` draws: the product, its first `reviewLimit`
	 * reviews, its add-ons and related products. null when the product isn't
	 * there (or the store isn't connected).
	 */
	productPage: async (id: string, reviewLimit: number): Promise<ProductPageData | null> => {
		const path = `/api/bd/store/products/${encodeURIComponent(id)}`;
		const [product, reviews, addons, related] = await Promise.all([
			getJson<ProductPageData["product"]>(path),
			getJson<NonNullable<ProductPageData["reviews"]>>(`${path}/reviews?limit=${reviewLimit}`),
			getJson<{ items: ProductPageData["addons"] }>(`${path}/addons`),
			getJson<{ items: ProductPageData["related"] }>(`${path}/related?limit=6`),
		]);
		if (!product) return null;
		return {
			product,
			reviews,
			addons: addons?.items ?? [],
			related: related?.items ?? [],
			moreReviewsHref:
				reviews && reviews.totalCount > reviews.items.length
					? `/store/${encodeURIComponent(id)}?reviews=${reviewLimit + 10}#reviews`
					: null,
		};
	},

	/** Up to four products side by side, for `<bd-compare>`; missing ones drop out. */
	compare: async (ids: string[]): Promise<CompareColumn[]> => {
		const columns = await Promise.all(
			ids.map(async (id): Promise<CompareColumn | null> => {
				const path = `/api/bd/store/products/${encodeURIComponent(id)}`;
				const [product, reviews] = await Promise.all([
					getJson<CompareColumn["product"]>(path),
					getJson<NonNullable<ProductPageData["reviews"]>>(`${path}/reviews?limit=1`),
				]);
				if (!product) return null;
				return {
					product,
					rating: reviews && reviews.totalCount > 0 ? { avg: reviews.avgRating, count: reviews.totalCount } : null,
				};
			}),
		);
		return columns.filter((column): column is CompareColumn => column !== null);
	},
	// [/bd:store]

	// [bd:subscriptions]
	subscriptions: () => getJson<SubscriptionsPayload>("/api/bd/subscriptions"),
	/** A Stripe URL for the signed-in customer, or where to sign in first. */
	subscribe: (id: string) =>
		sendJson<{ url?: string; signIn?: string }>(
			`/api/bd/subscriptions/${encodeURIComponent(id)}/checkout`,
			"POST",
		),
	/** Cancel at the end of the paid period, or take the cancel back. */
	changePlan: (intent: "cancel" | "resume") =>
		sendJson<{ cancelAtPeriodEnd: boolean; accessUntil: string | null }>(
			"/api/bd/portal/plan",
			"POST",
			{ intent },
		),
	// [/bd:subscriptions]

	// [bd:store]
	cart: () => getJson<CartSnapshot>("/api/bd/cart"),
	addToCart: (productId: string, quantity = 1) =>
		sendJson<CartSnapshot>("/api/bd/cart/items", "POST", { productId, quantity }),
	updateCartItem: (itemId: string, quantity: number) =>
		sendJson<CartSnapshot>(`/api/bd/cart/items/${encodeURIComponent(itemId)}`, "PATCH", { quantity }),
	removeCartItem: (itemId: string) =>
		sendJson<CartSnapshot>(`/api/bd/cart/items/${encodeURIComponent(itemId)}`, "DELETE"),
	applyCoupon: (code: string) =>
		sendJson<CartSnapshot>("/api/bd/cart/coupon", "POST", { code }),
	removeCoupon: () => sendJson<CartSnapshot>("/api/bd/cart/coupon", "DELETE"),
	clearCart: () => sendJson<CartSnapshot>("/api/bd/cart/clear", "POST"),
	startCheckout: () => sendJson<{ url: string }>("/api/bd/checkout/start", "POST"),
	// [/bd:store]

	contact: (input: { name: string; email: string; message: string }) =>
		sendJson<{ ok: boolean }>("/api/bd/contact", "POST", { slug: "general-inquiry", ...input }),

	/** The reviews page's data; `search` is "?source=…&shown=…" or "". */
	reviewsPage: (search: string) => getJson<ReviewsPageData>(`/api/bd/reviews/page${search}`),
	reviews: (offset?: number, limit = 10) => {
		const q = new URLSearchParams();
		if (offset != null) q.set("offset", String(offset));
		q.set("limit", String(limit));
		return getJson<ReviewWallPage>(`/api/bd/reviews?${q.toString()}`);
	},

	portalMe: () => getJson<PortalMe>("/api/bd/portal/me"),
	submitReview: (input: { rating: number; title?: string; body: string }) =>
		sendJson<{ ok: boolean; status?: string }>("/api/bd/portal/review", "POST", input),

	// [bd:booking]
	eventTypes: () => getJson<{ items: EventType[] }>("/api/bd/scheduling/event-types"),
	slots: (slug: string, fromIso: string, toIso: string) =>
		getJson<{ slots: Slot[] }>(
			`/api/bd/scheduling/${encodeURIComponent(slug)}/slots?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
		),
	book: (slug: string, input: { startAt: string; name: string; email: string; phone?: string; notes?: string; timezone?: string }) =>
		sendJson<{ ok: boolean; status?: string; bookingId?: string }>(
			`/api/bd/scheduling/${encodeURIComponent(slug)}/book`,
			"POST",
			input,
		),
	// [/bd:booking]

	serviceVariants: () =>
		getJson<{ variants: Array<Record<string, string>> }>("/api/bd/services"),
	servicePage: (service: string, area: string) =>
		getJson<ParallelPageRender>(
			`/api/bd/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`,
		),

	/** Todos demo — server joins the two custom collections via their RELATION. */
	todos: () => getJson<TodosPayload>("/api/bd/todos"),
	/** Create a todo by submitting the generated "Todo Form" server-side. */
	createTodo: (input: { title: string; notes?: string }) =>
		sendJson<{ ok: boolean; message?: string }>("/api/bd/todos", "POST", input),
};
