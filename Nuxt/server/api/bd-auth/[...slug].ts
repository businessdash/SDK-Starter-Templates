import { createAuthHandler } from "@businessdash/sdk";

/**
 * BD customer-auth handler, mounted as a Nitro catch-all so it serves
 * every sub-route under `/api/bd-auth/*`:
 *   sign-in · sign-up · callback · sign-out · password-reset · me
 *
 * The SDK ships framework-agnostic web handlers — each is
 * `(request: Request) => Promise<Response>`. We bridge H3 ⇄ web Fetch:
 *   - `toWebRequest(event)` turns the H3 event into a web `Request`.
 *   - `sendWebResponse(event, res)` streams the returned `Response`
 *     back — status, headers (including the `Set-Cookie` that mints the
 *     `bd_session` cookie), and body — verbatim. This matters because
 *     most auth responses are 302 redirects, not JSON.
 *
 * Requires NUXT_BD_AUTH_CALLBACK_URL (registered as a WorkOS redirect
 * URI) plus the existing NUXT_BD_API_KEY + NUXT_BD_PACKAGE_API_BASE_URL.
 * When unconfigured it returns 503 instead of crashing.
 */

let handler: ReturnType<typeof createAuthHandler> | null | undefined;

function getAuthHandler() {
	if (handler !== undefined) return handler;
	const cfg = getBdBaseConfig();
	const callbackUrl = getAuthCallbackUrl();
	if (!cfg || !callbackUrl) {
		handler = null;
		return handler;
	}
	handler = createAuthHandler({
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
		callbackUrl,
		basePath: "/api/bd-auth",
		defaultReturnTo: "/my-account",
		signOutReturnTo: "/",
		cookieName: "bd_session",
	});
	return handler;
}

export default defineEventHandler(async (event) => {
	const auth = getAuthHandler();
	if (!auth) {
		setResponseStatus(event, 503);
		return { ok: false, reason: "BD auth is not configured." };
	}

	const request = toWebRequest(event);
	const method = event.method.toUpperCase();
	const res =
		method === "POST" ? await auth.POST(request) : await auth.GET(request);
	return sendWebResponse(event, res);
});
