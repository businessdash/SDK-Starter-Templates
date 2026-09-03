/**
 * Browser-side fetcher for the BD SDK proxy.
 *
 * Every method here calls a same-origin `/api/bd/*` endpoint —
 * the Bun server (see `server.ts`) holds the API key and forwards
 * to BD via `@businessdash/sdk`. The browser bundle never sees the
 * bearer token; this file is safe to ship to clients.
 *
 * Types come from `@businessdash/sdk` (declarations only — no runtime
 * code from the SDK is bundled here).
 */

import type {
	BlogListPostsResponse,
	BlogPostBySlugResponse,
} from "@businessdash/sdk/contracts";
import type {
	BundleGalleryItem,
	FormSchema,
	FormSubmitResult,
	GalleryField,
	GalleryItemFor,
	SchedulingBookingResult,
	SchedulingEventType,
	SchedulingInvitee,
	SchedulingSlot,
} from "@businessdash/sdk";

export type TodoImage = {
	id: string;
	url: string;
	alt: string | null;
	label: string | null;
};

export type TodoWithImages = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	createdAt: string;
	images: TodoImage[];
};

export type TodosResult =
	| { status: "unconfigured" }
	/** Plan gate, missing `metadata:read_records` scope, or model not promoted. */
	| { status: "unavailable" }
	| { status: "ok"; todos: TodoWithImages[] };

async function getJson<T>(path: string): Promise<T> {
	const res = await fetch(path);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status} ${res.statusText} on ${path}: ${text}`);
	}
	return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status} ${res.statusText} on ${path}: ${text}`);
	}
	return (await res.json()) as T;
}

