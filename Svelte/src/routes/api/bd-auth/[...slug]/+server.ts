import { BD_PACKAGE_API_BASE_URL, BD_API_KEY, BD_AUTH_CALLBACK_URL } from '$app/env/private';

import { createAuthHandler } from '@businessdash/sdk';

import type { RequestHandler } from './$types';

/**
 * BD customer-auth handler for the org bound to BD_API_KEY, mounted as a
 * catch-all for every sub-route under `/api/bd-auth/*`. Behind the sign-in
 * screen on /my-account (`<BdSignIn>`): `customer/*` (password, emailed
 * codes) and `customer/oauth/*` ("Continue with Google / Apple / GitHub /
 * Discord"), all WorkOS underneath through BD. It sets the `bd_session`
 * httpOnly cookie on this domain; `me` and `sign-out` round it out.
 *
 * `createAuthHandler` returns framework-agnostic web handlers — each
 * takes the raw `Request` and returns a `Response`, which is exactly what
 * a SvelteKit `+server.ts` handler returns, so we pass `event.request`
 * straight through.
 *
 * Needs BD_API_KEY + BD_PACKAGE_API_BASE_URL; returns a 503 when
 * unconfigured so the rest of the site still renders. BD_AUTH_CALLBACK_URL
 * is only for the older hosted page (`sign-in` / `sign-up` redirects).
 * When set, prove its host once in Business Dash → Developer & API keys → Sign-in.
 */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, '');
	if (next.endsWith('/api/package/v1')) return next;
	return `${next}/api/package/v1`;
}

const rawBaseUrl = BD_PACKAGE_API_BASE_URL ?? '';
const apiKey = BD_API_KEY ?? '';
const callbackUrl = BD_AUTH_CALLBACK_URL ?? '';

const handler =
	apiKey && rawBaseUrl
		? createAuthHandler({
				baseUrl: normalizeBaseUrl(rawBaseUrl),
				apiKey,
				...(callbackUrl ? { callbackUrl } : {}),
				basePath: '/api/bd-auth',
				defaultReturnTo: '/my-account',
				signOutReturnTo: '/',
				cookieName: 'bd_session'
			})
		: null;

function unavailable(): Response {
	return new Response(
		JSON.stringify({
			ok: false,
			reason: 'BD auth not configured. Set BD_API_KEY and BD_PACKAGE_API_BASE_URL.'
		}),
		{ status: 503, headers: { 'Content-Type': 'application/json' } }
	);
}

export const GET: RequestHandler = async ({ request }) =>
	handler ? handler.GET(request) : unavailable();

export const POST: RequestHandler = async ({ request }) =>
	handler ? handler.POST(request) : unavailable();
