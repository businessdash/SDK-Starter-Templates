import { env } from "$env/dynamic/private";

import { createAuthHandler } from "@businessdash/sdk";

import type { RequestHandler } from "./$types";

/**
 * BIAB customer-auth handler. Proxies the WorkOS-hosted sign-in / sign-up
 * / callback / sign-out flow for the org bound to BIAB_API_KEY and sets
 * the `biab_session` httpOnly cookie on this domain. Mounted as a
 * catch-all so it serves every sub-route under `/api/biab-auth/*`:
 *   sign-in · sign-up · callback · sign-out · password-reset (POST) · me
 *
 * `createAuthHandler` returns framework-agnostic web handlers — each
 * takes the raw `Request` and returns a `Response`, which is exactly what
 * a SvelteKit `+server.ts` handler returns, so we pass `event.request`
 * straight through.
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI)
 * plus the existing BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL. Returns a
 * 503 when unconfigured so the rest of the site still renders.
 */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl = env.BIAB_PACKAGE_API_BASE_URL ?? "";
const apiKey = env.BIAB_API_KEY ?? "";
const callbackUrl = env.BIAB_AUTH_CALLBACK_URL ?? "";

const handler =
	apiKey && rawBaseUrl && callbackUrl
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

function unavailable(): Response {
	return new Response(
		JSON.stringify({
			ok: false,
			reason:
				"BIAB auth not configured. Set BIAB_API_KEY, BIAB_PACKAGE_API_BASE_URL and BIAB_AUTH_CALLBACK_URL.",
		}),
		{ status: 503, headers: { "Content-Type": "application/json" } },
	);
}

export const GET: RequestHandler = async ({ request }) =>
	handler ? handler.GET(request) : unavailable();

export const POST: RequestHandler = async ({ request }) =>
	handler ? handler.POST(request) : unavailable();
