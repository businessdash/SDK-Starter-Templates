import { env } from "$env/dynamic/private";

import { createAuthHandler } from "@businessdash/sdk";

import type { RequestHandler } from "./$types";

/**
 * BD customer-auth handler. Proxies the WorkOS-hosted sign-in / sign-up
 * / callback / sign-out flow for the org bound to BD_API_KEY and sets
 * the `bd_session` httpOnly cookie on this domain. Mounted as a
 * catch-all so it serves every sub-route under `/api/bd-auth/*`:
 *   sign-in · sign-up · callback · sign-out · password-reset (POST) · me
 *
 * `createAuthHandler` returns framework-agnostic web handlers — each
 * takes the raw `Request` and returns a `Response`, which is exactly what
 * a SvelteKit `+server.ts` handler returns, so we pass `event.request`
 * straight through.
 *
 * Requires BD_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI)
 * plus the existing BD_API_KEY + BD_PACKAGE_API_BASE_URL. Returns a
 * 503 when unconfigured so the rest of the site still renders.
 */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl = env.BD_PACKAGE_API_BASE_URL ?? "";
const apiKey = env.BD_API_KEY ?? "";
const callbackUrl = env.BD_AUTH_CALLBACK_URL ?? "";

const handler =
	apiKey && rawBaseUrl && callbackUrl
		? createAuthHandler({
				baseUrl: normalizeBaseUrl(rawBaseUrl),
				apiKey,
				callbackUrl,
				basePath: "/api/bd-auth",
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
				cookieName: "bd_session",
			})
		: null;

function unavailable(): Response {
	return new Response(
		JSON.stringify({
			ok: false,
			reason:
				"BD auth not configured. Set BD_API_KEY, BD_PACKAGE_API_BASE_URL and BD_AUTH_CALLBACK_URL.",
		}),
		{ status: 503, headers: { "Content-Type": "application/json" } },
	);
}

export const GET: RequestHandler = async ({ request }) =>
	handler ? handler.GET(request) : unavailable();

export const POST: RequestHandler = async ({ request }) =>
	handler ? handler.POST(request) : unavailable();
