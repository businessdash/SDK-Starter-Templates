/**
 * Browser → local-server API client.
 *
 * The Angular browser bundle never holds the BIAB API key. Instead it
 * fetches the small JSON endpoints the SSR Express server exposes (see
 * `src/server/biab-api.ts`). Those endpoints are the only place the key
 * lives. During SSR these same fetches resolve same-origin; in the browser
 * they hit the running Node server.
 *
 * Every method tolerates an unconfigured site: the server answers with
 * empty/placeholder shapes and these helpers pass that through, so the UI
 * keeps rendering its demo content.
 */

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

export type Subscription = {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	amountCents: number;
	interval: string;
};
export type SubscriptionsPayload = { items: Subscription[]; configured?: boolean };

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

export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	publishedAt: string | null;
};

export type PortalMe = {
	signedIn: boolean;
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

export type EventType = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	durationMinutes: number;
};
export type Slot = { startAt: string; endAt: string };

export type ParallelPageRender = {
	meta: { title: string; description: string; canonical?: string; ogImage?: string };
	body: unknown;
};

// Todos — the relational custom-collections demo (`biab.data-model.config.ts`).
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

export const biabApi = {
	home: () => getJson<HomePayload>("/api/biab/home"),
	blog: () => getJson<{ items: BlogPost[] }>("/api/biab/blog"),

	products: (cursor?: number | null, categoryId?: string) => {
		const q = new URLSearchParams();
		if (cursor != null) q.set("cursor", String(cursor));
		if (categoryId) q.set("categoryId", categoryId);
		const qs = q.toString();
		return getJson<ProductListPayload>(`/api/biab/store/products${qs ? `?${qs}` : ""}`);
	},
	product: (id: string) => getJson<Product>(`/api/biab/store/products/${encodeURIComponent(id)}`),

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
		return getJson<ProductsMetaPayload>(`/api/biab/store/products-meta${qs ? `?${qs}` : ""}`);
	},
	categories: () => getJson<{ items: ProductCategory[] }>("/api/biab/store/categories"),
	productReviews: (id: string, limit = 20) =>
		getJson<ProductReviewsPayload>(
			`/api/biab/store/products/${encodeURIComponent(id)}/reviews?limit=${limit}`,
		),
	relatedProducts: (id: string, limit = 6) =>
		getJson<RelatedProductsPayload>(
			`/api/biab/store/products/${encodeURIComponent(id)}/related?limit=${limit}`,
		),
	productAddons: (id: string) =>
		getJson<ProductAddonsPayload>(`/api/biab/store/products/${encodeURIComponent(id)}/addons`),

	subscriptions: () => getJson<SubscriptionsPayload>("/api/biab/subscriptions"),

	cart: () => getJson<CartSnapshot>("/api/biab/cart"),
	addToCart: (productId: string, quantity = 1) =>
		sendJson<CartSnapshot>("/api/biab/cart/items", "POST", { productId, quantity }),
	updateCartItem: (itemId: string, quantity: number) =>
		sendJson<CartSnapshot>(`/api/biab/cart/items/${encodeURIComponent(itemId)}`, "PATCH", { quantity }),
	removeCartItem: (itemId: string) =>
		sendJson<CartSnapshot>(`/api/biab/cart/items/${encodeURIComponent(itemId)}`, "DELETE"),
	applyCoupon: (code: string) =>
		sendJson<CartSnapshot>("/api/biab/cart/coupon", "POST", { code }),
	removeCoupon: () => sendJson<CartSnapshot>("/api/biab/cart/coupon", "DELETE"),
	clearCart: () => sendJson<CartSnapshot>("/api/biab/cart/clear", "POST"),
	startCheckout: () => sendJson<{ url: string }>("/api/biab/checkout/start", "POST"),

	contact: (input: { name: string; email: string; message: string }) =>
		sendJson<{ ok: boolean }>("/api/biab/contact", "POST", { slug: "general-inquiry", ...input }),

	reviews: (offset?: number, limit = 10) => {
		const q = new URLSearchParams();
		if (offset != null) q.set("offset", String(offset));
		q.set("limit", String(limit));
		return getJson<ReviewWallPage>(`/api/biab/reviews?${q.toString()}`);
	},

	portalMe: () => getJson<PortalMe>("/api/biab/portal/me"),
	submitReview: (input: { rating: number; title?: string; body: string }) =>
		sendJson<{ ok: boolean; status?: string }>("/api/biab/portal/review", "POST", input),

	eventTypes: () => getJson<{ items: EventType[] }>("/api/biab/scheduling/event-types"),
	slots: (slug: string, fromIso: string, toIso: string) =>
		getJson<{ slots: Slot[] }>(
			`/api/biab/scheduling/${encodeURIComponent(slug)}/slots?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
		),
	book: (slug: string, input: { startAt: string; name: string; email: string; phone?: string; notes?: string; timezone?: string }) =>
		sendJson<{ ok: boolean; status?: string; bookingId?: string }>(
			`/api/biab/scheduling/${encodeURIComponent(slug)}/book`,
			"POST",
			input,
		),

	serviceVariants: () =>
		getJson<{ variants: Array<Record<string, string>> }>("/api/biab/services"),
	servicePage: (service: string, area: string) =>
		getJson<ParallelPageRender>(
			`/api/biab/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`,
		),

	/** Todos demo — server joins the two custom collections via their RELATION. */
	todos: () => getJson<TodosPayload>("/api/biab/todos"),
	/** Create a todo by submitting the generated "Todo Form" server-side. */
	createTodo: (input: { title: string; notes?: string }) =>
		sendJson<{ ok: boolean; message?: string }>("/api/biab/todos", "POST", input),
};
