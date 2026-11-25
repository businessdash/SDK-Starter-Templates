// [bd-file:store]
/**
 * POST /api/bd/cart/add
 *
 * Add a product (optionally a specific variant, and the options chosen
 * for it, such as `{ Size: "42" }`) to the visitor's cart. Mints the
 * `bd_cart_visitor` cookie on first use. The cart prices the options.
 */
export default defineEventHandler(async (event) => {
	const body = await readBody<{
		productId: string;
		variantId?: string | null;
		quantity?: number;
		options?: Record<string, string> | null;
	}>(event);
	return runCartMutation(event, (cart) =>
		cart.addItem({
			productId: body.productId,
			variantId: body.variantId ?? undefined,
			quantity: body.quantity ?? 1,
			...(body.options && Object.keys(body.options).length > 0
				? { options: body.options }
				: {}),
		}),
	);
});
