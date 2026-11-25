// [bd-file:subscriptions]
import type { APIRoute } from "astro";

import { setPlanCancelled } from "../../../../lib/bd-portal";

export const prerender = false;

/**
 * POST /api/bd/portal/plan  (form field `intent`: cancel | resume)
 *
 * Cancel the signed-in customer's plan at the end of the paid period, or take
 * a pending cancel back, then return to the account page. `?plan=` says what
 * happened, because the stored status lags until the payment provider
 * confirms.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const intent = form.get("intent");
	if (intent !== "cancel" && intent !== "resume") {
		return redirect("/my-account?plan=error", 303);
	}
	try {
		await setPlanCancelled(cookies, intent === "cancel");
		return redirect(
			`/my-account?plan=${intent === "cancel" ? "cancelled" : "resumed"}`,
			303,
		);
	} catch {
		return redirect("/my-account?plan=error", 303);
	}
};
