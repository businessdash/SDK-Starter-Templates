import { createFileRoute, Link } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { renderServiceAreaPage } from "../lib/biab-server-fns";

/**
 * Programmatic SEO page: /services/[service]/[area]. SSR-rendered — the
 * loader calls `parallelPages.render("service-area", { service, area })`,
 * which resolves all tokens server-side in BIAB. The `head` callback
 * lifts the returned meta (title / description / canonical) into the
 * document head so crawlers see fully-resolved tags. Suspended-billing
 * orgs degrade to a minimal "unavailable" state.
 */
export const Route = createFileRoute("/services/$service/$area")({
	component: ServiceAreaPage,
	loader: ({ params }) =>
		renderServiceAreaPage({
			data: { service: params.service, area: params.area },
		}),
	head: ({ loaderData }) => {
		if (!loaderData || !loaderData.ok)
			return { meta: [{ title: "Not found" }] };
		const meta: Array<Record<string, string>> = [
			{ title: loaderData.meta.title },
			{ name: "description", content: loaderData.meta.description },
		];
		const links = loaderData.meta.canonical
			? [{ rel: "canonical", href: loaderData.meta.canonical }]
			: undefined;
		return { meta, ...(links ? { links } : {}) };
	},
});

function ServiceAreaPage() {
	const result = Route.useLoaderData();
	const reason = () => {
		const r = result();
		return r.ok ? null : r.reason;
	};

	return (
		<main>
			<section class="biab-section biab-section--narrow">
				<Link
					to="/services"
					class="biab-section__eyebrow"
					style="display: inline-block; margin-bottom: 1rem;"
				>
					← All areas
				</Link>

				<Show
					when={result().ok}
					fallback={
						<div class="biab-empty">
							<Show
								when={reason() === "suspended"}
								fallback={<>This page isn't available.</>}
							>
								This page is temporarily unavailable. Please check back soon.
							</Show>
						</div>
					}
				>
					{(() => {
						const r = result();
						if (!r.ok) return null;
						const body = r.body as {
							PageTitle?: string;
							PageHeadline?: string;
							intro?: string;
						} | null;
						return (
							<>
								<h1 class="biab-section__title" style="text-align: left;">
									{r.meta.title.split(" | ")[0]}
								</h1>
								<p class="biab-section__sub" style="margin: 0.75rem 0 2rem;">
									{r.meta.description}
								</p>
								<Show
									when={body?.PageTitle || body?.PageHeadline || body?.intro}
								>
									<div class="biab-card" style="padding: 1.5rem;">
										<Show when={body?.PageTitle}>
											<h2 style="font-size: 1.25rem; margin-bottom: 0.5rem;">
												{body?.PageTitle}
											</h2>
										</Show>
										<Show when={body?.PageHeadline}>
											<p style="margin-bottom: 0.75rem;">
												{body?.PageHeadline}
											</p>
										</Show>
										<Show when={body?.intro}>
											<p>{body?.intro}</p>
										</Show>
									</div>
								</Show>
							</>
						);
					})()}
				</Show>
			</section>
		</main>
	);
}
