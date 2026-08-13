/**
 * Browser-side fetcher for the BIAB SDK proxy (vanilla).
 *
 * Mirrors the shape of `@businessdash/sdk`'s `createBiabClient` exactly
 * — same method names, same params — so the React-Bun example's
 * components translate one-to-one. The runtime is JS, but JSDoc
 * `@typedef`s give IDEs full IntelliSense without a build step.
 *
 * Every call hits same-origin `/api/biab/*`. The Bun server holds
 * the bearer key.
 *
 * @typedef {Object} GalleryItem
 * @property {string} id
 * @property {"image" | "video"} type
 * @property {string} src
 * @property {number | null} [width]
 * @property {number | null} [height]
 * @property {string | null} [blurDataURL]
 * @property {string | null} [alt]
 * @property {string | null} [title]
 * @property {string | null} [category]
 * @property {string | null} [description]
 * @property {string | null} [jobId]
 * @property {string | null} [jobName]
 * @property {string | null} [takenAt]
 *
 * @typedef {Object} SchedulingEventType
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string | null} description
 * @property {number} durationMinutes
 * @property {string} locationType
 * @property {string | null} meetingProvider
 * @property {string | null} color
 * @property {boolean} requiresApproval
 *
 * @typedef {Object} SchedulingSlot
 * @property {string} startAt
 * @property {string} endAt
 *
 * @typedef {Object} SchedulingInvitee
 * @property {string} email
 * @property {string} name
 * @property {string | null} [phone]
 * @property {string} timezone
 *
 * @typedef {Object} FormFieldDef
 * @property {string} id
 * @property {string} label
 * @property {string} type
 * @property {boolean} required
 * @property {string} [placeholder]
 * @property {string} [helpText]
 *
 * @typedef {Object} FormSchema
 * @property {string} id
 * @property {string} slug
 * @property {string} [title]
 * @property {string | null} [description]
 * @property {FormFieldDef[]} fields
 */

/**
 * @template T
 * @param {string} path
 * @returns {Promise<T>}
 */
async function getJson(path) {
	const res = await fetch(path);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status} ${res.statusText} on ${path}: ${text}`);
	}
	return await res.json();
}

/**
 * @template T
 * @param {string} path
 * @param {unknown} body
 * @returns {Promise<T>}
 */
async function postJson(path, body) {
	const res = await fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status} ${res.statusText} on ${path}: ${text}`);
	}
	return await res.json();
}

