import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { ensureVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/cart/add  { productId, variantId?, quantity? }
 *
 * Add a product (optionally a variant) to the visitor's cart. Mints the
 * `biab_cart_visitor` cookie on first use. Returns the new `CartSnapshot`.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!biab) {
		return Response.json(
			{ error: "Store isn't connected (missing BIAB env)." },
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
		const cart = await biab.cart.forVisitor(token).addItem({
			productId: body.productId,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
		});
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
