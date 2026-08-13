import { component$ } from "@builder.io/qwik";
import {
	type DocumentHead,
	Link,
	routeLoader$,
} from "@builder.io/qwik-city";

import { Footer } from "../../components/biab/Footer";
import { SiteHeader } from "../../components/biab/SiteHeader";
import { getBiab } from "../../lib/biab";
import { getCustomerSession } from "../../lib/biab-portal";

/**
 * Index for the programmatic (service × area) parallel pages. Lists every
 * materialised variant from `client.parallelPages.listVariants("service-area")`
 * and links into the per-variant SSR render route.
 */
export const useVariants = routeLoader$(async ({ cookie }) => {
	const biab = getBiab();
	const session = await getCustomerSession(cookie);
	if (!biab) {
		return { configured: false, variants: [], signedIn: !!session };
	}
	try {
		const { variants } = await biab.parallelPages.listVariants("service-area");
		return {
			configured: true,
			variants: variants.map((v) => ({
				service: v.service ?? "",
				area: v.area ?? "",
			})),
			signedIn: !!session,
		};
	} catch {
		return { configured: true, variants: [], signedIn: !!session };
	}
});

export default component$(() => {
	const data = useVariants();

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main>
				<section class="biab-section">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">Programmatic SEO</span>
						<h2 class="biab-section__title">Service areas</h2>
						<p class="biab-section__sub">
							One page per (service × area), fanned out from
							<code> biab.config.ts</code> and rendered with tokens resolved
							server-side by BIAB.
						</p>
					</div>

					{!data.value.configured ? (
						<div class="biab-empty">
							Parallel pages aren't connected yet. Set the BIAB env vars and run
							<code> sync-schema</code>.
						</div>
					) : data.value.variants.length === 0 ? (
						<div class="biab-empty">
							No variants yet. Add services + service areas in BIAB, then publish.
						</div>
					) : (
						<div class="biab-grid-3">
							{data.value.variants.map((v) => (
								<Link
									class="biab-card service-card"
									href={`/services/${v.service}/${v.area}`}
									key={`${v.service}/${v.area}`}
								>
									<h3 style="text-transform: capitalize;">
										{v.service.replace(/-/g, " ")}
									</h3>
									<p style="text-transform: capitalize;">
										in {v.area.replace(/-/g, " ")}
									</p>
								</Link>
							))}
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Service areas — Your Business",
	meta: [
		{
			name: "description",
			content: "Programmatic service-area pages powered by BIAB parallel pages.",
		},
	],
};
