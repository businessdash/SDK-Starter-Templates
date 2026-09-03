import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";

export const prerender = false;

/**
 * GET /api/bd/scheduling/slots?slug=&from=&to=
 *
 * Server-side helper for the Booking client island. Wraps
 * `bd.scheduling.getAvailableSlots(...)` — the SDK call runs
 * with the bearer key Astro holds on the server.
 */
export const GET: APIRoute = async ({ url }) => {
	if (!bd) {
		return Response.json(
			{ error: "BD not configured. See .env.example." },
			{ status: 503 },
		);
	}
	const slug = url.searchParams.get("slug");
	const fromStr = url.searchParams.get("from");
	const toStr = url.searchParams.get("to");
	if (!slug || !fromStr || !toStr) {
		return Response.json(
			{ error: "slug, from, to required" },
			{ status: 400 },
		);
	}
	try {
		const slots = await bd.scheduling.getAvailableSlots(slug, {
			from: new Date(fromStr),
			to: new Date(toStr),
		});
		return Response.json({ slots });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return Response.json({ error: message }, { status: 502 });
	}
};
