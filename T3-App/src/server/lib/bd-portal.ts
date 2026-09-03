import "server-only";

import { createBdApiClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";
import { cookies } from "next/headers";

import { env } from "@/env";

/**
 * Customer-portal helpers (SDK 0.9.x).
 *
 * Customer identity is WorkOS-backed BD auth: the `/api/bd-auth/*` handler
 * mints a `bd_session` httpOnly cookie, and portal calls run as
 * `customerPortal(org).withSession(token)`. There is no user-bound API key —
 * the site key + the session token are the whole auth surface, and the org is
 * read from the validated session. Server-only.
 */

const SESSION_COOKIE = "bd_session";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

type BaseConfig = { apiKey: string; baseUrl: string };

function baseConfig(): BaseConfig | null {
	const apiKey = env.BD_API_KEY;
	const rawBaseUrl = env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !rawBaseUrl) return null;
	return { apiKey, baseUrl: normalizeBaseUrl(rawBaseUrl) };
}

/** True when BD customer auth can run (API key + base URL + callback set). */
export function isCustomerPortalConfigured(): boolean {
	return baseConfig() !== null && !!env.BD_AUTH_CALLBACK_URL;
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
export async function getCustomerSession(): Promise<CustomerSession | null> {
	const cfg = baseConfig();
	if (!cfg) return null;
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value ?? null;
	if (!token) return null;
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
}

/** Build a session-scoped customer-portal client for an already-validated session. */
function portalFor(session: CustomerSession) {
	const cfg = baseConfig();
	if (!cfg) throw new Error("Customer portal is not configured.");
	const client = createBdApiClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl,
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
export async function getCustomerWork(): Promise<CustomerWorkBundle | null> {
	const session = await getCustomerSession();
	if (!session) return null;
	return portalFor(session).getWork();
}

/**
 * Submit a review as the signed-in customer (optionally tied to one of their
 * jobs). Lands as `status: 'pending'` until staff moderates. Throws when the
 * customer isn't signed in.
 */
export async function submitCustomerReview(
	input: CustomerReviewSubmitInput,
): Promise<CustomerReviewSubmitResponse> {
	const session = await getCustomerSession();
	if (!session) throw new Error("Not signed in.");
	return portalFor(session).submitReview(input);
}
