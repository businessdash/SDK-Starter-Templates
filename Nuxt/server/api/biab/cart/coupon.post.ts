/**
 * POST /api/biab/cart/coupon
 *
 * Apply a coupon code, or remove the current one. Pass a non-empty
 * `code` to apply; pass an empty/omitted `code` to remove.
 */
export default defineEventHandler(async (event) => {
	const body = await readBody<{ code?: string | null }>(event);
	const code = body.code?.trim();
	if (code) {
		return runCartMutation(event, (cart) => cart.applyCoupon({ code }));
	}
	return runCartMutation(event, (cart) => cart.removeCoupon());
});
