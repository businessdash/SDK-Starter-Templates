import type { AstroCookies } from "astro";
import { createBdApiClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";
// [bd:subscriptions]
import type { CustomerSubscriptionResponse } from "@businessdash/sdk/contracts";
// [/bd:subscriptions]

import { getBdEnv } from "./bd";

/**
 * Customer-portal helpers (SDK 0.9.x), adapted to Astro from DGP's
 * `bd-portal.ts`.
 *
 * Customer identity is WorkOS-backed BD auth: the `/api/bd-auth/*` handler
 * mints a `bd_session` httpOnly cookie, and portal calls run as
 * `customerPortal(org).withSession(token)`. There is no user-bound API key —
 * the site key + the session token are the whole auth surface, and the org is
 * read from the validated session. Server-only.
 */

const SESSION_COOKIE = "bd_session";

/** True when BD customer auth can run (API key + base URL set). */
export function isCustomerPortalConfigured(): boolean {
	return getBdEnv() !== null;
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

/** Read + validate the current customer session from the `bd_session` cookie. */
export async function getCustomerSession(
	cookies: AstroCookies,
): Promise<CustomerSession | null> {
	const env = getBdEnv();
	if (!env) return null;
	const token = cookies.get(SESSION_COOKIE)?.value ?? null;
	if (!token) return null;
	const session = await getTenantSession({
		cookieValue: token,
		baseUrl: env.baseUrl,
		apiKey: env.apiKey,
	});
	if (!session) return null;
	return {
		token,
		organizationId: session.organizationId,
		user: session.user,
		role: session.role,
	};
}

/** Build a session-scoped customer-portal client for a validated session. */
function portalFor(session: CustomerSession) {
	const env = getBdEnv();
	if (!env) throw new Error("Customer portal is not configured.");
	const client = createBdApiClient({
		apiKey: env.apiKey,
		baseUrl: env.baseUrl,
	});
	return client
		.customerPortal(session.organizationId)
		.withSession(session.token);
}

/**
 * Current customer's work bundle (jobs / quotes / invoices). Returns `null`
 * when signed out; `bundle.unlinked` is true when the account isn't yet tied
 * to any of the org's customer records.
 */
export async function getCustomerWork(
	cookies: AstroCookies,
): Promise<CustomerWorkBundle | null> {
	const session = await getCustomerSession(cookies);
	if (!session) return null;
	try {
		return await portalFor(session).getWork();
	} catch {
		return null;
	}
}

/**
 * Submit a review as the signed-in customer (optionally tied to one of their
 * jobs). Lands as `status: 'pending'` until staff moderates. Throws when the
 * customer isn't signed in.
 */
export async function submitCustomerReview(
	cookies: AstroCookies,
	input: CustomerReviewSubmitInput,
): Promise<CustomerReviewSubmitResponse> {
	const session = await getCustomerSession(cookies);
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
	cookies: AstroCookies,
	planId: string,
	urls: { successUrl: string; cancelUrl: string },
): Promise<{ url: string } | null> {
	const session = await getCustomerSession(cookies);
	const env = getBdEnv();
	if (!session || !env) return null;
	// The session rides as a header, so the checkout is the customer's own.
	const client = createBdApiClient({
		apiKey: env.apiKey,
		baseUrl: env.baseUrl,
		defaultHeaders: { "X-BD-Session-Token": session.token },
	});
	const res = await client.subscriptions.startCheckout(planId, urls);
	return { url: res.stripeUrl };
}

/** The signed-in customer's plan with this business, and what it offers. */
export async function getCustomerSubscription(
	cookies: AstroCookies,
): Promise<CustomerSubscriptionResponse | null> {
	const session = await getCustomerSession(cookies);
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
export async function setPlanCancelled(cookies: AstroCookies, cancel: boolean) {
	const session = await getCustomerSession(cookies);
	if (!session) throw new Error("Not signed in.");
	const portal = portalFor(session);
	return cancel ? portal.cancelSubscription() : portal.resumeSubscription();
}
// [/bd:subscriptions]
