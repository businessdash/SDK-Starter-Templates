import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getBd } from "~/lib/bd.server";

/**
 * Same-origin Forms proxy (resource route) so the client `<BdForm>` island can
 * fetch a schema and submit without ever seeing the BD bearer key.
 *
 *   GET  /api/bd/forms?slug=contact   → the form schema
 *   POST /api/bd/forms  { slug, data, ...opts }  → the FormSubmitResult
 *
 * Server-only — the SDK uses the secret key here.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const bd = getBd();
	const slug = new URL(request.url).searchParams.get("slug");
	if (!slug) return Response.json({ error: "slug required" }, { status: 400 });
	if (!bd) return Response.json({ error: "BD not configured" }, { status: 503 });
	try {
		return Response.json(await bd.forms.schema(slug));
	} catch (err) {
		return Response.json(
			{ error: err instanceof Error ? err.message : "Failed to load schema" },
			{ status: 502 },
		);
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const bd = getBd();
	if (!bd) return Response.json({ error: "BD not configured" }, { status: 503 });
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
	const result = await bd.forms.submit(body.slug, body.data, {
		submitterEmail: body.submitterEmail,
		submitterName: body.submitterName,
		dryRun: body.dryRun,
		source: body.source,
		referrer: body.referrer,
		metadata: body.metadata,
	});
	return Response.json(result);
}
