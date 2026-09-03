import { component$ } from "@builder.io/qwik";
import {
	type DocumentHead,
	Link,
	routeLoader$,
} from "@builder.io/qwik-city";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { getCustomerSession } from "../../lib/bd-portal";

/**
 * Index for the programmatic (service × area) parallel pages. Lists every
 * materialised variant from `client.parallelPages.listVariants("service-area")`
 * and links into the per-variant SSR render route.
 */
export const useVariants = routeLoader$(async ({ cookie }) => {
	const bd = getBd();
	const session = await getCustomerSession(cookie);
	if (!bd) {
		return { configured: false, variants: [], signedIn: !!session };
	}
	try {
		const { variants } = await bd.parallelPages.listVariants("service-area");
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
				<section class="bd-section">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Programmatic SEO</span>
						<h2 class="bd-section__title">Service areas</h2>
						<p class="bd-section__sub">
							One page per (service × area), fanned out from
							<code> bd.config.ts</code> and rendered with tokens resolved
							server-side by BD.
						</p>
					</div>

					{!data.value.configured ? (
						<div class="bd-empty">
							Parallel pages aren't connected yet. Set the BD env vars and run
							<code> sync-schema</code>.
						</div>
					) : data.value.variants.length === 0 ? (
						<div class="bd-empty">
							No variants yet. Add services + service areas in BD, then publish.
						</div>
					) : (
						<div class="bd-grid-3">
							{data.value.variants.map((v) => (
								<Link
									class="bd-card service-card"
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
			content: "Programmatic service-area pages powered by BD parallel pages.",
		},
	],
};
