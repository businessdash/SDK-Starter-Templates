// [bd-file:store]
import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { ensureVisitorToken, sdkErrorMessage } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * POST /api/bd/cart/add  { productId, variantId?, quantity?, options? }
 *
 * Add a product (optionally a variant, and the option values chosen on the
 * product page) to the visitor's cart. Mints the `bd_cart_visitor` cookie on
 * first use. Returns `{ ok, itemCount, cart }` with the new `CartSnapshot`,
 * or `{ ok: false, error }`.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!bd) {
		return Response.json(
			{ ok: false, error: "Store isn't connected (missing BD env)." },
			{ status: 503 },
		);
	}
	try {
		const body = (await request.json()) as {
			productId: string;
			variantId?: string | null;
			quantity?: number;
			options?: Record<string, string>;
		};
		if (!body.productId) {
			return Response.json(
				{ ok: false, error: "productId required" },
				{ status: 400 },
			);
		}
		const token = ensureVisitorToken(cookies);
		const cart = await bd.cart.forVisitor(token).addItem({
			productId: body.productId,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
			...(body.options && Object.keys(body.options).length > 0
				? { options: body.options }
				: {}),
		});
		return Response.json({ ok: true, itemCount: cart.itemCount, cart });
	} catch (err) {
		return Response.json(
			{ ok: false, error: sdkErrorMessage(err) },
			{ status: 400 },
		);
	}
};
