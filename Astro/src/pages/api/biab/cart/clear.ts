import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/cart/clear
 *
 * Empty the visitor's cart. Returns the (now-empty) `CartSnapshot`.
 */
export const POST: APIRoute = async ({ cookies }) => {
	if (!biab) {
		return Response.json(
			{ error: "Store isn't connected (missing BIAB env)." },
			{ status: 503 },
		);
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ error: "No cart yet." }, { status: 400 });
	try {
		const cart = await biab.cart.forVisitor(token).clear();
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
