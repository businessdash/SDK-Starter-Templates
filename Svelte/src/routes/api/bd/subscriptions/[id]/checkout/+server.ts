import { error, json } from "@sveltejs/kit";

import { bd } from "$lib/server/bd";
import { sdkErrorMessage } from "$lib/server/bd-store";

import type { RequestHandler } from "./$types";

/**
 * POST /api/bd/subscriptions/[id]/checkout — hand the customer off to
 * Stripe-hosted Checkout in subscription mode. Returns the Stripe URL to
 * navigate to. Requires the offering to be Stripe-synced in the dashboard
 * (otherwise the SDK returns 409 `subscription_not_synced`).
 */
export const POST: RequestHandler = async ({ params, url }) => {
	if (!bd) {
		return json({ ok: false, error: "Store isn't connected (missing BD env)." });
	}
	const id = params.id;
	if (!id) throw error(400, "id required");
	try {
		const res = await bd.subscriptions.startCheckout(id, {
			successUrl: `${url.origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${url.origin}/store/subscriptions`,
		});
		return json({ ok: true, url: res.stripeUrl });
	} catch (err) {
		return json({ ok: false, error: sdkErrorMessage(err) });
	}
};
