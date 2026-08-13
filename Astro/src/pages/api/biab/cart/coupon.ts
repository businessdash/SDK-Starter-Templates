import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/cart/coupon  { code }  → apply a coupon.
 * POST /api/biab/cart/coupon  { }       → remove the current coupon.
 *
 * Returns the new `CartSnapshot` (with `couponCode` / discount reflected).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!biab) {
		return Response.json(
			{ error: "Store isn't connected (missing BIAB env)." },
			{ status: 503 },
		);
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ error: "No cart yet." }, { status: 400 });
	try {
		const body = (await request.json().catch(() => ({}))) as {
			code?: string;
		};
		const cart = body.code
			? await biab.cart.forVisitor(token).applyCoupon({ code: body.code })
			: await biab.cart.forVisitor(token).removeCoupon();
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
