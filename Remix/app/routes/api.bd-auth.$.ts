import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createAuthHandler } from "@businessdash/sdk";

import { getServerConfig } from "~/lib/bd.server";

/**
 * BD customer-auth handler (catch-all resource route) for the org bound to
 * BD_API_KEY. It serves the sign-in screen on /my-account (`<BdSignIn>`):
 * `customer/*` (password, emailed codes) and `customer/oauth/*` ("Continue
 * with Google / Apple / GitHub / Discord"), all WorkOS underneath through
 * BD. It sets the `bd_session` httpOnly cookie on this domain and keeps the
 * token out of page scripts. The splat (`$`) makes one route serve every
 * sub-path under `/api/bd-auth/*`; `me` and `sign-out` round it out.
 *
 * Needs BD_API_KEY + BD_PACKAGE_API_BASE_URL. BD_AUTH_CALLBACK_URL is only
 * for the older hosted page (`sign-in` / `sign-up` redirects).
 * When set, prove its host once in Business Dash → Developer & API keys → Sign-in.
 */

function buildHandler() {
	const cfg = getServerConfig();
	if (!cfg) return null;
	return createAuthHandler({
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
		...(process.env["BD_AUTH_CALLBACK_URL"]
			? { callbackUrl: process.env["BD_AUTH_CALLBACK_URL"] }
			: {}),
		basePath: "/api/bd-auth",
		defaultReturnTo: "/my-account",
		signOutReturnTo: "/",
		cookieName: "bd_session",
	});
}

const handler = buildHandler();

export async function loader({ request }: LoaderFunctionArgs) {
	if (!handler) return new Response("Auth not configured", { status: 503 });
	return handler.GET(request);
}

export async function action({ request }: ActionFunctionArgs) {
	if (!handler) return new Response("Auth not configured", { status: 503 });
	return handler.POST(request);
}
