import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/cart/remove  { itemId }
 *
 * Drop a line item. Returns the new `CartSnapshot`.
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
		const body = (await request.json()) as { itemId: string };
		if (!body.itemId) {
			return Response.json({ error: "itemId required" }, { status: 400 });
		}
		const cart = await biab.cart.forVisitor(token).removeItem(body.itemId);
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
