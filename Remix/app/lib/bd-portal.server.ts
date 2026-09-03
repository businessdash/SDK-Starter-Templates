import { createBdApiClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";
import { createCookie } from "react-router";

import { getServerConfig } from "./bd.server";

/**
 * Customer-portal helpers (server-only).
 *
 * Customer identity is WorkOS-backed BD auth: the `/api/bd-auth/*`
 * handler (mounted at `app/routes/api.bd-auth.$.ts`) mints a
 * `bd_session` httpOnly cookie, and portal calls run as
 * `customerPortal(org).withSession(token)`. There's no user-bound API key —
 * the site key + the session token are the whole auth surface, and the org
 * is read from the validated session.
 *
 * Remix reads cookies off the request, so the session helpers take a
 * `Request`. Mirrors DGP `bd-portal.ts`.
 */

/** Cookie used only to PARSE the incoming `bd_session` value — the auth
 *  handler owns writing it. Marked httpOnly to match. */
const sessionCookie = createCookie("bd_session", {
	httpOnly: true,
	sameSite: "lax",
	path: "/",
});

/** True when BD customer auth can run (API key + base URL + callback set). */
export function isCustomerPortalConfigured(): boolean {
	return getServerConfig() !== null && !!process.env["BD_AUTH_CALLBACK_URL"];
}

export type CustomerSession = {
	/** Raw `bd_session` cookie value — the portal session token. */
	token: string;
	organizationId: string;
	user: {
		id: string;
		email: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	role: string | null;
};

/** Read + validate the current customer session from the `bd_session`
 *  cookie on the request. Returns `null` when signed out or unconfigured. */
export async function getCustomerSession(
	request: Request,
): Promise<CustomerSession | null> {
	const cfg = getServerConfig();
	if (!cfg) return null;
	const token = (await sessionCookie.parse(request.headers.get("Cookie"))) as
		| string
		| null;
	if (!token) return null;
	try {
		const session = await getTenantSession({
			cookieValue: token,
			baseUrl: cfg.baseUrl,
			apiKey: cfg.apiKey,
		});
		if (!session) return null;
		return {
			token,
			organizationId: session.organizationId,
			user: session.user,
			role: session.role,
		};
	} catch {
		return null;
	}
}

/** Session-scoped customer-portal client for an already-validated session. */
function portalFor(session: CustomerSession) {
	const cfg = getServerConfig();
	if (!cfg) throw new Error("Customer portal is not configured.");
	return createBdApiClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })
		.customerPortal(session.organizationId)
		.withSession(session.token);
}

/**
 * Current customer's work bundle (jobs / quotes / invoices). Returns `null`
 * when signed out; `bundle.unlinked` is true when the account isn't yet
 * tied to any of the org's customer records.
 */
export async function getCustomerWork(
	request: Request,
): Promise<CustomerWorkBundle | null> {
	const session = await getCustomerSession(request);
	if (!session) return null;
	try {
		return await portalFor(session).getWork();
	} catch {
		return null;
	}
}

/**
 * Submit a review as the signed-in customer (optionally tied to one of
 * their jobs). Lands as `status: 'pending'` until staff moderates. Throws
 * when the customer isn't signed in.
 */
export async function submitCustomerReview(
	request: Request,
	input: CustomerReviewSubmitInput,
): Promise<CustomerReviewSubmitResponse> {
	const session = await getCustomerSession(request);
	if (!session) throw new Error("Not signed in.");
	return portalFor(session).submitReview(input);
}
