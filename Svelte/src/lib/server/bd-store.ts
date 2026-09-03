import { env } from "$env/dynamic/private";

import type { Cookies } from "@sveltejs/kit";
import type { BdClient } from "@businessdash/sdk";
import type {
	CartSnapshot,
	CheckoutStartResponse,
	StorefrontAddon,
	StorefrontCategoriesResponse,
	StorefrontListProductsResponse,
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontProductsWithMetaResponse,
	StorefrontRelatedProduct,
	StorefrontSort,
	SubscriptionOffering,
} from "@businessdash/sdk/contracts";

import { bd } from "$lib/server/bd";

/**
 * Server-only storefront helpers — thin wrappers over the SDK's
 * `storefront` / `cart` / `checkout` / `subscriptions` resources.
 *
 * The cart is keyed on a visitor token THIS app owns: a UUID we mint
 * into the httpOnly `bd_cart_visitor` cookie on the first cart
 * mutation. Reads (`getCartSnapshot`) never set the cookie, so they're
 * safe in a `+page.server.ts` load; mutations call `ensureVisitorToken`
 * which sets it. The bearer key stays on the server — the browser only
 * ever talks to the `+server.ts` cart endpoints, never the SDK.
 *
 * Every call no-ops gracefully (returns `null`) when BD env is unset,
 * so the storefront still renders an "not connected" placeholder.
 */

export const VISITOR_COOKIE = "bd_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Whether the storefront can talk to BD at all. */
export function isStoreConfigured(): boolean {
	return bd !== null;
}

/** The error message a thrown SDK call surfaces (BdApiError carries one). */
export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Read-only: the current visitor's cart token, or null if none yet. */
export function getVisitorToken(cookies: Cookies): string | null {
	return cookies.get(VISITOR_COOKIE) ?? null;
}

/** Mutation path: return the visitor token, minting + setting the cookie on
 *  first use. Call only from endpoints/actions that may write cookies. */
export function ensureVisitorToken(cookies: Cookies): string {
	const existing = cookies.get(VISITOR_COOKIE);
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

function devwarn(label: string, err: unknown): void {
	if (env.NODE_ENV === "development") {
		console.warn(`[bd-store] ${label} failed: ${sdkErrorMessage(err)}`);
	}
}

export async function listStoreProducts(input?: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}): Promise<StorefrontListProductsResponse | null> {
	if (!bd) return null;
	try {
		return await bd.storefront.listProducts(input);
	} catch (err) {
		devwarn("storefront.listProducts", err);
		return null;
	}
}

/** Filterable storefront grid + facets (categoryCounts, priceRange) plus
 *  per-card price/ratings/badges — the data behind the platform-style shop
 *  listing. Returns null when unconfigured or the endpoint is unavailable. */
export async function listStoreProductsWithMeta(input?: {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: StorefrontSort;
	limit?: number;
}): Promise<StorefrontProductsWithMetaResponse | null> {
	if (!bd) return null;
	try {
		return await bd.storefront.listProductsWithMeta(input);
	} catch (err) {
		devwarn("storefront.listProductsWithMeta", err);
		return null;
	}
}

/** Org product categories for the storefront sidebar. */
export async function listStoreCategories(): Promise<
	StorefrontCategoriesResponse | null
> {
	if (!bd) return null;
	try {
		return await bd.storefront.listCategories();
	} catch (err) {
		devwarn("storefront.listCategories", err);
		return null;
	}
}

/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
export async function getStoreProductReviews(
	productId: string,
	input?: { limit?: number },
): Promise<StorefrontProductReviewsResponse | null> {
	if (!bd) return null;
	try {
		return await bd.storefront.getProductReviews(productId, {
			limit: input?.limit ?? 20,
		});
	} catch (err) {
		devwarn("storefront.getProductReviews", err);
		return null;
	}
}

/** "You may also like" recommendations for a product. */
export async function getStoreRelatedProducts(
	productId: string,
	input?: { limit?: number },
): Promise<StorefrontRelatedProduct[] | null> {
	if (!bd) return null;
	try {
		const res = await bd.storefront.getRelatedProducts(productId, {
			limit: input?.limit ?? 6,
		});
		return res.items;
	} catch (err) {
		devwarn("storefront.getRelatedProducts", err);
		return null;
	}
}

/** Companion / cross-sell addons for a product ("complete your purchase"). */
export async function getStoreProductAddons(
	productId: string,
): Promise<StorefrontAddon[] | null> {
	if (!bd) return null;
	try {
		const res = await bd.storefront.getProductAddons(productId);
		return res.items;
	} catch (err) {
		devwarn("storefront.getProductAddons", err);
		return null;
	}
}

export async function getStoreProduct(
	productId: string,
): Promise<StorefrontProductDetail | null> {
	if (!bd) return null;
	try {
		return await bd.storefront.getProduct(productId);
	} catch (err) {
		devwarn("storefront.getProduct", err);
		return null;
	}
}

export async function listStoreSubscriptions(): Promise<
	{ items: SubscriptionOffering[] } | null
> {
	if (!bd) return null;
	try {
		return await bd.subscriptions.list();
	} catch (err) {
		devwarn("subscriptions.list", err);
		return null;
	}
}

/** Current cart snapshot, or null when unconfigured / no visitor token yet. */
export async function getCartSnapshot(
	cookies: Cookies,
): Promise<CartSnapshot | null> {
	if (!bd) return null;
	const token = getVisitorToken(cookies);
	if (!token) return null;
	try {
		return await bd.cart.forVisitor(token).get();
	} catch (err) {
		devwarn("cart.get", err);
		return null;
	}
}

export type CartMutationResult =
	| { ok: true; snapshot: CartSnapshot }
	| { ok: false; error: string };

/** Resolve a visitor-scoped cart client, minting the cookie if needed. */
function cartClient(cookies: Cookies): ReturnType<BdClient["cart"]["forVisitor"]> | null {
	if (!bd) return null;
	const token = ensureVisitorToken(cookies);
	return bd.cart.forVisitor(token);
}

/** Run a cart mutation and return a serializable result. */
export async function runCartMutation(
	cookies: Cookies,
	fn: (
		cart: NonNullable<ReturnType<typeof cartClient>>,
	) => Promise<CartSnapshot>,
): Promise<CartMutationResult> {
	const cart = cartClient(cookies);
	if (!cart) {
		return { ok: false, error: "Store isn't connected (missing BD env)." };
	}
	try {
		return { ok: true, snapshot: await fn(cart) };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

/** Start Stripe-hosted checkout; returns the URL to redirect the browser to.
 *  `origin` is this site's origin (from the request) for absolute return URLs. */
export async function startCheckout(
	cookies: Cookies,
	origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (!bd) {
		return { ok: false, error: "Store isn't connected (missing BD env)." };
	}
	const token = getVisitorToken(cookies);
	if (!token) return { ok: false, error: "Your cart is empty." };
	try {
		const res: CheckoutStartResponse = await bd.checkout
			.forVisitor(token)
			.start({
				successUrl: `${origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
				cancelUrl: `${origin}/store/cart`,
			});
		return { ok: true, url: res.stripeUrl };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}
