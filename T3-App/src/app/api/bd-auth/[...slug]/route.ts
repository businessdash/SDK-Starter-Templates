import { createAuthHandler } from "@businessdash/sdk";

/**
 * BD customer-auth handler. Proxies WorkOS-hosted sign-in / sign-up /
 * callback / sign-out for the org bound to BD_API_KEY and sets the
 * `bd_session` httpOnly cookie on this domain. Mounted as a catch-all so it
 * serves every sub-route under `/api/bd-auth/*`
 * (`sign-in`, `sign-up`, `callback`, `sign-out`, `password-reset`, `me`).
 *
 * Requires BD_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * the existing BD_API_KEY + BD_PACKAGE_API_BASE_URL.
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
	callbackUrl: process.env.BD_AUTH_CALLBACK_URL ?? "",
	basePath: "/api/bd-auth",
	defaultReturnTo: "/my-account",
	signOutReturnTo: "/",
	cookieName: "bd_session",
});

export const { GET, POST } = handler;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
