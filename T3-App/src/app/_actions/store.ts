"use server";

import type { CartSnapshot } from "@businessdash/sdk/contracts";
import { revalidatePath } from "next/cache";

import { getBiab } from "@/server/lib/biab";
import {
	ensureVisitorToken,
	getCartSnapshot,
	getVisitorToken,
	sdkErrorMessage,
} from "@/server/lib/biab-store";

/**
 * Cart + checkout Server Actions for the `/store` surface. The SDK runs
 * server-side (secret API key); client components call these and get a plain,
 * serializable result back. Cart writes mint the visitor-token cookie on
 * first use.
 */

export type CartActionResult =
	| { ok: true; snapshot: CartSnapshot }
	| { ok: false; error: string };

/** Resolve a visitor-scoped cart client, minting the cookie if needed. */
async function cartClient() {
	const biab = getBiab();
	if (!biab) return null;
	const token = await ensureVisitorToken();
	return biab.cart.forVisitor(token);
}

async function run(
	fn: (
		cart: NonNullable<Awaited<ReturnType<typeof cartClient>>>,
	) => Promise<CartSnapshot>,
): Promise<CartActionResult> {
	const cart = await cartClient();
	if (!cart) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	try {
		const snapshot = await fn(cart);
		revalidatePath("/store/cart");
		return { ok: true, snapshot };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}

/** Item count for the current visitor's cart (0 when empty/unconnected). */
export async function getCartCountAction(): Promise<number> {
	const snapshot = await getCartSnapshot();
	return snapshot?.itemCount ?? 0;
}

export async function addToCartAction(input: {
	productId: string;
	variantId?: string | null;
	quantity?: number;
}): Promise<CartActionResult> {
	return run((cart) =>
		cart.addItem({
			productId: input.productId,
			variantId: input.variantId ?? undefined,
			quantity: input.quantity ?? 1,
		}),
	);
}

export async function updateCartItemAction(
	itemId: string,
	quantity: number,
): Promise<CartActionResult> {
	return run((cart) => cart.updateItem(itemId, { quantity }));
}

export async function removeCartItemAction(
	itemId: string,
): Promise<CartActionResult> {
	return run((cart) => cart.removeItem(itemId));
}

export async function applyCouponAction(
	code: string,
): Promise<CartActionResult> {
	return run((cart) => cart.applyCoupon({ code }));
}

export async function removeCouponAction(): Promise<CartActionResult> {
	return run((cart) => cart.removeCoupon());
}

export async function clearCartAction(): Promise<CartActionResult> {
	return run((cart) => cart.clear());
}

/** Start Stripe-hosted checkout; returns the URL to redirect to. `origin`
 *  comes from the client (window.location.origin) for absolute return URLs. */
export async function startCheckoutAction(
	origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const biab = getBiab();
	if (!biab) {
		return { ok: false, error: "Store isn't connected (missing BIAB env)." };
	}
	const token = await getVisitorToken();
	if (!token) return { ok: false, error: "Your cart is empty." };
	try {
		const res = await biab.checkout.forVisitor(token).start({
			successUrl: `${origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/cart`,
		});
		return { ok: true, url: res.stripeUrl };
	} catch (err) {
		return { ok: false, error: sdkErrorMessage(err) };
	}
}
