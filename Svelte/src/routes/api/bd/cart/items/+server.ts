// [bd-file:store]
import { error } from '@sveltejs/kit';

import { runCartMutation } from '#lib/server/bd-store.ts';

import type { RequestHandler } from './$types';

/**
 * POST /api/bd/cart/items — add a product (optionally a variant) to the
 * cart. Mints the `bd_cart_visitor` cookie on first use. Body:
 * `{ productId, variantId?, quantity?, options? }`, where `options` holds the
 * choices made on the product page ({ Size: "M" }). Returns the new cart
 * snapshot.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = (await request.json().catch(() => null)) as {
		productId?: string;
		variantId?: string | null;
		quantity?: number;
		options?: Record<string, string>;
	} | null;
	if (!body?.productId) throw error(400, 'productId required');
	const result = await runCartMutation(cookies, (cart) =>
		cart.addItem({
			productId: body.productId as string,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
			options: body.options && typeof body.options === 'object' ? body.options : undefined
		})
	);
	return Response.json(result);
};
