import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";

import { Footer } from "../../../../components/bd/Footer";
import { SiteHeader } from "../../../../components/bd/SiteHeader";
import { getBd } from "../../../../lib/bd";
import { getCustomerSession } from "../../../../lib/bd-portal";

/**
 * One programmatic (service × area) page. `client.parallelPages.render(
 * "service-area", { service, area })` returns `{ meta, body }` with tokens
 * (`{service.type}`, `{area.name}`, …) already resolved server-side by BD,
 * so crawlers see fully-rendered HTML.
 *
 * Suspension handling: a fully-suspended org throws `BdServiceSuspendedError`
 * → we set a 503 and render a minimal unavailable state so search engines
 * treat the outage as temporary.
 */
export const useVariant = routeLoader$(async ({ params, cookie, status }) => {
	const bd = getBd();
	const session = await getCustomerSession(cookie);
	if (!bd) {
		status(404);
		return { state: "notfound" as const, signedIn: !!session };
	}
	try {
		const rendered = await bd.parallelPages.render("service-area", {
			service: params.service,
			area: params.area,
		});
		return {
			state: "ok" as const,
			meta: rendered.meta,
			body: rendered.body,
			signedIn: !!session,
		};
	} catch (err) {
		if (err instanceof BdServiceSuspendedError) {
			status(503);
			return { state: "suspended" as const, signedIn: !!session };
		}
		if (err instanceof BdPaymentLapsedError) {
			status(404);
			return { state: "notfound" as const, signedIn: !!session };
		}
		status(404);
		return { state: "notfound" as const, signedIn: !!session };
	}
});

export default component$(() => {
	const data = useVariant();
	const value = data.value;

	const body =
		value.state === "ok"
			? (value.body as { PageTitle?: string; PageHeadline?: string } | null)
			: null;

	return (
		<>
			<SiteHeader signedIn={value.signedIn} />
			<main>
				<section class="bd-section bd-section--narrow">
					{value.state === "suspended" ? (
						<div class="bd-empty">
							This page is temporarily unavailable. Please check back soon.
						</div>
					) : value.state === "notfound" ? (
						<div class="bd-empty">Page not found.</div>
					) : (
						<>
							<header class="bd-section__lead" style="text-align: left; align-items: flex-start;">
								<h1 class="bd-section__title">
									{value.meta.title.split(" | ")[0]}
								</h1>
								<p class="bd-section__sub" style="margin: 0;">
									{value.meta.description}
								</p>
							</header>
							{body?.PageTitle ? (
								<div class="bd-card" style="padding: 2rem;">
									<h2>{body.PageTitle}</h2>
									{body.PageHeadline ? (
										<p style="margin-top: 0.75rem;">{body.PageHeadline}</p>
									) : null}
								</div>
							) : null}
						</>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = ({ resolveValue }) => {
	const data = resolveValue(useVariant);
	if (data.state !== "ok") {
		return { title: "Unavailable — Your Business" };
	}
	return {
		title: data.meta.title,
		meta: [{ name: "description", content: data.meta.description }],
		links: data.meta.canonical
			? [{ rel: "canonical", href: data.meta.canonical }]
			: [],
	};
};
