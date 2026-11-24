// [bd-file:saas]
/**
 * POST /api/bd/store/subscriptions/:id/checkout
 *
 * Hand the signed-in customer to Stripe-hosted Checkout in subscription
 * mode and return the URL to send the browser to. A plan is the customer's
 * own, so a visitor who isn't signed in gets a 401 and the sign-in link.
 */
export default defineEventHandler(
	async (
		event,
	): Promise<
		{ ok: true; url: string } | { ok: false; error: string; signIn?: string }
	> => {
		const id = getRouterParam(event, "id");
		if (!id) return { ok: false, error: "Pick a plan." };
		const origin = getRequestURL(event).origin;
		try {
			const res = await startPlanCheckout(event, id, {
				successUrl: `${origin}/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
				cancelUrl: `${origin}/subscriptions`,
			});
			if (!res) {
				setResponseStatus(event, 401);
				return {
					ok: false,
					error: "Sign in to subscribe.",
					signIn: "/my-account?next=/subscriptions",
				};
			}
			return { ok: true, url: res.url };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
);
