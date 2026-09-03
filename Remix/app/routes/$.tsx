import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { renderLegalPageHtml, resolveLegalPage } from "@businessdash/sdk/legal";

import { SiteHeader } from "~/components/SiteHeader";
import { getBd } from "~/lib/bd.server";

/**
 * The splat route — legal pages, and everything else's 404.
 *
 * ## Your own routes always win
 *
 * React Router resolves a static route before a splat, so `routes/privacy.tsx`
 * shadows this file entirely. Write your own privacy policy and this is never
 * consulted for that path — no config, no conflict, no build error, nothing to
 * delete. That is why the SDK hands you a resolver rather than generating
 * `routes/privacy.tsx`: two files claiming one route is a build failure, which
 * would turn "I wrote my own policy" into a broken deploy.
 */
export async function loader({ params }: LoaderFunctionArgs) {
	const client = getBd();
	// Returns null for an unknown slug AND when BusinessDash is unreachable —
	// this route runs on every unmatched URL, so it must never throw.
	const document = client
		? await resolveLegalPage({ client, slug: params["*"] })
		: null;

	if (!document) {
		// A real 404 status, so crawlers and uptime checks see the truth rather
		// than a 200 page with an apology on it.
		return data({ found: false as const }, { status: 404 });
	}

	return data({
		found: true as const,
		title: document.title,
		html: renderLegalPageHtml(document),
	});
}

export const meta: MetaFunction<typeof loader> = ({ data: loaded }) => [
	{ title: loaded?.found ? loaded.title : "Page not found" },
];

export default function CatchAllRoute() {
	const loaded = useLoaderData<typeof loader>();

	if (!loaded.found) {
		return (
			<>
				<SiteHeader />
				<main className="bd-section bd-section--narrow">
					<div className="bd-section__lead">
						<span className="bd-section__eyebrow">404</span>
						<h1 className="bd-section__title">
							We couldn&apos;t find that page
						</h1>
						<p className="bd-section__sub">
							The link may be out of date, or the page may have moved.
						</p>
					</div>
					<p>
						<a href="/">Back to the homepage</a>
					</p>
				</main>
			</>
		);
	}

	return (
		<>
			<SiteHeader />
			{/*
			 * `html` is sanitised server-side when the org saves it, and the
			 * title and logo URL are escaped by `renderLegalPageHtml`. Style it
			 * via the `data-bd-legal-*` hooks — the markup ships unstyled so
			 * it inherits your site rather than fighting it.
			 */}
			<main
				className="bd-section bd-section--narrow"
				dangerouslySetInnerHTML={{ __html: loaded.html }}
			/>
		</>
	);
}
