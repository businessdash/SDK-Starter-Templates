import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
	type BiabClient,
	createAuthHandler,
	createBiabClient,
	createBiabDevClient,
	getTenantSession,
} from "@businessdash/sdk";
import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

import { invalidateTags } from "./cache";

/**
 * Server-side BIAB client. HTMX renders are entirely server-side
 * — the browser only receives HTML, never the SDK or the bearer
 * key. One client instance is reused across requests.
 *
 * Returns `null` when env isn't configured so section endpoints
 * can render local fallbacks (no crash, no blank page).
 */

const apiKey = process.env["BIAB_API_KEY"];
// This starter is server-rendered (no client bundle), so it reads plain env
// vars directly — there's no public/private split to consolidate here.
const siteId = process.env["BIAB_SITE_ID"];
const rawBaseUrl = process.env["BIAB_PACKAGE_API_BASE_URL"];
const callbackUrl = process.env["BIAB_AUTH_CALLBACK_URL"];
const revalidationSecret = process.env["BIAB_REVALIDATION_SECRET"];

function normaliseBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

/** Host root (e.g. https://www.biab.app) — sitemap/robots live here. */
export const hostBase = rawBaseUrl ? rawBaseUrl.trim().replace(/\/+$/, "") : null;
/** Package API base (…/api/package/v1). */
export const packageBase = rawBaseUrl ? normaliseBaseUrl(rawBaseUrl) : null;
export const SITE_ID = siteId ?? null;
export const API_KEY = apiKey ?? null;

/** True once the site is wired to BIAB (site id resolved). Drives the
 *  dismissable "not connected" setup banner in the page shell. */
export const BIAB_CONFIGURED = Boolean(siteId);
/** Host root for dashboard links (falls back to production). */
export const BIAB_HOST = hostBase ?? "https://www.biab.app";

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	if (!apiKey || !siteId || !packageBase) {
		cached = null;
		return cached;
	}
	cached = createBiabClient({ apiKey, siteId, baseUrl: packageBase });
	return cached;
}

export const ANALYTICS_PUBLIC = {
	siteId: siteId ?? null,
	baseUrl: packageBase,
	apiKey: apiKey ?? null,
};

/**
 * Custom-database reader for the Todos demo — the SDK's documented READ path
 * for custom collections is `createBiabDevClient(...).site(id).dataModel`
 * (`listRecords({ object })`). Needs `metadata:read_records` on the key;
 * null when env isn't configured.
 */
export function getBiabDataModel() {
	if (!apiKey || !siteId || !packageBase) return null;
	return createBiabDevClient({ apiKey, baseUrl: packageBase })
		.site(siteId)
		.dataModel;
}

/** True when a thrown SDK error means the org's site is suspended. */
export function isUnavailable(err: unknown): boolean {
	return err instanceof BiabServiceSuspendedError || err instanceof BiabPaymentLapsedError;
}

// ── auth + portal ──────────────────────────────────────────────────

/** WorkOS-backed sign-in/up/out + callback. Null when not configured. */
export const authHandler =
	apiKey && packageBase && callbackUrl
		? createAuthHandler({
				baseUrl: packageBase,
				apiKey,
				callbackUrl,
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
			})
		: null;

export type CustomerSession = {
	token: string;
	organizationId: string;
	user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
	role: string | null;
};

/** Validate the `biab_session` cookie value against BIAB. */
export async function getSession(cookieValue: string | null): Promise<CustomerSession | null> {
	if (!apiKey || !packageBase || !cookieValue) return null;
	try {
		const s = await getTenantSession({ cookieValue, baseUrl: packageBase, apiKey });
		if (!s) return null;
		return { token: cookieValue, organizationId: s.organizationId, user: s.user, role: s.role };
	} catch {
		return null;
	}
}

/** Session-scoped customer-portal client. */
export function portalFor(session: CustomerSession) {
	const client = createBiabDevClient({ apiKey: apiKey as string, baseUrl: packageBase as string });
	return client.customerPortal(session.organizationId).withSession(session.token);
}

// ── revalidation webhook ───────────────────────────────────────────

/** HMAC-verified publish webhook → busts the in-memory tag cache. */
export const revalidateHandler = revalidationSecret
	? createGenericRevalidateHandler({
			secret: revalidationSecret,
			onTagsRevalidated: (tags) => {
				const n = invalidateTags(tags);
				console.log(`[biab] revalidate: evicted ${n} cache entr${n === 1 ? "y" : "ies"} for`, tags);
			},
		})
	: null;
