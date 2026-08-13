import { error, json } from "@sveltejs/kit";

import { runCartMutation } from "$lib/server/biab-store";

import type { RequestHandler } from "./$types";

/**
 * POST /api/biab/cart/coupon — stamp a coupon code (`{ code }`).
 * DELETE /api/biab/cart/coupon — remove the stamped coupon.
 *
 * Codes are validated at checkout, so stamping an invalid one is a no-op
 * here. Both return the new cart snapshot.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = (await request.json().catch(() => null)) as {
		code?: string;
	} | null;
	if (!body?.code) throw error(400, "code required");
	const result = await runCartMutation(cookies, (cart) =>
		cart.applyCoupon({ code: body.code as string }),
	);
	return json(result);
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const result = await runCartMutation(cookies, (cart) => cart.removeCoupon());
	return json(result);
};
