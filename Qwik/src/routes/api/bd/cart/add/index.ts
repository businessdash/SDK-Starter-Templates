// [bd-file:store]
import type { RequestHandler } from "@builder.io/qwik-city";

import { getBd } from "../../../../../lib/bd";
import { ensureVisitorToken } from "../../../../../lib/bd-store";

/**
 * Add to the cart, for the product page: JSON `{ productId, variantId?,
 * quantity?, options? }` in; `{ ok, itemCount }` or `{ ok: false, error }`
 * out. The first add mints the visitor's cart cookie.
 */
export const onPost: RequestHandler = async ({ request, cookie, json }) => {
	const bd = getBd();
	if (!bd) {
		json(503, { ok: false, error: "The store isn't connected yet." });
		return;
	}
	// A JSON body only: a form on another site can't send one.
	if (!request.headers.get("content-type")?.includes("application/json")) {
		json(415, { ok: false, error: "Send JSON." });
		return;
	}
	const body = (await request.json().catch(() => null)) as {
		productId?: unknown;
		variantId?: unknown;
		quantity?: unknown;
		options?: unknown;
	} | null;
	const productId = typeof body?.productId === "string" ? body.productId : "";
	if (!productId) {
		json(400, { ok: false, error: "Choose a product." });
		return;
	}
	const quantity = Math.max(1, Math.min(99, Math.floor(Number(body?.quantity) || 1)));
	const options =
		body?.options && typeof body.options === "object"
			? Object.fromEntries(
					Object.entries(body.options as Record<string, unknown>).filter(
						(entry): entry is [string, string] => typeof entry[1] === "string",
					),
				)
			: {};
	try {
		const cart = await bd.cart.forVisitor(ensureVisitorToken(cookie)).addItem({
			productId,
			quantity,
			...(typeof body?.variantId === "string" && body.variantId ? { variantId: body.variantId } : {}),
			...(Object.keys(options).length > 0 ? { options } : {}),
		});
		json(200, { ok: true, itemCount: cart.itemCount });
	} catch {
		json(502, { ok: false, error: "Couldn't add that to your cart. Try again." });
	}
};
