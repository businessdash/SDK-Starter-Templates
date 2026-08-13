import { error, json } from "@sveltejs/kit";

import { runCartMutation } from "$lib/server/biab-store";

import type { RequestHandler } from "./$types";

/**
 * POST /api/biab/cart/items — add a product (optionally a variant) to the
 * cart. Mints the `biab_cart_visitor` cookie on first use. Body:
 * `{ productId, variantId?, quantity? }`. Returns the new cart snapshot.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = (await request.json().catch(() => null)) as {
		productId?: string;
		variantId?: string | null;
		quantity?: number;
	} | null;
	if (!body?.productId) throw error(400, "productId required");
	const result = await runCartMutation(cookies, (cart) =>
		cart.addItem({
			productId: body.productId as string,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
		}),
	);
	return json(result);
};
