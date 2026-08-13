import { error, json } from "@sveltejs/kit";

import { runCartMutation } from "$lib/server/biab-store";

import type { RequestHandler } from "./$types";

/**
 * PATCH /api/biab/cart/items/[itemId] — set a line's quantity
 * (`{ quantity }`, 0 deletes the line). DELETE removes the line outright.
 * Both return the new cart snapshot.
 */
export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const itemId = params.itemId;
	if (!itemId) throw error(400, "itemId required");
	const body = (await request.json().catch(() => null)) as {
		quantity?: number;
	} | null;
	if (typeof body?.quantity !== "number") throw error(400, "quantity required");
	const result = await runCartMutation(cookies, (cart) =>
		cart.updateItem(itemId, { quantity: body.quantity as number }),
	);
	return json(result);
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const itemId = params.itemId;
	if (!itemId) throw error(400, "itemId required");
	const result = await runCartMutation(cookies, (cart) =>
		cart.removeItem(itemId),
	);
	return json(result);
};
