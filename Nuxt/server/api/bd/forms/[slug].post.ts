/**
 * POST /api/bd/forms/[slug]
 *
 * Forwards a form submission to `bd.forms.submit(slug, data)`.
 * The SDK runs `validateFormSubmission` against the live schema
 * server-side before persisting — a missing required field returns
 * a 400 from this route.
 */
export default defineEventHandler(async (event) => {
	const bd = getBd();
	if (!bd) {
		throw createError({
			statusCode: 503,
			statusMessage: "BD not configured.",
		});
	}
	const slug = getRouterParam(event, "slug");
	if (!slug) {
		throw createError({ statusCode: 400, statusMessage: "slug required" });
	}
	const body = await readBody<{
		data: Record<string, unknown>;
		submitterEmail?: string;
		submitterName?: string;
	}>(event);
	try {
		return await bd.forms.submit(slug, body.data, {
			submitterEmail: body.submitterEmail,
			submitterName: body.submitterName,
		});
	} catch (err) {
		throw createError({
			statusCode: 400,
			statusMessage: err instanceof Error ? err.message : "Couldn't submit.",
		});
	}
});
