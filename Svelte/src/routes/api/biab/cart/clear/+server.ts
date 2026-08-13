import { json } from "@sveltejs/kit";

import { runCartMutation } from "$lib/server/biab-store";

import type { RequestHandler } from "./$types";

/**
 * POST /api/biab/cart/clear — empty all items + drop the coupon, keeping
 * the cart row itself. Returns the now-empty cart snapshot.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const result = await runCartMutation(cookies, (cart) => cart.clear());
	return json(result);
};
