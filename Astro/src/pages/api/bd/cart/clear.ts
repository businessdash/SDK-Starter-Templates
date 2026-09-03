import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * POST /api/bd/cart/clear
 *
 * Empty the visitor's cart. Returns the (now-empty) `CartSnapshot`.
 */
export const POST: APIRoute = async ({ cookies }) => {
	if (!bd) {
		return Response.json(
			{ error: "Store isn't connected (missing BD env)." },
			{ status: 503 },
		);
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ error: "No cart yet." }, { status: 400 });
	try {
		const cart = await bd.cart.forVisitor(token).clear();
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
