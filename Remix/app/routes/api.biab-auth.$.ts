import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createAuthHandler } from "@businessdash/sdk";

import { getServerConfig } from "~/lib/biab.server";

/**
 * BIAB customer-auth handler (catch-all resource route).
 *
 * Proxies WorkOS-hosted sign-in / sign-up / callback / sign-out / me /
 * password-reset for the org bound to BIAB_API_KEY and sets the
 * `biab_session` httpOnly cookie on this domain. The splat (`$`) makes one
 * route serve every sub-path under `/api/biab-auth/*`.
 *
 * Plain links drive it — no client SDK needed:
 *   <a href="/api/biab-auth/sign-in">  /sign-up  /sign-out
 *
 * Requires BIAB_AUTH_CALLBACK_URL (registered as a WorkOS redirect URI) plus
 * the existing BIAB_API_KEY + BIAB_PACKAGE_API_BASE_URL.
 */

function buildHandler() {
	const cfg = getServerConfig();
	if (!cfg) return null;
	return createAuthHandler({
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
		callbackUrl: process.env["BIAB_AUTH_CALLBACK_URL"] ?? "",
		basePath: "/api/biab-auth",
		defaultReturnTo: "/my-account",
		signOutReturnTo: "/",
		cookieName: "biab_session",
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
