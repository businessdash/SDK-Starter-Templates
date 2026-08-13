import type { APIRoute } from "astro";

import {
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "../../../../lib/biab-portal";

export const prerender = false;

/**
 * POST /api/biab/portal/submit-review  { rating, title?, body, jobId? }
 *
 * Submit a review as the signed-in customer via the BIAB portal. Reads the
 * `biab_session` cookie (forwarded through `Astro.cookies`) to authorise the
 * call. Lands as `status: 'pending'` until staff moderate it.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isCustomerPortalConfigured()) {
		return Response.json(
			{ error: "Reviews aren't available right now." },
			{ status: 503 },
		);
	}
	try {
		const body = (await request.json()) as {
			rating: number;
			title?: string;
			body: string;
			jobId?: string;
		};
		const rating = Number(body.rating);
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
			return Response.json(
				{ error: "Rating must be 1–5." },
				{ status: 400 },
			);
		}
		if (!body.body || !body.body.trim()) {
			return Response.json(
				{ error: "Please write a few words." },
				{ status: 400 },
			);
		}
		const res = await submitCustomerReview(cookies, {
			rating,
			title: body.title?.trim() || undefined,
			body: body.body.trim(),
			jobId: body.jobId?.trim() || undefined,
		});
		return Response.json({ ok: true, status: res.status ?? "pending" });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Couldn't submit your review.";
		return Response.json({ error: message }, { status: 400 });
	}
};
