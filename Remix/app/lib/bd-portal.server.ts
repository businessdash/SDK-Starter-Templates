import { createBdApiClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";
// [bd:subscriptions]
import type { CustomerSubscriptionResponse } from "@businessdash/sdk/contracts";
// [/bd:subscriptions]

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

/**
 * The `bd_session` cookie's raw value. The SDK's auth handler writes the
 * token as it is; React Router's `createCookie().parse()` expects its own
 * base64 JSON encoding and turns a raw token into `{}`, so it's read here
 * straight from the header.
 */
export function readSessionToken(request: Request): string | null {
	for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1 || part.slice(0, eq).trim() !== "bd_session") continue;
		const value = part.slice(eq + 1).trim();
		if (!value) return null;
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	return null;
}

/** True when BD customer auth can run (API key + base URL set). */
export function isCustomerPortalConfigured(): boolean {
	return getServerConfig() !== null;
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
	const token = readSessionToken(request);
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

// [bd:subscriptions]
/**
 * Start a Stripe subscription checkout for the signed-in customer. Returns
 * null when nobody is signed in: a plan belongs to a person, and BD refuses a
 * plan checkout without the customer's session.
 */
export async function startPlanCheckout(
	request: Request,
	planId: string,
	urls: { successUrl: string; cancelUrl: string },
): Promise<{ url: string } | null> {
	const session = await getCustomerSession(request);
	const cfg = getServerConfig();
	if (!session || !cfg) return null;
	// The session rides as a header, so the checkout is the customer's own.
	const client = createBdApiClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl,
		defaultHeaders: { "X-BD-Session-Token": session.token },
	});
	const res = await client.subscriptions.startCheckout(planId, urls);
	return { url: res.stripeUrl };
}

/** The signed-in customer's plan with this business, and what it offers. */
export async function getCustomerSubscription(
	request: Request,
): Promise<CustomerSubscriptionResponse | null> {
	const session = await getCustomerSession(request);
	if (!session) return null;
	try {
		return await portalFor(session).getSubscription();
	} catch {
		return null;
	}
}

/**
 * Cancel the plan at the end of the paid period, or take a pending cancel
 * back. Access runs until `accessUntil` either way.
 */
export async function setPlanCancelled(request: Request, cancel: boolean) {
	const session = await getCustomerSession(request);
	if (!session) throw new Error("Not signed in.");
	const portal = portalFor(session);
	return cancel ? portal.cancelSubscription() : portal.resumeSubscription();
}
// [/bd:subscriptions]
