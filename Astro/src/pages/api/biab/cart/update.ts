import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/cart/update  { itemId, quantity }
 *
 * Set a line item's quantity (0 removes it). Returns the new `CartSnapshot`.
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
		const body = (await request.json()) as {
			itemId: string;
			quantity: number;
		};
		if (!body.itemId || typeof body.quantity !== "number") {
			return Response.json(
				{ error: "itemId and quantity required" },
				{ status: 400 },
			);
		}
		const cart = await biab.cart
			.forVisitor(token)
			.updateItem(body.itemId, { quantity: body.quantity });
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
