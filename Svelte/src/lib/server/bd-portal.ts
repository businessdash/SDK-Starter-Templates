import { BD_API_KEY, BD_PACKAGE_API_BASE_URL, NODE_ENV } from '$app/env/private';

import { createBdApiClient, getTenantSession } from '@businessdash/sdk';
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle
} from '@businessdash/sdk/contracts';
// [bd:subscriptions]
import type { CustomerSubscriptionResponse } from '@businessdash/sdk/contracts';
// [/bd:subscriptions]

/**
 * Customer-portal helpers (SDK 0.9.x).
 *
 * Customer identity is WorkOS-backed BD auth: the `/api/bd-auth/*`
 * handler mints a `bd_session` httpOnly cookie, and portal calls run
 * as `customerPortal(org).withSession(token)`. There's no user-bound API
 * key — the site key + the session token are the whole auth surface, and
 * the org is read from the validated session. All server-only.
 */

export const SESSION_COOKIE = 'bd_session';

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, '');
	if (next.endsWith('/api/package/v1')) return next;
	return `${next}/api/package/v1`;
}

type BaseConfig = { apiKey: string; baseUrl: string };

function baseConfig(): BaseConfig | null {
	const apiKey = BD_API_KEY;
	const rawBaseUrl = BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !rawBaseUrl) return null;
	return { apiKey, baseUrl: normalizeBaseUrl(rawBaseUrl) };
}

/** True when BD customer auth can run (API key + base URL set). */
export function isCustomerPortalConfigured(): boolean {
	return baseConfig() !== null;
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

/**
 * Read + validate the current customer session from the `bd_session`
 * cookie value. `cookieValue` is the raw cookie string (read via
 * `event.cookies.get("bd_session")` in a load/endpoint). Returns null
 * when signed out or unconfigured.
 */
export async function getCustomerSession(
	cookieValue: string | null | undefined
): Promise<CustomerSession | null> {
	const cfg = baseConfig();
	if (!cfg) return null;
	if (!cookieValue) return null;
	const session = await getTenantSession({
		cookieValue,
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey
	});
	if (!session) return null;
	return {
		token: cookieValue,
		organizationId: session.organizationId,
		user: session.user,
		role: session.role
	};
}

/** Build a session-scoped customer-portal client for a validated session. */
function portalFor(session: CustomerSession) {
	const cfg = baseConfig();
	if (!cfg) throw new Error('Customer portal is not configured.');
	const client = createBdApiClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl
	});
	return client.customerPortal(session.organizationId).withSession(session.token);
}

/**
 * The signed-in customer's work bundle (jobs / quotes / invoices /
 * contracts / payments). Returns null when signed out; `bundle.unlinked`
 * is true when the account isn't yet tied to a CRM contact.
 */
export async function getCustomerWork(
	cookieValue: string | null | undefined
): Promise<CustomerWorkBundle | null> {
	const session = await getCustomerSession(cookieValue);
	if (!session) return null;
	try {
		return await portalFor(session).getWork();
	} catch (err) {
		if (NODE_ENV === 'development') {
			console.warn(
				`[bd-portal] getWork failed: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		return null;
	}
}

/**
 * Submit a review as the signed-in customer (optionally tied to one of
 * their jobs). Lands as `status: 'pending'` until staff moderate. Throws
 * when the customer isn't signed in.
 */
export async function submitCustomerReview(
	cookieValue: string | null | undefined,
	input: CustomerReviewSubmitInput
): Promise<CustomerReviewSubmitResponse> {
	const session = await getCustomerSession(cookieValue);
	if (!session) throw new Error('Not signed in.');
	return portalFor(session).submitReview(input);
}

/**
 * Submit a review for a session already checked with `getCustomerSession`
 * (the reviews page knows who is signed in before it sends).
 */
export function submitReviewAs(
	session: CustomerSession,
	input: CustomerReviewSubmitInput
): Promise<CustomerReviewSubmitResponse> {
	return portalFor(session).submitReview(input);
}

// [bd:subscriptions]
/**
 * Start a Stripe subscription checkout for the signed-in customer. Returns
 * null when nobody is signed in: a plan belongs to a person, and BD refuses a
 * plan checkout without the customer's session.
 */
export async function startPlanCheckout(
	cookieValue: string | null | undefined,
	planId: string,
	urls: { successUrl: string; cancelUrl: string }
): Promise<{ url: string } | null> {
	const session = await getCustomerSession(cookieValue);
	const cfg = baseConfig();
	if (!session || !cfg) return null;
	// The session rides as a header, so the checkout is the customer's own.
	const client = createBdApiClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl,
		defaultHeaders: { 'X-BD-Session-Token': session.token }
	});
	const res = await client.subscriptions.startCheckout(planId, urls);
	return { url: res.stripeUrl };
}

/** The signed-in customer's plan with this business, and what it offers. */
export async function getCustomerSubscription(
	cookieValue: string | null | undefined
): Promise<CustomerSubscriptionResponse | null> {
	const session = await getCustomerSession(cookieValue);
	if (!session) return null;
	try {
		return await portalFor(session).getSubscription();
	} catch (err) {
		if (NODE_ENV === 'development') {
			console.warn(
				`[bd-portal] getSubscription failed: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		return null;
	}
}

/**
 * Cancel the plan at the end of the paid period, or take a pending cancel
 * back. Access runs until `accessUntil` either way.
 */
export async function setPlanCancelled(cookieValue: string | null | undefined, cancel: boolean) {
	const session = await getCustomerSession(cookieValue);
	if (!session) throw new Error('Not signed in.');
	const portal = portalFor(session);
	return cancel ? portal.cancelSubscription() : portal.resumeSubscription();
}
// [/bd:subscriptions]
