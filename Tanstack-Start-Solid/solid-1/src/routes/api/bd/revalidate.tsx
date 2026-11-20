import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";
import { createFileRoute } from "@tanstack/solid-router";

/**
 * BD → TanStack Start revalidation webhook receiver.
 *
 * Register this URL in BD at /dashboard/settings/integrations
 * and paste the revealed `whsec_…` into BD_REVALIDATION_SECRET.
 * The SDK adapter verifies the HMAC + replay window; the callback
 * is where you wire any response-level cache purge (CDN tag, KV
 * delete, etc.).
 *
 * Server routes attach to a `createFileRoute` via `server.handlers`.
 * Each handler is `({ request }) => Response`, so we hand the SDK's
 * framework-agnostic `(req: Request) => Response` handler straight
 * through.
 */
const secret = process.env.BD_REVALIDATION_SECRET;

const handler = secret
	? createGenericRevalidateHandler({
			secret,
			onTagsRevalidated: async (tags, orgId) => {
				console.info(
					`[bd] revalidate received tags=${tags.join(",")} org=${orgId}`,
				);
			},
		})
	: null;

export const Route = createFileRoute("/api/bd/revalidate")({
	server: {
		handlers: {
			POST: ({ request }) => {
				if (!handler) {
					return new Response(
						JSON.stringify({
							ok: false,
							reason: "BD_REVALIDATION_SECRET not configured",
						}),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}
				return handler(request);
			},
		},
	},
});
