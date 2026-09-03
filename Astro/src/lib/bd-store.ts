import type { AstroCookies } from "astro";

import { bd } from "./bd";

/**
 * Server-only storefront helpers — thin wrappers over the SDK's
 * `storefront` / `cart` / `checkout` / `coupons` / `subscriptions`
 * resources. Mirrors DGP's `bd-store.ts`, adapted to Astro: instead of
 * `next/headers` cookies, callers pass the request-scoped `Astro.cookies`
 * (available in both `.astro` pages and API endpoints).
 *
 * The cart is keyed on a visitor token we own — an httpOnly `bd_cart_visitor`
 * cookie. Reads use `getVisitorToken()` (no mutation); cart mutations use
 * `ensureVisitorToken()`, which mints + sets the cookie on first use.
 *
 * Everything no-ops gracefully (returns `null`) when BD env is unset.
 */

const VISITOR_COOKIE = "bd_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Whether the SDK is configured at all — lets the UI show a "store not
 *  connected" state instead of an empty grid. */
export function isStoreConfigured(): boolean {
	return bd !== null;
}

/** Read-only: the current visitor's cart token, or null if none yet. */
export function getVisitorToken(cookies: AstroCookies): string | null {
	return cookies.get(VISITOR_COOKIE)?.value ?? null;
}

/** Return the visitor token, minting + setting the cookie on first use. */
export function ensureVisitorToken(cookies: AstroCookies): string {
	const existing = cookies.get(VISITOR_COOKIE)?.value;
	if (existing) return existing;
	const token = crypto.randomUUID();
	cookies.set(VISITOR_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: VISITOR_MAX_AGE,
	});
	return token;
}

/** The message a thrown SDK call surfaces. */
export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export async function listStoreProducts(input?: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}) {
	if (!bd) return null;
	try {
		return await bd.storefront.listProducts(input);
	} catch {
		return null;
	}
}

/** Filterable storefront grid + facets (categoryCounts, priceRange) + per-card
 *  price/ratings/badges — the data behind the platform-style shop listing. */
export async function listStoreProductsWithMeta(input?: {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";
	limit?: number;
}) {
	if (!bd) return null;
	try {
		return await bd.storefront.listProductsWithMeta(input);
	} catch {
		return null;
	}
}

/** Org product categories for the storefront sidebar. */
export async function listStoreCategories() {
	if (!bd) return null;
	try {
		return await bd.storefront.listCategories();
	} catch {
		return null;
	}
}

export async function getStoreProduct(productId: string) {
	if (!bd) return null;
	try {
		return await bd.storefront.getProduct(productId);
	} catch {
		return null;
	}
}

/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
export async function getStoreProductReviews(productId: string) {
	if (!bd) return null;
	try {
		return await bd.storefront.getProductReviews(productId, { limit: 20 });
	} catch {
		return null;
	}
}

/** "You may also like" recommendations for a product. */
export async function getStoreRelatedProducts(productId: string) {
	if (!bd) return null;
	try {
		const res = await bd.storefront.getRelatedProducts(productId, {
			limit: 6,
		});
		return res.items;
	} catch {
		return null;
	}
}

/** Companion / cross-sell addons for a product ("complete your X"). */
export async function getStoreProductAddons(productId: string) {
	if (!bd) return null;
	try {
		const res = await bd.storefront.getProductAddons(productId);
		return res.items;
	} catch {
		return null;
	}
}

export async function listStoreSubscriptions() {
	if (!bd) return null;
	try {
		return await bd.subscriptions.list();
	} catch {
		return null;
	}
}

/** Current cart snapshot, or null when unconfigured / no cart yet. */
export async function getCartSnapshot(cookies: AstroCookies) {
	if (!bd) return null;
	const token = getVisitorToken(cookies);
	if (!token) return null;
	try {
		return await bd.cart.forVisitor(token).get();
	} catch {
		return null;
	}
}

/** Item count for the navbar cart indicator (0 when empty/unconnected). */
export async function getCartCount(cookies: AstroCookies): Promise<number> {
	const snapshot = await getCartSnapshot(cookies);
	return snapshot?.itemCount ?? 0;
}

export async function getCheckoutStatus(sessionId: string) {
	if (!bd) return null;
	try {
		return await bd.checkout.getStatus(sessionId);
	} catch {
		return null;
	}
}
