import { createFileRoute } from "@tanstack/solid-router";

import { About } from "../components/bd/About";
import { Blog } from "../components/bd/Blog";
import { Booking } from "../components/bd/Booking";
import { ContactForm } from "../components/bd/ContactForm";
import { BdFooter } from "../components/bd/Footer";
import { Gallery } from "../components/bd/Gallery";
import { BdHeader } from "../components/bd/Header";
import { Hero } from "../components/bd/Hero";
import { NewsBanner } from "../components/bd/NewsBanner";
import { Services } from "../components/bd/Services";
import {
	getHomeData,
	getHomeJsonLd,
	getSiteContentExtras,
} from "../lib/bd-server-fns";

/**
 * `loader` runs `getHomeData` (a `createServerFn`) plus the banner/updates
 * extras and the JSON-LD graph — all server-side, in parallel. The
 * component receives fully-resolved data via `useLoaderData()`. The `head`
 * callback injects the structured-data `<script>` server-side so crawlers
 * see it on first paint.
 */
export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		const [home, extras, jsonLd] = await Promise.all([
			getHomeData(),
			getSiteContentExtras(),
			getHomeJsonLd(),
		]);
		return { home, extras, jsonLd };
	},
	head: ({ loaderData }) => {
		const json = loaderData?.jsonLd;
		if (!json) return {};
		return {
			scripts: [{ type: "application/ld+json", children: json }],
		};
	},
});

function App() {
	const data = Route.useLoaderData();
	const home = () => data().home;

	return (
		<>
			<NewsBanner banner={data().extras.banner} />
			<BdHeader />
			<main>
				<Hero hero={home().hero} />
				<About body={home().about} />
				<Services services={home().services} />
				<Gallery items={home().gallery} />
				<Booking eventTypes={home().eventTypes} />
				<Blog posts={home().blogPosts} />
				<ContactForm schema={home().formSchema} slug={home().formSlug} />
			</main>
			<BdFooter />
		</>
	);
}
