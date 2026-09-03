import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
	legalPageSeo,
	renderLegalPageHtml,
	resolveLegalPage,
} from "@businessdash/sdk/legal";

import { getBd } from "@/server/lib/bd";

/**
 * The catch-all — legal pages, and everything else's 404.
 *
 * ## Your own pages always win, and nothing here can break that
 *
 * Next resolves a static segment before a catch-all, so `app/privacy/page.tsx`
 * shadows this file completely. Write your own privacy policy and this is never
 * consulted for that path — no config, no conflict, no build error, nothing to
 * delete. That is exactly why the SDK hands you a resolver instead of
 * generating `app/privacy/page.tsx`: two files claiming one route is a hard
 * build failure, which would turn "I wrote my own policy" into a broken deploy.
 *
 * ## Anything not a legal page falls through
 *
 * `resolveLegalPage()` returns null for an unknown slug and this calls
 * `notFound()`, which renders `app/not-found.tsx` with a real 404 status. It
 * also returns null rather than throwing when BusinessDash is unreachable —
 * this route runs on every unmatched URL, so an exception here would 500 the
 * whole site during an outage instead of 404ing one page.
 */

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const client = getBd();
	if (!client) return {};
	const { slug } = await params;
	const document = await resolveLegalPage({ client, slug });
	if (!document) return {};

	const seo = legalPageSeo(document, { siteName: "Your Company" });
	return {
		title: seo.title,
		description: seo.description,
		openGraph: { title: seo.openGraph.title, type: "article" },
	};
}

export default async function CatchAllPage({ params }: Props) {
	const client = getBd();
	const { slug } = await params;
	const document = client ? await resolveLegalPage({ client, slug }) : null;
	if (!document) notFound();

	return (
		<main className="bd-section bd-section--narrow">
			{/*
			 * `contentHtml` is sanitised server-side when the org saves it, and
			 * the title and logo URL are escaped by `renderLegalPageHtml`. Style
			 * it through the `data-bd-legal-*` hooks it emits — the markup
			 * ships unstyled so it inherits your site rather than fighting it.
			 */}
			<div
				dangerouslySetInnerHTML={{ __html: renderLegalPageHtml(document) }}
			/>
		</main>
	);
}
