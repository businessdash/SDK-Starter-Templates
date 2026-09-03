import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createAuthHandler } from "@businessdash/sdk";

import { getServerConfig } from "~/lib/bd.server";

/**
 * BD customer-auth handler (catch-all resource route).
 *
 * Proxies WorkOS-hosted sign-in / sign-up / callback / sign-out / me /
 * password-reset for the org bound to BD_API_KEY and sets the
 * `bd_session` httpOnly cookie on this domain. The splat (`$`) makes one
 * route serve every sub-path under `/api/bd-auth/*`.
 *
 * Plain links drive it — no client SDK needed:
 *   <a href="/api/bd-auth/sign-in">  /sign-up  /sign-out
 *
 * Requires BD_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * the existing BD_API_KEY + BD_PACKAGE_API_BASE_URL.
 */

function buildHandler() {
	const cfg = getServerConfig();
	if (!cfg) return null;
	return createAuthHandler({
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
		callbackUrl: process.env["BD_AUTH_CALLBACK_URL"] ?? "",
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
