import { createCookie } from "react-router";
import type { BiabClient } from "@businessdash/sdk";
import type { CartSnapshot } from "@businessdash/sdk/contracts";

import { getBiab } from "./biab.server";

/** The visitor-bound cart client returned by `client.cart.forVisitor(...)`. */
type VisitorCart = ReturnType<BiabClient["cart"]["forVisitor"]>;

/**
 * Storefront / cart / checkout helpers (server-only).
 *
 * Thin wrappers over the SDK's `storefront` / `cart` / `checkout` /
 * `subscriptions` / `coupons` resources. The cart is keyed on a visitor
 * token WE own — an httpOnly `biab_cart_visitor` cookie minted on first
 * mutation (mirrors DGP `biab-store.ts`). Remix has no `next/headers`, so
 * the cookie is read from the request and written via a Set-Cookie header
 * the route's `action` returns.
 *
 *   reads  (loaders): pass the request → `readVisitorToken(request)`
 *   writes (actions): mint if absent → `ensureVisitorToken(request)` then
 *                     attach `Set-Cookie: serializeVisitorCookie(token)`.
 */

const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** httpOnly cookie holding the visitor's cart token. */
export const visitorCookie = createCookie("biab_cart_visitor", {
	httpOnly: true,
	sameSite: "lax",
	path: "/",
	maxAge: VISITOR_MAX_AGE,
});

/** Whether the store can run at all (BIAB env present). */
export function isStoreConfigured(): boolean {
	return getBiab() !== null;
}

/** Read-only: the request's cart token, or null if none yet. */
export async function readVisitorToken(
	request: Request,
): Promise<string | null> {
	const value = await visitorCookie.parse(request.headers.get("Cookie"));
	return typeof value === "string" && value ? value : null;
}

/** Return the visitor token, minting one when the request has none. Pair the
 *  returned token with `serializeVisitorCookie(token)` in the action response
 *  so first-time visitors get the cookie set. */
export async function ensureVisitorToken(request: Request): Promise<string> {
	const existing = await readVisitorToken(request);
	return existing ?? crypto.randomUUID();
}

/** Serialize the visitor cookie for a `Set-Cookie` header. */
export function serializeVisitorCookie(token: string): Promise<string> {
	return visitorCookie.serialize(token);
}

export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

// ── Catalog reads ─────────────────────────────────────────────────────

export async function listStoreProducts(input?: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listProducts(input);
	} catch {
		return null;
	}
}

/** Filterable storefront grid + facets (categoryCounts, priceRange) plus
 *  per-card price / ratings / badges — the data behind a platform-style shop
 *  listing. Returns null when unconfigured or the endpoint is unavailable. */
export async function listStoreProductsWithMeta(input?: {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";
	limit?: number;
}) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listProductsWithMeta(input);
	} catch {
		return null;
	}
}

/** Org product categories for the storefront sidebar (supplies names for the
 *  `categoryCounts` ids returned by `listProductsWithMeta`). */
export async function listStoreCategories() {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listCategories();
	} catch {
		return null;
	}
}

export async function getStoreProduct(productId: string) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getProduct(productId);
	} catch {
		return null;
	}
}

/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
export async function getStoreProductReviews(productId: string) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		const res = await biab.storefront.getProductReviews(productId, {
			limit: 20,
		});
		// 0.9.54+ returns a bare [] when the product has no reviews — normalize
		// to the page shape or null so callers narrow on one union.
		return Array.isArray(res) ? null : res;
	} catch {
		return null;
	}
}

/** "You may also like" recommendations for a product. */
export async function getStoreRelatedProducts(productId: string) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		const res = await biab.storefront.getRelatedProducts(productId, {
			limit: 6,
		});
		// 0.9.54+ returns either a bare array or a page object — normalize to
		// the plain array the route maps over.
		return Array.isArray(res) ? res : res.items;
	} catch {
		return null;
	}
}

