/**
 * POST /api/biab/cart/update
 *
 * Change the quantity of a line item. A quantity of 0 removes it
 * (the SDK accepts 0 as a delete).
 */
export default defineEventHandler(async (event) => {
	const body = await readBody<{ itemId: string; quantity: number }>(event);
	return runCartMutation(event, (cart) =>
		cart.updateItem(body.itemId, { quantity: body.quantity }),
	);
});
