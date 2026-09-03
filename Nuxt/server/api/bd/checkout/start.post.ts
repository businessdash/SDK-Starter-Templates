/**
 * POST /api/bd/checkout/start
 *
 * Start Stripe-hosted checkout for the visitor's cart and return the
 * URL to redirect the browser to. The success/cancel URLs are built
 * from the request origin so they're absolute (Stripe requires it).
 *
 * Returns `{ ok:false, error }` when the store is unconfigured or the
 * cart is empty, so the cart page can show a message instead of
 * bouncing the user.
 */
export default defineEventHandler(
	async (
		event,
	): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
		const bd = getBd();
		if (!bd) {
			return { ok: false, error: "Store isn't connected (missing BD env)." };
		}
		const token = readVisitorToken(event);
		if (!token) return { ok: false, error: "Your cart is empty." };

		const origin = getRequestURL(event).origin;
		try {
			const res = await bd.checkout.forVisitor(token).start({
				successUrl: `${origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
				cancelUrl: `${origin}/cart`,
			});
			return { ok: true, url: res.stripeUrl };
		} catch (err) {
			return { ok: false, error: sdkErrorMessage(err) };
		}
	},
);
