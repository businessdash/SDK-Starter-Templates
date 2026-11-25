import type { ActionFunctionArgs } from "react-router";

import { checkReview } from "~/components/reviews/reviews";
import {
	getCustomerSession,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "~/lib/bd-portal.server";

/**
 * POST /api/reviews/write — `{ rating, title?, body }` from the reviews
 * page's writer, for the signed-in customer. It waits for the business to
 * approve it. Checked again here with the shared rules.
 */
export async function action({ request }: ActionFunctionArgs) {
	if (!isCustomerPortalConfigured()) {
		return reply(503, { ok: false, error: "Reviews aren't connected yet." });
	}
	// A JSON body only: a form on another site can't send one.
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return reply(415, { ok: false, error: "Send JSON." });
	}
	if (!(await getCustomerSession(request))) {
		return reply(401, { ok: false, error: "Sign in to write a review." });
	}
	const checked = checkReview(
		((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>,
	);
	if (!checked.ok) return reply(400, { ok: false, error: checked.error });
	try {
		await submitCustomerReview(request, checked.review);
		return reply(200, { ok: true });
	} catch {
		return reply(502, {
			ok: false,
			error: "Couldn't send your review. Try again.",
		});
	}
}

function reply(status: number, body: { ok: boolean; error?: string }) {
	return Response.json(body, {
		status,
		headers: { "cache-control": "no-store" },
	});
}