/** Companion / exclusive cross-sell addons for the "complete your X" rail. */
export async function getStoreProductAddons(productId: string) {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getProductAddons(productId);
	} catch {
		return null;
	}
}

export async function listStoreSubscriptions() {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.subscriptions.list();
	} catch {
		return null;
	}
}

// ── Cart reads ────────────────────────────────────────────────────────

/** Current cart snapshot for the request's visitor, or null when the store
 *  is unconfigured or the visitor has no cart yet. */
export async function getCartSnapshot(
	request: Request,
): Promise<CartSnapshot | null> {
	const biab = getBiab();
	if (!biab) return null;
	const token = await readVisitorToken(request);
	if (!token) return null;
	try {
		return await biab.cart.forVisitor(token).get();
	} catch {
		return null;
	}
}

// ── Cart mutations (called from route actions) ────────────────────────

export type CartMutationResult =
	| { ok: true; snapshot: CartSnapshot; setCookie?: string }
	| { ok: false; error: string };

/**
 * Run a cart mutation for the request's visitor, minting the token cookie
 * on first use. The returned `setCookie` (when present) must be attached to
 * the action's response so the cookie is persisted.
 */
async function mutateCart(
	request: Request,
	fn: (cart: VisitorCart) => Promise<CartSnapshot>,
): Promise<CartMutationResult> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const existing = await readVisitorToken(request);
	const token = existing ?? crypto.randomUUID();
	try {
		const snapshot = await fn(biab.cart.forVisitor(token));
		return existing
			? { ok: true, snapshot }
			: { ok: true, snapshot, setCookie: await serializeVisitorCookie(token) };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

export function addToCart(
	request: Request,
	input: { productId: string; variantId?: string | null; quantity?: number },
): Promise<CartMutationResult> {
	return mutateCart(request, (cart) =>
		cart.addItem({
			productId: input.productId,
			variantId: input.variantId ?? undefined,
			quantity: input.quantity ?? 1,
		}),
	);
}

export function updateCartItem(
	request: Request,
	itemId: string,
	quantity: number,
): Promise<CartMutationResult> {
	return mutateCart(request, (cart) => cart.updateItem(itemId, { quantity }));
}

export function removeCartItem(
	request: Request,
	itemId: string,
): Promise<CartMutationResult> {
	return mutateCart(request, (cart) => cart.removeItem(itemId));
}

export function applyCartCoupon(
	request: Request,
	code: string,
): Promise<CartMutationResult> {
	return mutateCart(request, (cart) => cart.applyCoupon({ code }));
}

export function removeCartCoupon(
	request: Request,
): Promise<CartMutationResult> {
	return mutateCart(request, (cart) => cart.removeCoupon());
}

export function clearCart(request: Request): Promise<CartMutationResult> {
	return mutateCart(request, (cart) => cart.clear());
}

// ── Checkout ──────────────────────────────────────────────────────────

/** Start Stripe-hosted checkout; returns the URL to redirect to. `origin`
 *  is the request origin for absolute success/cancel URLs. */
export async function startCheckout(
	request: Request,
	origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const token = await readVisitorToken(request);
	if (!token) return { ok: false, error: "Your cart is empty." };
	try {
		const res = await biab.checkout.forVisitor(token).start({
			successUrl: `${origin}/store/cart?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/cart`,
		});
		return { ok: true, url: res.stripeUrl };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

/** Start Stripe-hosted checkout for a recurring subscription offering. */
export async function startSubscriptionCheckout(
	offeringId: string,
	origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	try {
		const res = await biab.subscriptions.startCheckout(offeringId, {
			successUrl: `${origin}/store/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/subscriptions`,
		});
		return { ok: true, url: res.stripeUrl };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

// ── Display helpers ───────────────────────────────────────────────────

// `formatCents` lives in the shared (non-server) `format.ts` so client
// components (e.g. the cart) can use it without pulling this server module
// into the browser bundle. Re-exported here for loader-side convenience.
export { formatCents } from "./format";
