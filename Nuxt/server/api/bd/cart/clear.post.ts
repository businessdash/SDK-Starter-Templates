/**
 * POST /api/bd/cart/clear
 *
 * Empty the visitor's cart (keeps the visitor token so a fresh cart
 * reuses the same identity).
 */
export default defineEventHandler(async (event) =>
	runCartMutation(event, (cart) => cart.clear()),
);
