import type { H3Event } from "h3";
import type { CartSnapshot } from "@businessdash/sdk/contracts";

/**
 * Visitor-token cart helpers. The cart is keyed on a UUID we own,
 * stored in an httpOnly cookie named `biab_cart_visitor` (same name
 * the other BIAB starters + the DGP reference consumer use). The
 * browser never sees the BIAB API key; it only carries this opaque
 * visitor token.
 *
 * - `readVisitorToken(event)` — read-only; null when there's no cart yet.
 * - `ensureVisitorToken(event)` — mint + set the cookie on first mutation.
 */

const VISITOR_COOKIE = "biab_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Read the current visitor token, or null if the cart hasn't been touched. */
export function readVisitorToken(event: H3Event): string | null {
	return getCookie(event, VISITOR_COOKIE) ?? null;
}

/** Return the visitor token, minting + setting the httpOnly cookie on first use. */
export function ensureVisitorToken(event: H3Event): string {
	const existing = getCookie(event, VISITOR_COOKIE);
	if (existing) return existing;
	const token = globalThis.crypto.randomUUID();
	setCookie(event, VISITOR_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: VISITOR_MAX_AGE,
	});
	return token;
}

/** The error message a thrown SDK call surfaces (BiabApiError carries one). */
export function sdkErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** A bound visitor cart client (from `biab.cart.forVisitor(token)`). */
type VisitorCart = ReturnType<
	NonNullable<ReturnType<typeof getBiab>>["cart"]["forVisitor"]
>;

export type CartActionResult =
	| { ok: true; cart: CartSnapshot }
	| { ok: false; error: string };

/**
 * Shared runner for the cart-mutation endpoints. Resolves the
 * visitor-scoped cart client (minting the cookie on first use),
 * applies the mutation, and returns a plain serializable result. The
 * Vue store page just swaps in `result.cart` on success.
 */
export async function runCartMutation(
	event: H3Event,
	fn: (cart: VisitorCart) => Promise<CartSnapshot>,
): Promise<CartActionResult> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const token = ensureVisitorToken(event);
	try {
		const cart = await fn(biab.cart.forVisitor(token));
		return { ok: true, cart };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}
