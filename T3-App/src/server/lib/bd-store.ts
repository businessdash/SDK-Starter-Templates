import "server-only";

import { cookies } from "next/headers";

import { env } from "@/env";
import { getBd, readOrUnavailable } from "@/server/lib/bd";

/**
 * Server-only storefront helpers — thin wrappers over the SDK's
 * `storefront` / `cart` / `checkout` / `coupons` / `subscriptions` resources.
 *
 * The cart is keyed on a visitor token we own (httpOnly cookie). Reads use
 * `getVisitorToken()` (no cookie mutation, safe in Server Components); cart
 * mutations use `ensureVisitorToken()` (sets the cookie — Server Actions only).
 */

const VISITOR_COOKIE = "bd_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** The message a thrown SDK call surfaces (BdApiError carries one). */
export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Read-only: the current visitor's cart token, or null if none yet. */
export async function getVisitorToken(): Promise<string | null> {
	const jar = await cookies();
	return jar.get(VISITOR_COOKIE)?.value ?? null;
}

/** Server-Action only: return the visitor token, minting + setting the cookie
 *  on first use. (Cookies can't be set from a Server Component.) */
export async function ensureVisitorToken(): Promise<string> {
	const jar = await cookies();
	const existing = jar.get(VISITOR_COOKIE)?.value;
	if (existing) return existing;
	const token = crypto.randomUUID();
	jar.set(VISITOR_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: VISITOR_MAX_AGE,
	});
	return token;
}

/** Whether the SDK is configured at all. Lets the UI show a "store not
 *  connected" state instead of an empty grid. */
export function isStoreConfigured(): boolean {
	return getBd() !== null;
}

export async function listStoreProducts(input?: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}) {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(() => bd.storefront.listProducts(input), null);
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
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(
		() => bd.storefront.listProductsWithMeta(input),
		null,
	);
}

/** Org product categories for the storefront sidebar. */
export async function listStoreCategories() {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(() => bd.storefront.listCategories(), null);
}

/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
export async function getStoreProductReviews(productId: string) {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(
		() => bd.storefront.getProductReviews(productId, { limit: 20 }),
		null,
	);
}

/** "You may also like" recommendations for a product. */
export async function getStoreRelatedProducts(productId: string) {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(
		() => bd.storefront.getRelatedProducts(productId, { limit: 6 }),
		null,
	);
}

/** Companion / cross-sell addons for a product ("complete your X"). */
export async function getStoreProductAddons(productId: string) {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(
		() => bd.storefront.getProductAddons(productId),
		null,
	);
}

export async function getStoreProduct(productId: string) {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(() => bd.storefront.getProduct(productId), null);
}

export async function listStoreSubscriptions() {
	const bd = getBd();
	if (!bd) return null;
	return readOrUnavailable(() => bd.subscriptions.list(), null);
}

/** Current cart snapshot, or null when the SDK is unconfigured or no cart
 *  exists yet (no visitor token). */
export async function getCartSnapshot() {
	const bd = getBd();
	if (!bd) return null;
	const token = await getVisitorToken();
	if (!token) return null;
	try {
		return await bd.cart.forVisitor(token).get();
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(`[bd-store] cart.get failed: ${sdkErrorMessage(err)}`);
		}
		return null;
	}
}

export async function getCheckoutStatus(sessionId: string) {
	const bd = getBd();
	if (!bd) return null;
	try {
		return await bd.checkout.getStatus(sessionId);
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(
				`[bd-store] checkout.getStatus failed: ${sdkErrorMessage(err)}`,
			);
		}
		return null;
	}
}
