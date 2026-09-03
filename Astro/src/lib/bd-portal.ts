import type { AstroCookies } from "astro";
import { createBdApiClient, getTenantSession } from "@businessdash/sdk";
import type {
	CustomerReviewSubmitInput,
	CustomerReviewSubmitResponse,
	CustomerWorkBundle,
} from "@businessdash/sdk/contracts";

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

const callbackUrl =
	import.meta.env.BD_AUTH_CALLBACK_URL ??
	process.env.BD_AUTH_CALLBACK_URL;

/** True when BD customer auth can run (API key + base URL + callback set). */
export function isCustomerPortalConfigured(): boolean {
	return getBdEnv() !== null && !!callbackUrl;
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
