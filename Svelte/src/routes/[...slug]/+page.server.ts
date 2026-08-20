import { error } from "@sveltejs/kit";
import { renderLegalPageHtml, resolveLegalPage } from "@businessdash/sdk/legal";

import { biab } from "$lib/server/biab";
import type { PageServerLoad } from "./$types";

/**
 * The catch-all — legal pages, and everything else's 404.
 *
 * ## Your own routes always win
 *
 * SvelteKit resolves a static segment before a rest parameter, so
 * `routes/privacy/+page.svelte` shadows this route entirely. Write your own
 * privacy policy and this is never consulted for that path — no config, no
 * conflict, no build error, nothing to delete. That is why the SDK hands you a
 * resolver rather than generating a `privacy` route: two routes claiming one
 * path is a build failure, which would turn "I wrote my own policy" into a
 * broken deploy.
 */
export const load: PageServerLoad = async ({ params }) => {
	// Returns null for an unknown slug AND when BusinessDash is unreachable —
	// this route runs on every unmatched URL, so it must never throw.
	const document = biab
		? await resolveLegalPage({ client: biab, slug: params.slug })
		: null;

	// `error(404)` renders `+error.svelte` with a real 404 status, rather than
	// a 200 page apologising — which is what crawlers and uptime checks read.
	if (!document) error(404, "Not found");

	return { title: document.title, html: renderLegalPageHtml(document) };
};
