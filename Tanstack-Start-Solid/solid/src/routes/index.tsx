import { createFileRoute } from "@tanstack/solid-router";

import { About } from "../components/biab/About";
import { Blog } from "../components/biab/Blog";
import { Booking } from "../components/biab/Booking";
import { ContactForm } from "../components/biab/ContactForm";
import { BiabFooter } from "../components/biab/Footer";
import { Gallery } from "../components/biab/Gallery";
import { BiabHeader } from "../components/biab/Header";
import { Hero } from "../components/biab/Hero";
import { NewsBanner } from "../components/biab/NewsBanner";
import { Services } from "../components/biab/Services";
import {
	getHomeData,
	getHomeJsonLd,
	getSiteContentExtras,
} from "../lib/biab-server-fns";

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
			<BiabHeader />
			<main>
				<Hero hero={home().hero} />
				<About body={home().about} />
				<Services services={home().services} />
				<Gallery items={home().gallery} />
				<Booking eventTypes={home().eventTypes} />
				<Blog posts={home().blogPosts} />
				<ContactForm schema={home().formSchema} slug={home().formSlug} />
			</main>
			<BiabFooter />
		</>
	);
}
