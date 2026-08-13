import { createAuthHandler } from "@businessdash/sdk";

/**
 * BIAB customer-auth handler. Proxies WorkOS-hosted sign-in / sign-up /
 * callback / sign-out for the org bound to BIAB_API_KEY and sets the
 * `biab_session` httpOnly cookie on this domain. Mounted as a catch-all so it
 * serves every sub-route under `/api/biab-auth/*`
 * (`sign-in`, `sign-up`, `callback`, `sign-out`, `password-reset`, `me`).
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * the existing BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl = process.env.BIAB_PACKAGE_API_BASE_URL ?? "";

const handler = createAuthHandler({
	baseUrl: normalizeBaseUrl(rawBaseUrl),
	apiKey: process.env.BIAB_API_KEY ?? "",
	callbackUrl: process.env.BIAB_AUTH_CALLBACK_URL ?? "",
	basePath: "/api/biab-auth",
	defaultReturnTo: "/my-account",
	signOutReturnTo: "/",
	cookieName: "biab_session",
});

export const { GET, POST } = handler;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
