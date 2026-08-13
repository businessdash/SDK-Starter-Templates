import { env } from "$env/dynamic/private";

import { createBiabDevClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";

/**
 * Customer-portal helpers (SDK 0.9.x).
 *
 * Customer identity is WorkOS-backed BIAB auth: the `/api/biab-auth/*`
 * handler mints a `biab_session` httpOnly cookie, and portal calls run
 * as `customerPortal(org).withSession(token)`. There's no user-bound API
 * key — the site key + the session token are the whole auth surface, and
 * the org is read from the validated session. All server-only.
 */

export const SESSION_COOKIE = "biab_session";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

type BaseConfig = { apiKey: string; baseUrl: string };

function baseConfig(): BaseConfig | null {
	const apiKey = env.BIAB_API_KEY;
	const rawBaseUrl = env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !rawBaseUrl) return null;
	return { apiKey, baseUrl: normalizeBaseUrl(rawBaseUrl) };
}

/** True when BIAB customer auth can run (API key + base URL + callback set). */
export function isCustomerPortalConfigured(): boolean {
	return baseConfig() !== null && !!env.BIAB_AUTH_CALLBACK_URL;
}

export type CustomerSession = {
	/** Raw `biab_session` cookie value — the portal session token. */
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
 * Read + validate the current customer session from the `biab_session`
 * cookie value. `cookieValue` is the raw cookie string (read via
 * `event.cookies.get("biab_session")` in a load/endpoint). Returns null
 * when signed out or unconfigured.
 */
export async function getCustomerSession(
	cookieValue: string | null | undefined,
): Promise<CustomerSession | null> {
	const cfg = baseConfig();
	if (!cfg) return null;
	if (!cookieValue) return null;
	const session = await getTenantSession({
		cookieValue,
		baseUrl: cfg.baseUrl,
		apiKey: cfg.apiKey,
	});
	if (!session) return null;
	return {
		token: cookieValue,
		organizationId: session.organizationId,
		user: session.user,
		role: session.role,
	};
}

/** Build a session-scoped customer-portal client for a validated session. */
function portalFor(session: CustomerSession) {
	const cfg = baseConfig();
	if (!cfg) throw new Error("Customer portal is not configured.");
	const client = createBiabDevClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl,
	});
	return client
		.customerPortal(session.organizationId)
		.withSession(session.token);
}

/**
 * The signed-in customer's work bundle (jobs / quotes / invoices /
 * contracts / payments). Returns null when signed out; `bundle.unlinked`
 * is true when the account isn't yet tied to a CRM contact.
 */
export async function getCustomerWork(
	cookieValue: string | null | undefined,
): Promise<CustomerWorkBundle | null> {
	const session = await getCustomerSession(cookieValue);
	if (!session) return null;
	try {
		return await portalFor(session).getWork();
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab-portal] getWork failed: ${err instanceof Error ? err.message : String(err)}`,
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
	input: CustomerReviewSubmitInput,
): Promise<CustomerReviewSubmitResponse> {
	const session = await getCustomerSession(cookieValue);
	if (!session) throw new Error("Not signed in.");
	return portalFor(session).submitReview(input);
}
