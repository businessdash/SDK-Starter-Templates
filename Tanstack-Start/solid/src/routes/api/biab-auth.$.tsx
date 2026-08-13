import { createAuthHandler } from "@businessdash/sdk";
import { createFileRoute } from "@tanstack/solid-router";

/**
 * BIAB customer-auth handler (catch-all). Proxies WorkOS-hosted
 * sign-in / sign-up / callback / sign-out / password-reset / me for
 * the org bound to BIAB_API_KEY and sets the `biab_session` httpOnly
 * cookie on this domain.
 *
 * Mounted as a splat server route so it serves every sub-route under
 * `/api/biab-auth/*`. The SDK's handler is framework-agnostic — each
 * method is `(request: Request) => Promise<Response>`, so we hand it the
 * incoming `request` and return its `Response` directly.
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI)
 * plus the existing BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL. When unset,
 * the route 503s so the rest of the site keeps rendering.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl =
	process.env.VITE_BIAB_PACKAGE_API_BASE_URL ??
	process.env.BIAB_PACKAGE_API_BASE_URL ??
	"";
const apiKey = process.env.BIAB_API_KEY ?? "";
const callbackUrl = process.env.BIAB_AUTH_CALLBACK_URL ?? "";

const handler =
	rawBaseUrl && apiKey && callbackUrl
		? createAuthHandler({
				baseUrl: normalizeBaseUrl(rawBaseUrl),
				apiKey,
				callbackUrl,
				basePath: "/api/biab-auth",
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
				cookieName: "biab_session",
			})
		: null;

function unconfigured(): Response {
	return new Response(
		JSON.stringify({ ok: false, reason: "BIAB auth not configured" }),
		{ status: 503, headers: { "Content-Type": "application/json" } },
	);
}

export const Route = createFileRoute("/api/biab-auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => (handler ? handler.GET(request) : unconfigured()),
			POST: ({ request }) => (handler ? handler.POST(request) : unconfigured()),
		},
	},
});
