import type { APIRoute } from "astro";

import { createAuthHandler } from "@businessdash/sdk";

import { getBdEnv } from "../../../lib/bd";

export const prerender = false;

/**
 * BD customer-auth handler for the org bound to BD_API_KEY. It serves the
 * sign-in screen on /my-account (`<bd-sign-in>`): `customer/*` (password,
 * emailed codes) and `customer/oauth/*` ("Continue with Google / Apple /
 * GitHub / Discord"), all WorkOS underneath through BD. It sets the
 * `bd_session` httpOnly cookie on this domain and keeps the token out of
 * page scripts. Mounted as a catch-all for every sub-route under
 * `/api/bd-auth/*`; `me` and `sign-out` round it out.
 *
 * Astro hands an APIRoute a web `Request` and expects a web `Response`, which
 * is exactly the framework-agnostic shape `createAuthHandler` returns — so we
 * pass the request straight through.
 *
 * Needs BD_API_KEY + BD_PACKAGE_API_BASE_URL. BD_AUTH_CALLBACK_URL is only
 * for the older hosted page (`sign-in` / `sign-up` redirects).
 * When set, its domain must be verified in Business Dash Settings → Domain.
 */

const env = getBdEnv();
const callbackUrl =
	import.meta.env.BD_AUTH_CALLBACK_URL ?? process.env.BD_AUTH_CALLBACK_URL;

const handler = env
	? createAuthHandler({
			baseUrl: env.baseUrl,
			apiKey: env.apiKey,
			...(callbackUrl ? { callbackUrl } : {}),
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
				"Auth isn't configured. Set the BD_* keys. See .env.example.",
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
