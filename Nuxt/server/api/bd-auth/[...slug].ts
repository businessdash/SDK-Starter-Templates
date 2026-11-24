import { createAuthHandler } from "@businessdash/sdk";

/**
 * BD customer-auth handler, mounted as a Nitro catch-all so it serves
 * every sub-route under `/api/bd-auth/*`. Behind the sign-in screen on
 * /my-account (`<BdSignIn>`): `customer/*` (password, emailed codes) and
 * `customer/oauth/*` ("Continue with Google / Apple / GitHub / Discord"),
 * all WorkOS underneath through BD; `me` and `sign-out` round it out.
 *
 * The SDK ships framework-agnostic web handlers — each is
 * `(request: Request) => Promise<Response>`. We bridge H3 ⇄ web Fetch:
 *   - `toWebRequest(event)` turns the H3 event into a web `Request`.
 *   - `sendWebResponse(event, res)` streams the returned `Response`
 *     back — status, headers (including the `Set-Cookie` that mints the
 *     `bd_session` cookie), and body — verbatim. This matters because
 *     the provider routes answer with redirects, not JSON.
 *
 * Needs NUXT_BD_API_KEY + NUXT_BD_PACKAGE_API_BASE_URL; when unconfigured
 * it returns 503 instead of crashing. NUXT_BD_AUTH_CALLBACK_URL is only for
 * the older hosted page (`sign-in` / `sign-up` redirects).
 */

let handler: ReturnType<typeof createAuthHandler> | null | undefined;

function getAuthHandler() {
	if (handler !== undefined) return handler;
	const cfg = getBdBaseConfig();
	const callbackUrl = getAuthCallbackUrl();
	if (!cfg) {
		handler = null;
		return handler;
	}
	handler = createAuthHandler({
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
		...(callbackUrl ? { callbackUrl } : {}),
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
