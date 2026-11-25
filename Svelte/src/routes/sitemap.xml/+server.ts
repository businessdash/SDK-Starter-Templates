import { buildSitemap, minimalSitemapXml } from '@businessdash/sdk/sitemap';
import { BD_SITE_ID } from '$app/env/private';
import { PUBLIC_BD_SITE_ID } from '$app/env/public';

import { bd } from '#lib/server/bd.ts';
import type { RequestHandler } from './$types';

/**
 * The sitemap, assembled from three sources: your own pages, what BusinessDash
 * owns the shape of (site pages, legal documents, programmatic pages), and
 * platform content mapped onto YOUR routes.
 *
 * Everything in `routes` is opt-in — delete a line and those URLs vanish, which
 * is right for a business without that surface. A missing URL costs one page's
 * indexing; a sitemap full of 404s costs trust in every URL in the file. The
 * customer portal and other token-gated paths are excluded automatically.
 */

/** Pages that live in THIS repo. Keep in step with `src/routes/`. */
const STATIC_PATHS = [
	'/',
	'/services',
	'/reviews',
	'/updates',
	// [bd:blog]
	'/blog',
	// [/bd:blog]
	// [bd:store]
	'/store',
	'/store/wishlist',
	'/store/compare',
	// [/bd:store]
	// [bd:subscriptions]
	'/store/subscriptions',
	// [/bd:subscriptions]
	'/todos'
];

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	if (!bd) {
		return new Response(minimalSitemapXml(baseUrl), {
			headers: { 'Content-Type': 'application/xml; charset=utf-8' }
		});
	}

	const xml = await buildSitemap({
		client: bd,
		siteId: PUBLIC_BD_SITE_ID ?? BD_SITE_ID ?? '',
		baseUrl,
		staticPaths: STATIC_PATHS,
		routes: {
			// [bd:store]
			product: '/store',
			// [/bd:store]
			// [bd:blog]
			blog: '/blog'
			// [/bd:blog]
		},
		onSkip: (section, reason) => console.info(`[sitemap] skipped ${section}: ${reason}`)
	});

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
