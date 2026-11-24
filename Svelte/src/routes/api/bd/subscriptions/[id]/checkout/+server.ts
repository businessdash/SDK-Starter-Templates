// [bd-file:saas]
import { error } from '@sveltejs/kit';

import { SESSION_COOKIE, startPlanCheckout } from '#lib/server/bd-portal.ts';
import { isStoreConfigured, sdkErrorMessage } from '#lib/server/bd-store.ts';

import type { RequestHandler } from './$types';

/**
 * POST /api/bd/subscriptions/[id]/checkout — hand the customer off to
 * Stripe-hosted Checkout in subscription mode. Returns the Stripe URL to
 * navigate to. Requires the offering to be Stripe-synced in the dashboard
 * (otherwise the SDK returns 409 `subscription_not_synced`).
 *
 * The plan is the signed-in customer's, so a visitor who isn't signed in
 * gets a 401 and the sign-in link to send them to.
 */
export const POST: RequestHandler = async ({ params, url, cookies }) => {
	if (!isStoreConfigured()) {
		return Response.json({ ok: false, error: "Store isn't connected (missing BD env)." });
	}
	const id = params.id;
	if (!id) throw error(400, 'id required');
	try {
		const res = await startPlanCheckout(cookies.get(SESSION_COOKIE), id, {
			successUrl: `${url.origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${url.origin}/store/subscriptions`
		});
		if (!res) {
			return Response.json(
				{
					ok: false,
					error: 'Sign in to subscribe.',
					signIn: '/my-account?next=/store/subscriptions'
				},
				{ status: 401 }
			);
		}
		return Response.json({ ok: true, url: res.url });
	} catch (err) {
		return Response.json({ ok: false, error: sdkErrorMessage(err) });
	}
};
