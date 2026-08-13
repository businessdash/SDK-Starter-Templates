import type { APIRoute } from "astro";

import { createAuthHandler } from "@businessdash/sdk";

import { getBiabEnv } from "../../../lib/biab";

export const prerender = false;

/**
 * BIAB customer-auth handler (SDK 0.9.x). Proxies WorkOS-hosted sign-in /
 * sign-up / callback / sign-out for the org bound to BIAB_API_KEY and sets the
 * `biab_session` httpOnly cookie on this domain. Mounted as a catch-all so it
 * serves every sub-route under `/api/biab-auth/*` (sign-in, sign-up, callback,
 * sign-out, password-reset, me).
 *
 * Astro hands an APIRoute a web `Request` and expects a web `Response`, which
 * is exactly the framework-agnostic shape `createAuthHandler` returns — so we
 * pass the request straight through.
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL.
 */

const env = getBiabEnv();
const callbackUrl =
	import.meta.env.BIAB_AUTH_CALLBACK_URL ?? process.env.BIAB_AUTH_CALLBACK_URL;

const handler =
	env && callbackUrl
		? createAuthHandler({
				baseUrl: env.baseUrl,
				apiKey: env.apiKey,
				callbackUrl,
				basePath: "/api/biab-auth",
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
				cookieName: "biab_session",
			})
		: null;

function notConfigured(): Response {
	return Response.json(
		{
			error:
				"Auth isn't configured. Set BIAB_AUTH_CALLBACK_URL (and the BIAB_* keys). See .env.example.",
		},
		{ status: 503 },
	);
}

export const GET: APIRoute = async ({ request }) => {
	if (!handler) return notConfigured();
	return handler.GET(request);
};

export const POST: APIRoute = async ({ request }) => {
	if (!handler) return notConfigured();
	return handler.POST(request);
};
