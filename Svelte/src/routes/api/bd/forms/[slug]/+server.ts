import { error, json } from "@sveltejs/kit";

import { bd } from "$lib/server/bd";

import type { RequestHandler } from "./$types";

/**
 * POST /api/bd/forms/[slug]
 *
 * Forwards a form submission to `bd.forms.submit(slug, data, ...)`.
 * The SDK runs `validateFormSubmission` against the live schema
 * server-side before persisting — a missing required field returns
 * a 400 from this route.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!bd) {
		throw error(503, "BD not configured. See .env.example.");
	}
	const slug = params.slug;
	if (!slug) throw error(400, "slug required");
	try {
		const body = (await request.json()) as {
			data: Record<string, unknown>;
			submitterEmail?: string;
			submitterName?: string;
		};
		const result = await bd.forms.submit(slug, body.data, {
			submitterEmail: body.submitterEmail,
			submitterName: body.submitterName,
		});
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't submit.";
		throw error(400, message);
	}
};