export const biab = {
	marketing: {
		/** @param {{ pageKey?: string; locale?: string }} [params] */
		async getPageBundle(params = {}) {
			const query = new URLSearchParams({
				pageKey: params.pageKey ?? "home",
				locale: params.locale ?? "en",
			});
			return await getJson(`/api/biab/marketing-bundle?${query}`);
		},
	},
	gallery: {
		/**
		 * @param {{ limit?: number; fields?: string[] }} [params]
		 * @returns {Promise<GalleryItem[]>}
		 */
		async list(params = {}) {
			const query = new URLSearchParams();
			if (params.limit) query.set("limit", String(params.limit));
			if (params.fields) query.set("fields", params.fields.join(","));
			const result = await getJson(
				`/api/biab/gallery${query.toString() ? `?${query}` : ""}`,
			);
			return result.items ?? [];
		},
	},
	blog: {
		/** @param {{ limit?: number }} [params] */
		async listPosts(params = {}) {
			const query = new URLSearchParams();
			if (params.limit) query.set("limit", String(params.limit));
			return await getJson(
				`/api/biab/blog/posts${query.toString() ? `?${query}` : ""}`,
			);
		},
	},
	scheduling: {
		/** @returns {Promise<SchedulingEventType[]>} */
		async listEventTypes() {
			const result = await getJson("/api/biab/scheduling/event-types");
			return result.items ?? [];
		},
		/**
		 * @param {string} slug
		 * @param {{ from: Date; to: Date }} params
		 * @returns {Promise<SchedulingSlot[]>}
		 */
		async getAvailableSlots(slug, params) {
			const query = new URLSearchParams({
				slug,
				from: params.from.toISOString(),
				to: params.to.toISOString(),
			});
			const result = await getJson(`/api/biab/scheduling/slots?${query}`);
			return result.slots ?? [];
		},
		/**
		 * @param {{
		 *   eventTypeSlug: string;
		 *   startAt: Date;
		 *   invitee: SchedulingInvitee;
		 *   notes?: string | null;
		 * }} input
		 */
		async confirmBooking(input) {
			return await postJson("/api/biab/scheduling/bookings", {
				...input,
				startAt: input.startAt.toISOString(),
			});
		},
	},
	forms: {
		/**
		 * @param {string} slug
		 * @returns {Promise<FormSchema>}
		 */
		async schema(slug) {
			return await getJson(
				`/api/biab/forms/schema?slug=${encodeURIComponent(slug)}`,
			);
		},
		/**
		 * @param {string} slug
		 * @param {Record<string, unknown>} data
		 * @param {{ submitterEmail?: string; submitterName?: string }} [opts]
		 */
		async submit(slug, data, opts = {}) {
			return await postJson("/api/biab/forms/submit", {
				slug,
				data,
				submitterEmail: opts.submitterEmail,
				submitterName: opts.submitterName,
			});
		},
	},
	storefront: {
		/** @param {{ limit?: number; categoryId?: string }} [params] */
		async listProducts(params = {}) {
			const query = new URLSearchParams();
			if (params.limit) query.set("limit", String(params.limit));
			if (params.categoryId) query.set("categoryId", params.categoryId);
			return await getJson(
				`/api/biab/storefront/products${query.toString() ? `?${query}` : ""}`,
			);
		},
		/**
		 * Filterable grid + facets — the data behind a full shop page. Each card
		 * carries price/compareAt/rating/badges; the response also returns
		 * `categoryCounts` + `priceRange` for the sidebar.
		 * @param {{ search?: string; categoryId?: string; minPriceCents?: number;
		 *   maxPriceCents?: number; minRating?: number;
		 *   sort?: "featured"|"newest"|"price-asc"|"price-desc"|"rating-desc";
		 *   limit?: number }} [params]
		 */
		async listProductsWithMeta(params = {}) {
			const query = new URLSearchParams();
			if (params.search) query.set("search", params.search);
			if (params.categoryId) query.set("categoryId", params.categoryId);
			if (params.minPriceCents != null) query.set("minPriceCents", String(params.minPriceCents));
			if (params.maxPriceCents != null) query.set("maxPriceCents", String(params.maxPriceCents));
			if (params.minRating != null) query.set("minRating", String(params.minRating));
			if (params.sort) query.set("sort", params.sort);
			if (params.limit != null) query.set("limit", String(params.limit));
			return await getJson(
				`/api/biab/storefront/products-meta${query.toString() ? `?${query}` : ""}`,
			);
		},
		/** Org product categories for the storefront sidebar. */
		async listCategories() {
			return await getJson("/api/biab/storefront/categories");
		},
		/** @param {string} id */
		async getProduct(id) {
			return await getJson(`/api/biab/storefront/product/${encodeURIComponent(id)}`);
		},
		/** @param {string} id @param {{ limit?: number; cursor?: number }} [params] */
		async getProductReviews(id, params = {}) {
			const query = new URLSearchParams();
			if (params.limit != null) query.set("limit", String(params.limit));
			if (params.cursor != null) query.set("cursor", String(params.cursor));
			return await getJson(
				`/api/biab/storefront/product/${encodeURIComponent(id)}/reviews${query.toString() ? `?${query}` : ""}`,
			);
		},
		/** @param {string} id @param {{ limit?: number }} [params] */
		async getRelatedProducts(id, params = {}) {
			const query = new URLSearchParams();
			if (params.limit != null) query.set("limit", String(params.limit));
			return await getJson(
				`/api/biab/storefront/product/${encodeURIComponent(id)}/related${query.toString() ? `?${query}` : ""}`,
			);
		},
		/** @param {string} id */
		async getProductAddons(id) {
			return await getJson(`/api/biab/storefront/product/${encodeURIComponent(id)}/addons`);
		},
	},
	subscriptions: {
		async list() {
			return await getJson("/api/biab/subscriptions");
		},
	},
	reviews: {
		/** @param {{ limit?: number; offset?: number }} [params] */
		async list(params = {}) {
			const query = new URLSearchParams();
			if (params.limit != null) query.set("limit", String(params.limit));
			if (params.offset != null) query.set("offset", String(params.offset));
			return await getJson(`/api/biab/reviews${query.toString() ? `?${query}` : ""}`);
		},
	},
	cart: {
		async get() {
			return await getJson("/api/biab/cart");
		},
		/** @param {{ productId: string; variantId?: string | null; quantity?: number }} input */
		async add(input) {
			return await postJson("/api/biab/cart/add", input);
		},
		/** @param {string} itemId @param {number} quantity */
		async update(itemId, quantity) {
			return await postJson("/api/biab/cart/update", { itemId, quantity });
		},
		/** @param {string} itemId */
		async remove(itemId) {
			return await postJson("/api/biab/cart/remove", { itemId });
		},
		/** @param {string} code */
		async applyCoupon(code) {
			return await postJson("/api/biab/cart/coupon", { code });
		},
		async removeCoupon() {
			return await postJson("/api/biab/cart/coupon/remove", {});
		},
		async clear() {
			return await postJson("/api/biab/cart/clear", {});
		},
	},
	checkout: {
		/** @param {{ origin: string; customerEmail?: string }} input @returns {Promise<{ url: string }>} */
		async start(input) {
			return await postJson("/api/biab/checkout/start", input);
		},
		/** @param {string} sessionId */
		async status(sessionId) {
			return await getJson(
				`/api/biab/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
			);
		},
	},
	portal: {
		/** @returns {Promise<{ signedIn: boolean; user?: object; work: object | null }>} */
		async work() {
			return await getJson("/api/biab/portal/work");
		},
		/** @param {{ rating: number; body: string; jobId?: string | null }} input */
		async submitReview(input) {
			return await postJson("/api/biab/portal/submit-review", input);
		},
	},
	parallelPages: {
		/** @param {string} [key] */
		async listVariants(key = "service-area") {
			return await getJson(`/api/biab/parallel/variants?key=${encodeURIComponent(key)}`);
		},
		/** @param {string} key @param {{ service: string; area: string }} slugs */
		async render(key, slugs) {
			const query = new URLSearchParams({ key, service: slugs.service, area: slugs.area });
			return await getJson(`/api/biab/parallel/render?${query}`);
		},
	},
	content: {
		/** @returns {Promise<{ banner: object | null; updates: object | null }>} */
		async extras() {
			return await getJson("/api/biab/content/extras");
		},
	},
	todos: {
		/**
		 * Custom-collections demo (`biab.data-model.config.ts`). The server
		 * reads both collections through the SDK's documented custom-database
		 * read path (`dataModel.listRecords({ object })`) and joins images to
		 * todos via the `todo` RELATION field. Creates go through
		 * `biab.forms.submit("todo-form", …)` — forms are the SDK's documented
		 * create path for custom collections.
		 *
		 * @returns {Promise<{ available: boolean; reason: string | null; todos: Array<{ id: string; title: string; done: boolean; notes: string | null; createdAt: string; images: Array<{ url: string; alt: string | null; label: string | null }> }> }>}
		 */
		async list() {
			return await getJson("/api/biab/todos");
		},
	},
};

export { getJson, postJson };

/** Format a cents integer as currency (e.g. 1299 → "$12.99"). Use for
 *  `amountCents`-style fields (subscriptions, checkout totals). */
export function money(cents, currency = "USD") {
	if (cents == null || Number.isNaN(Number(cents))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
		Number(cents) / 100,
	);
}

/** Format an already-decimal amount as currency (e.g. 12.99 → "$12.99"). Use
 *  for cart `unitPrice` / `subtotal`, which are decimals, not cents. */
export function dollars(amount, currency = "USD") {
	if (amount == null || Number.isNaN(Number(amount))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

// ---------------------------------------------------------------------------
// DOM helpers — used by every section module.
// ---------------------------------------------------------------------------

/**
 * Render `text` into an element with the given class.
 * @param {string} tag
 * @param {Record<string, string | number | boolean | null | undefined>} attrs
 * @param {(Node | string | null | undefined | false)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v == null || v === false) continue;
		if (k === "class") node.className = String(v);
		else if (k === "html") node.innerHTML = String(v);
		else if (k.startsWith("on") && typeof v === "function") {
			node.addEventListener(k.slice(2).toLowerCase(), v);
		} else if (k === "dataset" && typeof v === "object") {
			Object.assign(node.dataset, v);
		} else if (v === true) node.setAttribute(k, "");
		else node.setAttribute(k, String(v));
	}
	for (const child of children) {
		if (child == null || child === false) continue;
		node.append(typeof child === "string" ? document.createTextNode(child) : child);
	}
	return node;
}

/** Shorthand for `el("div", {class: "biab-loading"}, ["Loading…"])`. */
export function loading(label = "Loading…") {
	return el("div", { class: "biab-loading" }, [label]);
}

/** Shorthand for the empty state. */
export function empty(message) {
	return el("div", { class: "biab-empty" }, [message]);
}
