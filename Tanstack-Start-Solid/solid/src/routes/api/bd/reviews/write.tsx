import { createFileRoute } from "@tanstack/solid-router";

import { writeCustomerReview } from "../../../../lib/bd-server-fns";

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
}

/**
 * Write a review for `<bd-review-writer>` on /reviews: JSON
 * `{ rating, title?, body }` in, for the signed-in customer; `{ ok: true }`
 * or `{ ok: false, error }` out. Signed out, it answers 401 and the writer
 * offers the sign-in link.
 */
export const Route = createFileRoute("/api/bd/reviews/write")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// A JSON body only: a form on another site can't send one.
				if (
					!request.headers.get("content-type")?.includes("application/json")
				) {
					return json(415, { ok: false, error: "Send JSON." });
				}
				const body = await request.json().catch(() => null);
				const result = await writeCustomerReview(
					body && typeof body === "object" ? body : {},
				);
				return result.ok
					? json(200, { ok: true })
					: json(result.status, { ok: false, error: result.error });
			},
		},
	},
});
