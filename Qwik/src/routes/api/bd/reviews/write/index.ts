import type { RequestHandler } from "@builder.io/qwik-city";

import {
	getCustomerSession,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "../../../../../lib/bd-portal";
import { checkReview } from "../../../../../lib/shop/reviews";

/**
 * Write a review for `<bd-review-writer>` on /reviews: JSON
 * `{ rating, title?, body }` in, for the signed-in customer; `{ ok: true }`
 * or `{ ok: false, error }` out. It shows once the business approves it.
 * Checked again here with the shared rules.
 */
export const onPost: RequestHandler = async ({
	request,
	cookie,
	headers,
	json,
}) => {
	headers.set("Cache-Control", "no-store");
	if (!isCustomerPortalConfigured()) {
		json(503, { ok: false, error: "Reviews aren't connected yet." });
		return;
	}
	// A JSON body only: a form on another site can't send one.
	if (!request.headers.get("content-type")?.includes("application/json")) {
		json(415, { ok: false, error: "Send JSON." });
		return;
	}
	if (!(await getCustomerSession(cookie).catch(() => null))) {
		json(401, { ok: false, error: "Sign in to write a review." });
		return;
	}
	const checked = checkReview(
		((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>,
	);
	if (!checked.ok) {
		json(400, { ok: false, error: checked.error });
		return;
	}
	try {
		await submitCustomerReview(cookie, checked.review);
		json(200, { ok: true });
	} catch {
		json(502, { ok: false, error: "Couldn't send your review. Try again." });
	}
};
