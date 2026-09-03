import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import {
	legalPageSeo,
	renderLegalPageHtml,
	resolveLegalPage,
} from "@businessdash/sdk/legal";

import { getBd } from "../../lib/bd";

/**
 * The catch-all — legal pages, and everything else's 404.
 *
 * ## Your own routes always win
 *
 * Qwik City resolves a static segment before a rest parameter, so
 * `routes/privacy/index.tsx` shadows this file entirely. Write your own privacy
 * policy and this is never consulted for that path — no config, no conflict, no
 * build error, nothing to delete. That is why the SDK hands you a resolver
 * rather than generating a `privacy` route: two routes claiming one path is a
 * build failure, which would turn "I wrote my own policy" into a broken deploy.
 */
export const useLegalPage = routeLoader$(async (event) => {
	const client = getBd();
	// Returns null for an unknown slug AND when BusinessDash is unreachable —
	// this route runs on every unmatched URL, so it must never throw.
	const document = client
		? await resolveLegalPage({ client, slug: event.params["slug"] })
		: null;

	if (!document) {
		// A real 404 status, so crawlers and uptime checks see the truth
		// rather than a 200 with an apology on it.
		event.status(404);
		return null;
	}

	return {
		title: document.title,
		description: legalPageSeo(document).description,
		html: renderLegalPageHtml(document),
	};
});

export default component$(() => {
	const page = useLegalPage();

	if (!page.value) {
		return (
			<main class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">404</span>
					<h1 class="bd-section__title">We couldn't find that page</h1>
					<p class="bd-section__sub">
						The link may be out of date, or the page may have moved.
					</p>
				</div>
				<p>
					<a href="/">Back to the homepage</a>
				</p>
			</main>
		);
	}

	return (
		<main class="bd-section bd-section--narrow">
			{/*
			 * `html` is sanitised server-side when the org saves it, and the
			 * title and logo URL are escaped by `renderLegalPageHtml`. Style it
			 * via the `data-bd-legal-*` hooks — the markup ships unstyled so
			 * it inherits your site rather than fighting it.
			 */}
			<div dangerouslySetInnerHTML={page.value.html} />
		</main>
	);
});

export const head: DocumentHead = ({ resolveValue }) => {
	const page = resolveValue(useLegalPage);
	if (!page) return { title: "Page not found" };
	return {
		title: page.title,
		meta: [{ name: "description", content: page.description }],
	};
};
