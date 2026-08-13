import type { RequestEvent, RequestHandler } from "@builder.io/qwik-city";

import { createAuthHandler } from "@businessdash/sdk";

/**
 * BIAB customer-auth handler (SDK 0.9.x). Proxies WorkOS-hosted sign-in /
 * sign-up / callback / sign-out for the org bound to BIAB_API_KEY and sets the
 * `biab_session` httpOnly cookie on this domain. Mounted as a catch-all so it
 * serves every sub-route under `/api/biab-auth/*`:
 *   sign-in · sign-up · callback · sign-out · password-reset · me
 *
 * `createAuthHandler` returns framework-agnostic web handlers
 * `(request: Request) => Promise<Response>`. Qwik's RequestEvent exposes the
 * incoming web `Request` as `.request`, so we bridge straight through and copy
 * the handler's Response onto the RequestEvent — the same pattern the
 * revalidate endpoint uses.
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * the existing BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl =
	process.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
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

/** Pipe a web `Response` from the SDK handler back onto Qwik's RequestEvent. */
async function emit(
	ev: RequestEvent,
	method: "GET" | "POST",
): Promise<void> {
	if (!handler) {
		ev.json(500, {
			ok: false,
			reason:
				"BIAB auth not configured (need BIAB_API_KEY, BIAB_PACKAGE_API_BASE_URL, BIAB_AUTH_CALLBACK_URL).",
		});
		return;
	}
	const res = await handler[method](ev.request);
	// Carry the handler's status + headers (Set-Cookie, Location for redirects).
	res.headers.forEach((value, key) => ev.headers.set(key, value));
	const body = await res.text();
	ev.send(res.status, body);
}

export const onGet: RequestHandler = (ev) => emit(ev, "GET");
export const onPost: RequestHandler = (ev) => emit(ev, "POST");
