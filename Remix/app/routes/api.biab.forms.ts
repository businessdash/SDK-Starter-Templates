import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getBiab } from "~/lib/biab.server";

/**
 * Same-origin Forms proxy (resource route) so the client `<BiabForm>` island can
 * fetch a schema and submit without ever seeing the BIAB bearer key.
 *
 *   GET  /api/biab/forms?slug=contact   → the form schema
 *   POST /api/biab/forms  { slug, data, ...opts }  → the FormSubmitResult
 *
 * Server-only — the SDK uses the secret key here.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const biab = getBiab();
	const slug = new URL(request.url).searchParams.get("slug");
	if (!slug) return Response.json({ error: "slug required" }, { status: 400 });
	if (!biab) return Response.json({ error: "BIAB not configured" }, { status: 503 });
	try {
		return Response.json(await biab.forms.schema(slug));
	} catch (err) {
		return Response.json(
			{ error: err instanceof Error ? err.message : "Failed to load schema" },
			{ status: 502 },
		);
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const biab = getBiab();
	if (!biab) return Response.json({ error: "BIAB not configured" }, { status: 503 });
	const body = (await request.json()) as {
		slug: string;
		data: Record<string, unknown>;
		submitterEmail?: string;
		submitterName?: string;
		dryRun?: boolean;
		source?: string;
		referrer?: string;
		metadata?: Record<string, unknown>;
	};
	// `forms.submit` never throws for an expected failure — it resolves to a
	// FormSubmitResult either way, so we can forward it straight through.
	const result = await biab.forms.submit(body.slug, body.data, {
		submitterEmail: body.submitterEmail,
		submitterName: body.submitterName,
		dryRun: body.dryRun,
		source: body.source,
		referrer: body.referrer,
		metadata: body.metadata,
	});
	return Response.json(result);
}
