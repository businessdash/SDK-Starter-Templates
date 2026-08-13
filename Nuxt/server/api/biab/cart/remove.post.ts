/**
 * POST /api/biab/cart/remove
 *
 * Remove a single line item from the visitor's cart.
 */
export default defineEventHandler(async (event) => {
	const body = await readBody<{ itemId: string }>(event);
	return runCartMutation(event, (cart) => cart.removeItem(body.itemId));
});
