import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { listServiceAreaVariants } from "../lib/biab-server-fns";

/**
 * Parallel-page index. Lists every (service × area) variant declared in
 * `biab.config.ts` (`defineParallelPage("service-area")`) and resolved by
 * BIAB via `parallelPages.listVariants`. Each links to the SSR-rendered
 * `/services/[service]/[area]` page. This is the link list a sitemap or
 * a "service areas" section would surface.
 */
export const Route = createFileRoute("/services/")({
	component: ServicesIndex,
	loader: () => listServiceAreaVariants(),
});

function titleCase(slug: string): string {
	return slug
		.split("-")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(" ");
}

function ServicesIndex() {
	const variants = Route.useLoaderData();

	return (
		<main>
			<section class="biab-section">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Coverage</span>
					<h1 class="biab-section__title">Services by area</h1>
					<p class="biab-section__sub">
						Programmatic pages: one URL per service × area. Tokens resolve
						server-side in BIAB so crawlers see fully-rendered copy.
					</p>
				</div>

				<Show
					when={variants().length > 0}
					fallback={
						<div class="biab-empty">
							No parallel-page variants yet. Seed services + service areas in
							BIAB, then run <code>npm run sync-schema</code>.
						</div>
					}
				>
					<div class="biab-grid-3">
						<For each={variants()}>
							{(v) => (
								<Link
									to="/services/$service/$area"
									params={{ service: v.service, area: v.area }}
									class="biab-card service-card"
									style="text-decoration: none; border-bottom: none;"
								>
									<h3>{titleCase(v.service)}</h3>
									<p>{titleCase(v.area)}</p>
								</Link>
							)}
						</For>
					</div>
				</Show>
			</section>
		</main>
	);
}
