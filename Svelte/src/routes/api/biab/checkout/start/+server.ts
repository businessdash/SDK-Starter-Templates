import { json } from "@sveltejs/kit";

import { startCheckout } from "$lib/server/biab-store";

import type { RequestHandler } from "./$types";

/**
 * POST /api/biab/checkout/start — convert the visitor's saved cart into a
 * Stripe Checkout Session and return its hosted URL. The browser then
 * navigates there to pay. `successUrl`/`cancelUrl` are derived from this
 * request's origin so the customer returns to this site afterwards.
 */
export const POST: RequestHandler = async ({ cookies, url }) => {
	const result = await startCheckout(cookies, url.origin);
	return json(result);
};
