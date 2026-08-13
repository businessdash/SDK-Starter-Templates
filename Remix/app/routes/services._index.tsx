import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { listServiceAreaVariants } from "~/lib/biab-pages.server";

export const meta: MetaFunction = () => [
	{ title: "Service areas — Your Business" },
	{
		name: "description",
		content: "Every service we offer, in every area we serve.",
	},
];

/** Index for the programmatic /services/[service]/[area] pages: lists every
 *  (service × area) variant BIAB has materialised, each linking to its
 *  server-rendered page. */
export async function loader(_: LoaderFunctionArgs) {
	const variants = await listServiceAreaVariants();
	return { variants };
}

export default function ServicesIndex() {
	const { variants } = useLoaderData<typeof loader>();
	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">Service areas</h1>
					{variants.length === 0 ? (
						<p className="muted">
							No programmatic pages yet — define services and service areas in
							BIAB, then publish to generate them.
						</p>
					) : (
						<ul className="link-grid">
							{variants.map((v) => (
								<li key={`${v.service}/${v.area}`}>
									<Link to={`/services/${v.service}/${v.area}`}>
										{v.service.replace(/-/g, " ")} in {v.area.replace(/-/g, " ")}
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</>
	);
}
