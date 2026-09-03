import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { ensureVisitorToken, sdkErrorMessage } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * POST /api/bd/cart/add  { productId, variantId?, quantity? }
 *
 * Add a product (optionally a variant) to the visitor's cart. Mints the
 * `bd_cart_visitor` cookie on first use. Returns the new `CartSnapshot`.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!bd) {
		return Response.json(
			{ error: "Store isn't connected (missing BD env)." },
			{ status: 503 },
		);
	}
	try {
		const body = (await request.json()) as {
			productId: string;
			variantId?: string | null;
			quantity?: number;
		};
		if (!body.productId) {
			return Response.json({ error: "productId required" }, { status: 400 });
		}
		const token = ensureVisitorToken(cookies);
		const cart = await bd.cart.forVisitor(token).addItem({
			productId: body.productId,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
		});
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
