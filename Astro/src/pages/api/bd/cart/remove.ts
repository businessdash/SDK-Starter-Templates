import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * POST /api/bd/cart/remove  { itemId }
 *
 * Drop a line item. Returns the new `CartSnapshot`.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!bd) {
		return Response.json(
			{ error: "Store isn't connected (missing BD env)." },
			{ status: 503 },
		);
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ error: "No cart yet." }, { status: 400 });
	try {
		const body = (await request.json()) as { itemId: string };
		if (!body.itemId) {
			return Response.json({ error: "itemId required" }, { status: 400 });
		}
		const cart = await bd.cart.forVisitor(token).removeItem(body.itemId);
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
