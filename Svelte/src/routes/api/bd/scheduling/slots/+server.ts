import { error, json } from "@sveltejs/kit";

import { bd } from "$lib/server/bd";

import type { RequestHandler } from "./$types";

/**
 * GET /api/bd/scheduling/slots?slug=&from=&to=
 *
 * Wraps `bd.scheduling.getAvailableSlots` so the booking client
 * can compute availability without ever holding the API key.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (!bd) {
		throw error(503, "BD not configured. See .env.example.");
	}
	const slug = url.searchParams.get("slug");
	const fromStr = url.searchParams.get("from");
	const toStr = url.searchParams.get("to");
	if (!slug || !fromStr || !toStr) {
		throw error(400, "slug, from, to required");
	}
	try {
		const slots = await bd.scheduling.getAvailableSlots(slug, {
			from: new Date(fromStr),
			to: new Date(toStr),
		});
		return json({ slots });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		throw error(502, message);
	}
};
