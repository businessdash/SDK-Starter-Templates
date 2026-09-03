import type { APIRoute } from "astro";

import { createAuthHandler } from "@businessdash/sdk";

import { getBdEnv } from "../../../lib/bd";

export const prerender = false;

/**
 * BD customer-auth handler (SDK 0.9.x). Proxies WorkOS-hosted sign-in /
 * sign-up / callback / sign-out for the org bound to BD_API_KEY and sets the
 * `bd_session` httpOnly cookie on this domain. Mounted as a catch-all so it
 * serves every sub-route under `/api/bd-auth/*` (sign-in, sign-up, callback,
 * sign-out, password-reset, me).
 *
 * Astro hands an APIRoute a web `Request` and expects a web `Response`, which
 * is exactly the framework-agnostic shape `createAuthHandler` returns — so we
 * pass the request straight through.
 *
 * Requires BD_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * BD_API_KEY + BD_PACKAGE_API_BASE_URL.
 */

const env = getBdEnv();
const callbackUrl =
	import.meta.env.BD_AUTH_CALLBACK_URL ?? process.env.BD_AUTH_CALLBACK_URL;

const handler =
	env && callbackUrl
		? createAuthHandler({
				baseUrl: env.baseUrl,
				apiKey: env.apiKey,
				callbackUrl,
				basePath: "/api/bd-auth",
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
				cookieName: "bd_session",
			})
		: null;

function notConfigured(): Response {
	return Response.json(
		{
			error:
				"Auth isn't configured. Set BD_AUTH_CALLBACK_URL (and the BD_* keys). See .env.example.",
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
