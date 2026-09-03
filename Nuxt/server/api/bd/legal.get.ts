import { getBd } from "../../utils/bd";
import { resolveLegalPage, renderLegalPageHtml } from "@businessdash/sdk/legal";

/**
 * Resolve a legal page server-side.
 *
 * The API key is a server secret, so the lookup cannot happen in the page —
 * `[...slug].vue` calls this and renders whatever comes back.
 *
 * Returns `{ found: false }` rather than a 404 status: the PAGE decides the
 * status code, because it is the one that knows whether to render a legal
 * document or the not-found body.
 */
export default defineEventHandler(async (event) => {
	const slug = getQuery(event).slug;
	const client = getBd();
	if (!client) return { found: false as const };

	const document = await resolveLegalPage({
		client,
		slug: typeof slug === "string" ? slug : undefined,
	});
	if (!document) return { found: false as const };

	return {
		found: true as const,
		title: document.title,
		html: renderLegalPageHtml(document),
	};
});
