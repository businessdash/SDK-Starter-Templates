/**
 * Server-only storefront helpers — thin wrappers over the SDK's
 * `storefront` / `cart` / `checkout` / `subscriptions` / `coupons`
 * resources. Imported only from `routeLoader$` / `server$` / endpoint
 * call sites, so Qwik's optimizer keeps the bearer key out of the
 * client bundle.
 *
 * The cart is keyed on a visitor token WE own — an httpOnly cookie
 * named `biab_cart_visitor`. Reads pass the existing token (or null);
 * mutations mint it on first use. Qwik exposes the cookie jar through
 * the RequestEvent `cookie` API, which is available inside loaders,
 * `server$` functions, and request handlers.
 */

import type { BiabClient } from "@businessdash/sdk";
import type {
	CartSnapshot,
	StorefrontAddonsResponse,
	StorefrontCategoriesResponse,
	StorefrontListProductsResponse,
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontProductsWithMetaResponse,
	StorefrontRelatedProductsResponse,
	StorefrontSort,
	SubscriptionOfferingsListResponse,
} from "@businessdash/sdk/contracts";
import type { Cookie } from "@builder.io/qwik-city";

import { getBiab } from "./biab";

/** The visitor-bound cart client the mutation helpers operate on. */
type VisitorCart = ReturnType<BiabClient["cart"]["forVisitor"]>;

const VISITOR_COOKIE = "biab_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Whether the SDK is configured at all (env present). Lets the UI show a
 *  "store not connected" state instead of an empty grid. */
export function isStoreConfigured(): boolean {
	return getBiab() !== null;
}

/** The error message a thrown SDK call surfaces (BiabApiError carries one). */
export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Read-only: the current visitor's cart token, or null if none yet. Safe to
 *  call from a loader — it never writes the cookie. */
export function getVisitorToken(cookie: Cookie): string | null {
	return cookie.get(VISITOR_COOKIE)?.value ?? null;
}

/** Mint + set the visitor token cookie on first use. Call from a mutation
 *  (`server$` / endpoint), never from render — it writes a Set-Cookie header. */
export function ensureVisitorToken(cookie: Cookie): string {
	const existing = cookie.get(VISITOR_COOKIE)?.value;
	if (existing) return existing;
	const token = crypto.randomUUID();
	cookie.set(VISITOR_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: VISITOR_MAX_AGE,
	});
	return token;
}

export async function listStoreProducts(input?: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}): Promise<StorefrontListProductsResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listProducts(input);
	} catch {
		return null;
	}
}

/** Filterable storefront grid + facets (categoryCounts, priceRange) plus per-card
 *  price/ratings/badges — the data behind the platform-style shop listing. */
export async function listStoreProductsWithMeta(input?: {
	search?: string;
	categoryId?: string;
	minPriceCents?: number;
	maxPriceCents?: number;
	minRating?: number;
	sort?: StorefrontSort;
	limit?: number;
}): Promise<StorefrontProductsWithMetaResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listProductsWithMeta(input);
	} catch {
		return null;
	}
}

/** Org product categories for the storefront sidebar. */
export async function listStoreCategories(): Promise<StorefrontCategoriesResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.listCategories();
	} catch {
		return null;
	}
}

export async function getStoreProduct(
	productId: string,
): Promise<StorefrontProductDetail | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getProduct(productId);
	} catch {
		return null;
	}
}

/** Approved reviews + aggregate (avgRating, totalCount) for a product. */
export async function getStoreProductReviews(
	productId: string,
	input?: { limit?: number },
): Promise<StorefrontProductReviewsResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getProductReviews(productId, input);
	} catch {
		return null;
	}
}

/** "You may also like" recommendations for a product. */
export async function getStoreRelatedProducts(
	productId: string,
	input?: { limit?: number },
): Promise<StorefrontRelatedProductsResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getRelatedProducts(productId, input);
	} catch {
		return null;
	}
}

/** Companion / exclusive cross-sell addons for the "complete your X" rail. */
export async function getStoreProductAddons(
	productId: string,
): Promise<StorefrontAddonsResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.storefront.getProductAddons(productId);
	} catch {
		return null;
	}
}

export async function listStoreSubscriptions(): Promise<SubscriptionOfferingsListResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.subscriptions.list();
	} catch {
		return null;
	}
}

/** Current cart snapshot, or null when unconfigured or no cart exists yet (no
 *  visitor token). Pure read — never mints the cookie. */
export async function getCartSnapshot(
	cookie: Cookie,
): Promise<CartSnapshot | null> {
	const biab = getBiab();
	if (!biab) return null;
	const token = getVisitorToken(cookie);
	if (!token) return null;
	try {
		return await biab.cart.forVisitor(token).get();
	} catch {
		return null;
	}
}

export type CartActionResult =
	| { ok: true; snapshot: CartSnapshot }
	| { ok: false; error: string };

/** Run a cart mutation against a freshly-minted-or-existing visitor cart. */
async function runCart(
	cookie: Cookie,
	fn: (cart: VisitorCart) => Promise<CartSnapshot>,
): Promise<CartActionResult> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const token = ensureVisitorToken(cookie);
	try {
		const snapshot = await fn(biab.cart.forVisitor(token));
		return { ok: true, snapshot };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

export function addToCart(
	cookie: Cookie,
	input: { productId: string; variantId?: string | null; quantity?: number },
): Promise<CartActionResult> {
	return runCart(cookie, (cart) =>
		cart.addItem({
			productId: input.productId,
			variantId: input.variantId ?? undefined,
			quantity: input.quantity ?? 1,
		}),
	);
}

export function updateCartItem(
	cookie: Cookie,
	itemId: string,
	quantity: number,
): Promise<CartActionResult> {
	return runCart(cookie, (cart) => cart.updateItem(itemId, { quantity }));
}

export function removeCartItem(
	cookie: Cookie,
	itemId: string,
): Promise<CartActionResult> {
	return runCart(cookie, (cart) => cart.removeItem(itemId));
}

export function applyCartCoupon(
	cookie: Cookie,
	code: string,
): Promise<CartActionResult> {
	return runCart(cookie, (cart) => cart.applyCoupon({ code }));
}

export function removeCartCoupon(cookie: Cookie): Promise<CartActionResult> {
	return runCart(cookie, (cart) => cart.removeCoupon());
}

export function clearCart(cookie: Cookie): Promise<CartActionResult> {
	return runCart(cookie, (cart) => cart.clear());
}

/** Start Stripe-hosted checkout; returns the URL to redirect to. `origin`
 *  comes from the request for absolute success/cancel return URLs. */
export async function startCheckout(
	cookie: Cookie,
	origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const token = getVisitorToken(cookie);
	if (!token) return { ok: false, error: "Your cart is empty." };
	try {
		const res = await biab.checkout.forVisitor(token).start({
			successUrl: `${origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/cart`,
		});
		return { ok: true, url: res.stripeUrl };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

/** Cents → display string, e.g. 1299 + "usd" → "$12.99". */
export function formatMoney(cents: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(cents / 100);
	} catch {
		return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
	}
}
