import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { getLegalPage } from "../lib/biab-server-fns";

/**
 * The splat route — legal pages, and everything else's 404.
 *
 * ## Your own routes always win
 *
 * TanStack Router resolves a static segment before a splat, so
 * `routes/privacy.tsx` shadows this file entirely. Write your own privacy
 * policy and this is never consulted for that path — no config, no conflict, no
 * build error, nothing to delete. That is why the SDK hands you a resolver
 * rather than generating `routes/privacy.tsx`: two files claiming one route is
 * a build failure, which would turn "I wrote my own policy" into a broken
 * deploy.
 */
export const Route = createFileRoute("/$")({
	component: CatchAll,
	loader: ({ params }) =>
		getLegalPage({ data: { slug: params._splat ?? "" } }),
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.found ? loaderData.title : "Page not found" }],
	}),
});

function CatchAll() {
	const data = Route.useLoaderData();

	return (
		<Show
			when={data().found ? data() : null}
			fallback={
				<main class="biab-section biab-section--narrow">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">404</span>
						<h1 class="biab-section__title">We couldn't find that page</h1>
						<p class="biab-section__sub">
							The link may be out of date, or the page may have moved.
						</p>
					</div>
					<p>
						<a href="/">Back to the homepage</a>
					</p>
				</main>
			}
		>
			{(page) => (
				<main class="biab-section biab-section--narrow">
					{/*
					 * `html` is sanitised server-side when the org saves it, and
					 * the title and logo URL are escaped by
					 * `renderLegalPageHtml`. Style it via the
					 * `data-biab-legal-*` hooks — the markup ships unstyled so
					 * it inherits your site rather than fighting it.
					 */}
					<div innerHTML={page().html} />
				</main>
			)}
		</Show>
	);
}
