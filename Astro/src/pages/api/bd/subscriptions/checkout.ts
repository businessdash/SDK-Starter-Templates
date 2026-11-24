// [bd-file:saas]
import type { APIRoute } from "astro";

import { startPlanCheckout } from "../../../../lib/bd-portal";

export const prerender = false;

/**
 * POST /api/bd/subscriptions/checkout  (form field `planId`)
 *
 * Hand the signed-in customer to Stripe-hosted Checkout in subscription
 * mode. A plain form post, answered with a redirect: to Stripe, to sign-in
 * for a visitor who isn't signed in, or back to the plans with an error.
 */
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
	const form = await request.formData();
	const planId = String(form.get("planId") ?? "");
	if (!planId) return redirect("/store/subscriptions?error=checkout", 303);
	try {
		const res = await startPlanCheckout(cookies, planId, {
			successUrl: `${url.origin}/store/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${url.origin}/store/subscriptions`,
		});
		if (!res) return redirect("/my-account?next=/store/subscriptions", 303);
		return redirect(res.url, 303);
	} catch {
		return redirect("/store/subscriptions?error=checkout", 303);
	}
};
