import type { CartSnapshot } from "@businessdash/sdk/contracts";

/**
 * Browser-side cart helpers. These ONLY call this app's own
 * `/api/biab/cart/*` + `/api/biab/checkout/start` endpoints — never the
 * SDK directly — so the bearer key never reaches the client. Each call
 * resolves to the new `CartSnapshot` (or an error message).
 */

export type CartCallResult =
	| { ok: true; snapshot: CartSnapshot }
	| { ok: false; error: string };

async function send(
	input: string,
	init: RequestInit,
): Promise<CartCallResult> {
	try {
		const res = await fetch(input, init);
		const body = (await res.json().catch(() => null)) as CartCallResult | null;
		if (body && typeof body === "object" && "ok" in body) return body;
		return { ok: false, error: `Request failed (${res.status}).` };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Network error." };
	}
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function addToCart(input: {
	productId: string;
	variantId?: string | null;
	quantity?: number;
}): Promise<CartCallResult> {
	return send("/api/biab/cart/items", {
		method: "POST",
		headers: JSON_HEADERS,
		body: JSON.stringify(input),
	});
}

export function updateCartItem(
	itemId: string,
	quantity: number,
): Promise<CartCallResult> {
	return send(`/api/biab/cart/items/${encodeURIComponent(itemId)}`, {
		method: "PATCH",
		headers: JSON_HEADERS,
		body: JSON.stringify({ quantity }),
	});
}

export function removeCartItem(itemId: string): Promise<CartCallResult> {
	return send(`/api/biab/cart/items/${encodeURIComponent(itemId)}`, {
		method: "DELETE",
	});
}

export function applyCoupon(code: string): Promise<CartCallResult> {
	return send("/api/biab/cart/coupon", {
		method: "POST",
		headers: JSON_HEADERS,
		body: JSON.stringify({ code }),
	});
}

export function removeCoupon(): Promise<CartCallResult> {
	return send("/api/biab/cart/coupon", { method: "DELETE" });
}

export function clearCart(): Promise<CartCallResult> {
	return send("/api/biab/cart/clear", { method: "POST" });
}

/** Start Stripe checkout; resolves to the hosted URL to navigate to. */
export async function startCheckout(): Promise<
	{ ok: true; url: string } | { ok: false; error: string }
> {
	try {
		const res = await fetch("/api/biab/checkout/start", { method: "POST" });
		const body = (await res.json().catch(() => null)) as
			| { ok: true; url: string }
			| { ok: false; error: string }
			| null;
		if (body && "ok" in body) return body;
		return { ok: false, error: `Checkout failed (${res.status}).` };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Network error." };
	}
}

/** Format a dollar amount (cart `unitPrice`/`subtotal`, variant `price`). */
export function formatDollars(amount: number, currency = "USD"): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount);
	} catch {
		return `$${amount.toFixed(2)}`;
	}
}

/** Format integer cents (subscription `amountCents`, checkout totals). */
export function formatCents(amountCents: number, currency = "USD"): string {
	return formatDollars(amountCents / 100, currency);
}
