import type { APIRoute } from "astro";

import {
	getCustomerSession,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "../../../../lib/bd-portal";
import { checkReview } from "../../../../lib/bd-shop/reviews";

export const prerender = false;

/**
 * POST /api/bd/reviews/write — `{ rating, title?, body }` from
 * <bd-review-writer> on /reviews, for the signed-in customer. It shows once
 * the business approves it. Checked again here with the shared rules.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isCustomerPortalConfigured()) {
		return reply(503, { ok: false, error: "Reviews aren't connected yet." });
	}
	// A JSON body only: a form on another site can't send one.
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return reply(415, { ok: false, error: "Send JSON." });
	}
	if (!(await getCustomerSession(cookies).catch(() => null))) {
		return reply(401, { ok: false, error: "Sign in to write a review." });
	}
	const checked = checkReview(
		((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>,
	);
	if (!checked.ok) return reply(400, { ok: false, error: checked.error });
	try {
		await submitCustomerReview(cookies, checked.review);
		return reply(200, { ok: true });
	} catch {
		return reply(502, {
			ok: false,
			error: "Couldn't send your review. Try again.",
		});
	}
};

function reply(status: number, body: { ok: boolean; error?: string }) {
	return Response.json(body, {
		status,
		headers: { "cache-control": "no-store" },
	});
}
