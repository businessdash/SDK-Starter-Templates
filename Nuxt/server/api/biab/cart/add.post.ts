/**
 * POST /api/biab/cart/add
 *
 * Add a product (optionally a specific variant) to the visitor's
 * cart. Mints the `biab_cart_visitor` cookie on first use.
 */
export default defineEventHandler(async (event) => {
	const body = await readBody<{
		productId: string;
		variantId?: string | null;
		quantity?: number;
	}>(event);
	return runCartMutation(event, (cart) =>
		cart.addItem({
			productId: body.productId,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
		}),
	);
});
