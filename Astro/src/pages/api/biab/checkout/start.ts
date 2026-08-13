import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken, sdkErrorMessage } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * POST /api/biab/checkout/start
 *
 * Start Stripe-hosted checkout for the visitor's cart and return the Stripe
 * URL to redirect to. `successUrl` / `cancelUrl` are built from the request
 * origin so the shopper lands back on this site after paying.
 */
export const POST: APIRoute = async ({ cookies, url }) => {
	if (!biab) {
		return Response.json(
			{ error: "Store isn't connected (missing BIAB env)." },
			{ status: 503 },
		);
	}
	const token = getVisitorToken(cookies);
	if (!token) {
		return Response.json({ error: "Your cart is empty." }, { status: 400 });
	}
	const origin = url.origin;
	try {
		const res = await biab.checkout.forVisitor(token).start({
			successUrl: `${origin}/store/cart?status=success&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/cart?status=cancelled`,
		});
		return Response.json({ url: res.stripeUrl });
	} catch (err) {
		return Response.json({ error: sdkErrorMessage(err) }, { status: 400 });
	}
};
