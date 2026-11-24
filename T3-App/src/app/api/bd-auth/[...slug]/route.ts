import { createAuthHandler } from "@businessdash/sdk";

/**
 * BD customer-auth handler for the org bound to BD_API_KEY. It serves the
 * sign-in screen on /my-account (`<BdSignIn>`): `customer/*` (password,
 * emailed codes) and `customer/oauth/*` ("Continue with Google / Apple /
 * GitHub / Discord"), all WorkOS underneath through BD. It sets the
 * `bd_session` httpOnly cookie on this domain and keeps the token out of
 * page scripts; `me` and `sign-out` round it out.
 *
 * Needs BD_API_KEY + BD_PACKAGE_API_BASE_URL. BD_AUTH_CALLBACK_URL is only
 * for the older hosted page (`sign-in` / `sign-up` redirects).
 * When set, its domain must be verified in Business Dash Settings → Domain.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl = process.env.BD_PACKAGE_API_BASE_URL ?? "";

const handler = createAuthHandler({
	baseUrl: normalizeBaseUrl(rawBaseUrl),
	apiKey: process.env.BD_API_KEY ?? "",
	...(process.env.BD_AUTH_CALLBACK_URL
		? { callbackUrl: process.env.BD_AUTH_CALLBACK_URL }
		: {}),
	basePath: "/api/bd-auth",
	defaultReturnTo: "/my-account",
	signOutReturnTo: "/",
	cookieName: "bd_session",
});

export const { GET, POST } = handler;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