export const bd = {
	marketing: {
		async getPageBundle(params: { pageKey?: string; locale?: string } = {}) {
			const query = new URLSearchParams({
				pageKey: params.pageKey ?? "home",
				locale: params.locale ?? "en",
			});
			return await getJson<Record<string, unknown>>(
				`/api/bd/marketing-bundle?${query}`,
			);
		},
	},
	gallery: {
		/**
		 * Typed const-generic field selection: `fields: ["src", "title"]
		 * as const` narrows the return type to `Array<Pick<GalleryItem,
		 * "src" | "title">>`. Server-side projection means the DB only
		 * SELECTs the columns you asked for.
		 */
		async list<const F extends readonly GalleryField[]>(params?: {
			limit?: number;
			fields?: F;
		}): Promise<GalleryItemFor<F>[]> {
			const query = new URLSearchParams();
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.fields) query.set("fields", params.fields.join(","));
			const result = await getJson<{ items: BundleGalleryItem[] }>(
				`/api/bd/gallery${query.toString() ? `?${query}` : ""}`,
			);
			return result.items as never;
		},
	},
	blog: {
		async listPosts(params?: { limit?: number }): Promise<BlogListPostsResponse> {
			const query = new URLSearchParams();
			if (params?.limit) query.set("limit", String(params.limit));
			return await getJson<BlogListPostsResponse>(
				`/api/bd/blog/posts${query.toString() ? `?${query}` : ""}`,
			);
		},
		async getPost(slug: string): Promise<BlogPostBySlugResponse> {
			return await getJson<BlogPostBySlugResponse>(
				`/api/bd/blog/post?slug=${encodeURIComponent(slug)}`,
			);
		},
	},
	scheduling: {
		async listEventTypes(): Promise<SchedulingEventType[]> {
			const result = await getJson<{ items: SchedulingEventType[] }>(
				"/api/bd/scheduling/event-types",
			);
			return result.items;
		},
		async getAvailableSlots(
			slug: string,
			params: { from: Date; to: Date },
		): Promise<SchedulingSlot[]> {
			const query = new URLSearchParams({
				slug,
				from: params.from.toISOString(),
				to: params.to.toISOString(),
			});
			const result = await getJson<{ slots: SchedulingSlot[] }>(
				`/api/bd/scheduling/slots?${query}`,
			);
			return result.slots;
		},
		async confirmBooking(input: {
			eventTypeSlug: string;
			startAt: Date;
			invitee: SchedulingInvitee;
			notes?: string | null;
		}): Promise<SchedulingBookingResult> {
			return await postJson<SchedulingBookingResult>(
				"/api/bd/scheduling/bookings",
				{
					...input,
					startAt: input.startAt.toISOString(),
				},
			);
		},
	},
	// This `forms` shape structurally satisfies the `BdFormsClient` contract
	// `<BdForm>` (from `@businessdash/sdk/react`) expects, so you can pass `bd`
	// straight to the component: `<BdForm slug="general-inquiry" client={bd} />`.
	forms: {
		async schema(slug: string): Promise<FormSchema> {
			return await getJson<FormSchema>(
				`/api/bd/forms/schema?slug=${encodeURIComponent(slug)}`,
			);
		},
		async submit(
			slug: string,
			data: Record<string, unknown>,
			opts?: {
				submitterEmail?: string;
				submitterName?: string;
				dryRun?: boolean;
				source?: string;
				referrer?: string;
				metadata?: Record<string, unknown>;
			},
		): Promise<FormSubmitResult> {
			return await postJson<FormSubmitResult>("/api/bd/forms/submit", {
				slug,
				data,
				...opts,
			});
		},
	},
	// Custom-collections demo (todos + todoImages) — the Bun server reads the
	// org's custom DB via `dataModel.listRecords` and joins images onto their
	// todo (`GET /api/bd/todos` in server.ts). Creates go through the
	// generated `todo-form` via `bd.forms` above.
	todos: {
		async list(): Promise<TodosResult> {
			return await getJson<TodosResult>("/api/bd/todos");
		},
	},
	storefront: {
		async listProducts(params?: { limit?: number; categoryId?: string }): Promise<Loose> {
			const query = new URLSearchParams();
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.categoryId) query.set("categoryId", params.categoryId);
			return await getJson<Loose>(`/api/bd/storefront/products${query.toString() ? `?${query}` : ""}`);
		},
		/** Filterable listing grid + facets (categoryCounts, priceRange) + richer
		 *  cards (price/compareAt/rating/badges) — the data behind a full shop page. */
		async listProductsWithMeta(params?: {
			search?: string;
			categoryId?: string;
			minPriceCents?: number;
			maxPriceCents?: number;
			minRating?: number;
			sort?: "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";
			limit?: number;
		}): Promise<Loose> {
			const query = new URLSearchParams({ meta: "1" });
			if (params?.search) query.set("search", params.search);
			if (params?.categoryId) query.set("categoryId", params.categoryId);
			if (params?.minPriceCents != null) query.set("minPriceCents", String(params.minPriceCents));
			if (params?.maxPriceCents != null) query.set("maxPriceCents", String(params.maxPriceCents));
			if (params?.minRating != null) query.set("minRating", String(params.minRating));
			if (params?.sort) query.set("sort", params.sort);
			if (params?.limit != null) query.set("limit", String(params.limit));
			return await getJson<Loose>(`/api/bd/storefront/products?${query}`);
		},
		/** Org product categories for the storefront sidebar (id → name). */
		async listCategories(): Promise<Loose> {
			return await getJson<Loose>("/api/bd/storefront/categories");
		},
		async getProduct(id: string): Promise<Loose> {
			return await getJson<Loose>(`/api/bd/storefront/product/${encodeURIComponent(id)}`);
		},
		/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
		async getProductReviews(id: string, params?: { limit?: number; cursor?: number | null }): Promise<Loose> {
			const query = new URLSearchParams();
			if (params?.limit != null) query.set("limit", String(params.limit));
			if (params?.cursor != null) query.set("cursor", String(params.cursor));
			return await getJson<Loose>(
				`/api/bd/storefront/product/${encodeURIComponent(id)}/reviews${query.toString() ? `?${query}` : ""}`,
			);
		},
		/** "You may also like" recommendations for a product. */
		async getRelatedProducts(id: string, params?: { limit?: number }): Promise<Loose> {
			const query = new URLSearchParams();
			if (params?.limit != null) query.set("limit", String(params.limit));
			return await getJson<Loose>(
				`/api/bd/storefront/product/${encodeURIComponent(id)}/related${query.toString() ? `?${query}` : ""}`,
			);
		},
		/** Companion / cross-sell addons ("complete your X") for a product. */
		async getProductAddons(id: string): Promise<Loose> {
			return await getJson<Loose>(`/api/bd/storefront/product/${encodeURIComponent(id)}/addons`);
		},
	},
	subscriptions: {
		async list(): Promise<Loose> {
			return await getJson<Loose>("/api/bd/subscriptions");
		},
	},
	reviews: {
		async list(params?: { limit?: number; offset?: number }): Promise<Loose> {
			const query = new URLSearchParams();
			if (params?.limit != null) query.set("limit", String(params.limit));
			if (params?.offset != null) query.set("offset", String(params.offset));
			return await getJson<Loose>(`/api/bd/reviews${query.toString() ? `?${query}` : ""}`);
		},
	},
	cart: {
		async get(): Promise<Loose> {
			return await getJson<Loose>("/api/bd/cart");
		},
		async add(input: { productId: string; variantId?: string | null; quantity?: number }): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/add", input);
		},
		async update(itemId: string, quantity: number): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/update", { itemId, quantity });
		},
		async remove(itemId: string): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/remove", { itemId });
		},
		async applyCoupon(code: string): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/coupon", { code });
		},
		async removeCoupon(): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/coupon/remove", {});
		},
		async clear(): Promise<Loose> {
			return await postJson<Loose>("/api/bd/cart/clear", {});
		},
	},
	checkout: {
		async start(input: { origin: string; customerEmail?: string }): Promise<{ url: string }> {
			return await postJson<{ url: string }>("/api/bd/checkout/start", input);
		},
	},
	portal: {
		async work(): Promise<{ signedIn: boolean; user?: PortalUser; work: Loose | null }> {
			return await getJson("/api/bd/portal/work");
		},
		async submitReview(input: { rating: number; body: string; jobId?: string | null }): Promise<Loose> {
			return await postJson<Loose>("/api/bd/portal/submit-review", input);
		},
	},
	parallelPages: {
		async listVariants(key = "service-area"): Promise<Loose> {
			return await getJson<Loose>(`/api/bd/parallel/variants?key=${encodeURIComponent(key)}`);
		},
		async render(key: string, slugs: { service: string; area: string }): Promise<Loose> {
			const query = new URLSearchParams({ key, service: slugs.service, area: slugs.area });
			return await getJson<Loose>(`/api/bd/parallel/render?${query}`);
		},
	},
	content: {
		async extras(): Promise<{ banner: Loose | null; updates: Loose | null }> {
			return await getJson("/api/bd/content/extras");
		},
	},
};

/** Loose shape for surfaces the SDK keeps passthrough/untyped at 0.9.5. */
export type Loose = Record<string, any>;

export type PortalUser = {
	id: string;
	email: string | null;
	firstName: string | null;
	lastName: string | null;
};

/** Format a cents integer (subscriptions / checkout totals). */
export function money(cents: number | null | undefined, currency = "USD"): string {
	if (cents == null || Number.isNaN(Number(cents))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents) / 100);
}

/** Format an already-decimal amount (cart unitPrice / subtotal). */
export function dollars(amount: number | null | undefined, currency = "USD"): string {
	if (amount == null || Number.isNaN(Number(amount))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

export type {
	BundleGalleryItem,
	FormSchema,
	FormSubmitResult,
	GalleryField,
	SchedulingBookingResult,
	SchedulingEventType,
	SchedulingInvitee,
	SchedulingSlot,
};
