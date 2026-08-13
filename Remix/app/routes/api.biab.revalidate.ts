import type { ActionFunctionArgs } from "react-router";

import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

import { invalidateTags } from "~/lib/biab-cache.server";

/**
 * BIAB → consumer revalidation webhook (resource route).
 *
 * BIAB POSTs a signed `content.published` event here whenever an admin edits
 * content (gallery, blog, marketing, storefront, reviews, …). The SDK handler
 * verifies the HMAC + replay window and hands us the affected tags.
 *
 * Remix has no built-in tag cache (unlike Next's `revalidateTag`), so we drop
 * matching entries from the small in-memory TTL cache (`biab-cache.server.ts`)
 * that wraps our server reads — making the webhook REAL, not a no-op. The next
 * read repopulates the cache with fresh data within seconds of a publish.
 *
 * One-time setup: register this URL at BIAB's
 * `/dashboard/settings/integrations`, copy the `whsec_…` secret, and set it as
 * `BIAB_REVALIDATION_SECRET`.
 */

const handler = createGenericRevalidateHandler({
	secret: process.env["BIAB_REVALIDATION_SECRET"] ?? "",
	onTagsRevalidated: (tags, orgId) => {
		const dropped = invalidateTags(tags);
		if (process.env.NODE_ENV === "development") {
			console.info(
				`[biab] revalidate org=${orgId} tags=[${tags.join(", ")}] dropped=${dropped}`,
			);
		}
	},
});

// Remix resource routes receive a web `Request` and may return a web
// `Response` — exactly what the generic handler produces.
export async function action({ request }: ActionFunctionArgs) {
	return handler(request);
}

// A GET here is not a valid webhook delivery; answer with 405 so a stray
// browser visit doesn't 500.
export function loader() {
	return new Response("Method Not Allowed", { status: 405 });
}
