import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * POST /api/bd/cart/update  { itemId, quantity }
 *
 * Set a line item's quantity (0 removes it). Returns the new `CartSnapshot`.
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
		const cart = await bd.cart
			.forVisitor(token)
			.updateItem(body.itemId, { quantity: body.quantity });
		return Response.json({ cart });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
