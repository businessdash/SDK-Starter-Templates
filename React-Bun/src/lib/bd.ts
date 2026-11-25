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

// [bd:blog]
import type {
	BlogCategory,
	BlogLikeResponse,
	BlogListPostsResponse,
} from "@businessdash/sdk/contracts";
import type { BlogPostData, CommentResult } from "../components/blog/BlogPost";
// [/bd:blog]
import type {
	BundleGalleryItem,
	FormSchema,
	FormSubmitResult,
	GalleryField,
	GalleryItemFor,
} from "@businessdash/sdk";
// [bd:booking]
import type {
	SchedulingBookingResult,
	SchedulingEventType,
	SchedulingInvitee,
	SchedulingSlot,
} from "@businessdash/sdk";
// [/bd:booking]

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

// [bd:blog]
/**
 * POST and read the answer whatever its status (these routes explain a
 * refusal in the body); `fallback` when the server can't be reached.
 */
async function postAnswer<T>(path: string, body: unknown, fallback: T): Promise<T> {
	try {
		const res = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		return (await res.json()) as T;
	} catch {
		return fallback;
	}
}
// [/bd:blog]

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
	// [bd:blog]
	blog: {
		async listPosts(params?: {
			limit?: number;
			cursor?: number | null;
			categoryId?: string | null;
		}): Promise<BlogListPostsResponse> {
			const query = new URLSearchParams();
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.cursor != null) query.set("cursor", String(params.cursor));
			if (params?.categoryId) query.set("categoryId", params.categoryId);
			return await getJson<BlogListPostsResponse>(
				`/api/bd/blog/posts${query.toString() ? `?${query}` : ""}`,
			);
		},
		async listCategories(): Promise<BlogCategory[]> {
			return (await getJson<{ items: BlogCategory[] }>("/api/bd/blog/categories")).items;
		},
		async listTags(): Promise<string[]> {
			return (await getJson<{ items: string[] }>("/api/bd/blog/tags")).items;
		},
		/** One post, ready for the page (its HTML made safe on the server), or null. */
		async getPost(slug: string): Promise<BlogPostData | null> {
			const res = await fetch(`/api/bd/blog/post?slug=${encodeURIComponent(slug)}`);
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`${res.status} ${res.statusText} on /api/bd/blog/post`);
			return (await res.json()) as BlogPostData;
		},
		/** Like or unlike, for the signed-in customer. */
		async toggleLike(slug: string): Promise<BlogLikeResponse | { error: string }> {
			return await postAnswer("/api/bd/blog/like", { slug }, { error: "Couldn't save your like. Try again." });
		},
		async comment(slug: string, content: string): Promise<CommentResult> {
			return await postAnswer(
				"/api/bd/blog/comment",
				{ slug, content },
				{ ok: false, error: "Couldn't post your comment. Try again." },
			);
		},
	},
	// [/bd:blog]
	// [bd:booking]
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
	// [/bd:booking]
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
	// [bd:store]
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
	// [/bd:store]
	// [bd:subscriptions]
	subscriptions: {
		async list(): Promise<Loose> {
			return await getJson<Loose>("/api/bd/subscriptions");
		},
		/** A Stripe URL for the signed-in customer, or where to sign in first. */
		async checkout(planId: string, origin: string): Promise<{ url?: string; signIn?: string }> {
			return await postJson("/api/bd/subscriptions/checkout", { planId, origin });
		},
	},
	// [/bd:subscriptions]
	reviews: {
		async list(params?: { limit?: number; offset?: number }): Promise<Loose> {
			const query = new URLSearchParams();
			if (params?.limit != null) query.set("limit", String(params.limit));
			if (params?.offset != null) query.set("offset", String(params.offset));
			return await getJson<Loose>(`/api/bd/reviews${query.toString() ? `?${query}` : ""}`);
		},
	},
	// [bd:store]
	cart: {
		async get(): Promise<Loose> {
			return await getJson<Loose>("/api/bd/cart");
		},
		async add(input: {
			productId: string;
			variantId?: string | null;
			quantity?: number;
			/** Chosen options, such as `{ Size: "42" }`; the cart prices them. */
			options?: Record<string, string>;
		}): Promise<Loose> {
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
	// [/bd:store]
	portal: {
		async work(): Promise<{ signedIn: boolean; user?: PortalUser; work: Loose | null; plan?: CustomerPlan | null }> {
			return await getJson("/api/bd/portal/work");
		},
		// [bd:subscriptions]
		/** Cancel at the end of the paid period, or take the cancel back. */
		async changePlan(intent: "cancel" | "resume"): Promise<{ cancelAtPeriodEnd: boolean; accessUntil: string | null }> {
			return await postJson("/api/bd/portal/plan", { intent });
		},
		// [/bd:subscriptions]
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

/** The customer's plan, as the portal reports it. */
export type CustomerPlan = {
	hasAccess: boolean;
	cancelledButActive: boolean;
	type: string | null;
	expiresAt: string | null;
	plan: { name: string } | null;
};

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

export type { BundleGalleryItem, FormSchema, FormSubmitResult, GalleryField };
// [bd:booking]
export type { SchedulingBookingResult, SchedulingEventType, SchedulingInvitee, SchedulingSlot };
// [/bd:booking]
