import { Link, useLoaderData } from "react-router";
import { data } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { renderServiceArea } from "~/lib/bd-pages.server";
import { isServiceSuspended } from "~/lib/bd.server";

/**
 * Programmatic SEO page — one URL per (service × area) declared in
 * `bd.config.ts`'s `defineParallelPage`. The high-level
 * `client.parallelPages.render("service-area", { service, area })` returns
 * fully token-resolved `meta` + `body` (token expansion happens server-side
 * inside BD), so crawlers see complete HTML.
 */

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
	if (!loaderData || !loaderData.variant) return [{ title: "Not found" }];
	const m = loaderData.variant.meta;
	const tags: ReturnType<MetaFunction> = [
		{ title: m.title },
		{ name: "description", content: m.description },
	];
	if (m.canonical) tags.push({ tagName: "link", rel: "canonical", href: m.canonical });
	if (m.ogImage) tags.push({ property: "og:image", content: m.ogImage });
	return tags;
};

export async function loader({ params }: LoaderFunctionArgs) {
	const service = params["service"]!;
	const area = params["area"]!;
	try {
		const variant = await renderServiceArea(service, area);
		if (!variant) {
			throw data({ message: "Not found" }, { status: 404 });
		}
		const body = (variant.body ?? null) as {
			PageTitle?: string;
			PageHeadline?: string;
		} | null;
		return {
			variant: {
				meta: variant.meta,
				bodyTitle: body?.PageTitle ?? null,
				bodyHeadline: body?.PageHeadline ?? null,
			},
		};
	} catch (err) {
		if (isServiceSuspended(err)) {
			// Surface a 503 so search engines treat the outage as temporary.
			throw data({ message: "Temporarily unavailable" }, { status: 503 });
		}
		throw err;
	}
}

export default function ServiceAreaPage() {
	const { variant } = useLoaderData<typeof loader>();
	const headline = variant.meta.title.split(" | ")[0];
	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<Link className="muted" to="/services">
						← All service areas
					</Link>
					<h1 className="hero__title">{headline}</h1>
					<p className="hero__sub">{variant.meta.description}</p>
					{variant.bodyTitle ? (
						<article className="card">
							<h2>{variant.bodyTitle}</h2>
							{variant.bodyHeadline ? <p>{variant.bodyHeadline}</p> : null}
						</article>
					) : null}
				</section>
			</main>
		</>
	);
}
