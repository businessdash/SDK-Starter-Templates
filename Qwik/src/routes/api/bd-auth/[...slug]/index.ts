import type { RequestEvent, RequestHandler } from "@builder.io/qwik-city";

import { createAuthHandler } from "@businessdash/sdk";

/**
 * BD customer-auth handler for the org bound to BD_API_KEY, mounted as a
 * catch-all for every sub-route under `/api/bd-auth/*`. Behind the sign-in
 * screen on /my-account (`<BdSignIn>`): `customer/*` (password, emailed
 * codes) and `customer/oauth/*` ("Continue with Google / Apple / GitHub /
 * Discord"), all WorkOS underneath through BD. It sets the `bd_session`
 * httpOnly cookie on this domain; `me` and `sign-out` round it out.
 *
 * `createAuthHandler` returns framework-agnostic web handlers
 * `(request: Request) => Promise<Response>`. Qwik's RequestEvent exposes the
 * incoming web `Request` as `.request`, so we bridge straight through and copy
 * the handler's Response onto the RequestEvent — the same pattern the
 * revalidate endpoint uses.
 *
 * Needs BD_API_KEY + BD_PACKAGE_API_BASE_URL. BD_AUTH_CALLBACK_URL is only
 * for the older hosted page (`sign-in` / `sign-up` redirects).
 * When set, prove its host once in Business Dash → Developer & API keys → Sign-in.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl =
	process.env.PUBLIC_BD_PACKAGE_API_BASE_URL ??
	process.env.BD_PACKAGE_API_BASE_URL ??
	"";
const apiKey = process.env.BD_API_KEY ?? "";
const callbackUrl = process.env.BD_AUTH_CALLBACK_URL ?? "";

const handler =
	rawBaseUrl && apiKey
		? createAuthHandler({
				baseUrl: normalizeBaseUrl(rawBaseUrl),
				apiKey,
				...(callbackUrl ? { callbackUrl } : {}),
				basePath: "/api/bd-auth",
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
				cookieName: "bd_session",
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
				"BD auth not configured (need BD_API_KEY and BD_PACKAGE_API_BASE_URL).",
		});
		return;
	}
	const res = await handler[method](ev.request);
	// Carry the handler's status + headers (Location for redirects). A provider
	// sign-in's callback sets two cookies, so every Set-Cookie is appended.
	res.headers.forEach((value, key) => {
		if (key.toLowerCase() !== "set-cookie") ev.headers.set(key, value);
	});
	for (const cookie of res.headers.getSetCookie()) {
		ev.headers.append("Set-Cookie", cookie);
	}
	const body = await res.text();
	ev.send(res.status, body);
}

export const onGet: RequestHandler = (ev) => emit(ev, "GET");
export const onPost: RequestHandler = (ev) => emit(ev, "POST");
