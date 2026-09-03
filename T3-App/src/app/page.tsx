import { renderJsonLdToHtml } from "@businessdash/sdk/seo";

import { About } from "@/app/_components/bd/About";
import { Blog } from "@/app/_components/bd/Blog";
import { Booking } from "@/app/_components/bd/Booking";
import { ContactForm } from "@/app/_components/bd/ContactForm";
import { BdFooter } from "@/app/_components/bd/Footer";
import { Gallery } from "@/app/_components/bd/Gallery";
import { BdHeader } from "@/app/_components/bd/Header";
import { Hero } from "@/app/_components/bd/Hero";
import { NewsBanner } from "@/app/_components/bd/NewsBanner";
import { Reviews } from "@/app/_components/bd/Reviews";
import { Services } from "@/app/_components/bd/Services";
import { Updates } from "@/app/_components/bd/Updates";
import {
	getBannerFromBundle,
	getBdBundle,
	getReviewsFromBundle,
	getUpdatesFromBundle,
	SiteUnavailableError,
} from "@/server/lib/bd";
import { homeJsonLd } from "@/server/lib/bd-seo";
import { api } from "@/trpc/server";

/**
 * Server Component composes the BD home. `api.bd.home()` calls the tRPC
 * procedure directly (no HTTP round-trip), and a parallel `getBdBundle`
 * read supplies the news banner, the updates feed, and the reviews aggregate +
 * first page. JSON-LD (`LocalBusiness` + `WebSite`) is injected server-side so
 * crawlers see structured data.
 *
 * If the org's billing is fully suspended, `getBdBundle` throws
 * `SiteUnavailableError`; we catch it and render a minimal "site unavailable"
 * state instead of the full page.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
	let bundle = null;
	let unavailable = false;
	try {
		bundle = await getBdBundle("home");
	} catch (err) {
		if (err instanceof SiteUnavailableError) unavailable = true;
		else throw err;
	}

	if (unavailable) {
		return (
			<main className="bd-section bd-section--narrow">
				<div className="bd-empty">
					This site is temporarily unavailable. Please check back soon.
				</div>
			</main>
		);
	}

	const [data, jsonLd] = await Promise.all([api.bd.home(), homeJsonLd()]);
	const banner = getBannerFromBundle(bundle);
	const updates = getUpdatesFromBundle(bundle);
	const reviews = getReviewsFromBundle(bundle);

	return (
		<>
			{/* Server-rendered JSON-LD for crawlers. `renderJsonLdToHtml` already
			    emits the wrapping <script type="application/ld+json"> tags, so the
			    output is trusted SDK-built markup, not user input. */}
			<section
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SDK-built JSON-LD, not user input
				dangerouslySetInnerHTML={{ __html: renderJsonLdToHtml(jsonLd) }}
				hidden
			/>
			<NewsBanner banner={banner} />
			<BdHeader />
			<main>
				<Hero hero={data.hero} />
				<About body={data.about} />
				<Services services={data.services} />
				<Gallery items={data.gallery} />
				<Booking eventTypes={data.eventTypes} />
				<Reviews reviews={reviews} />
				<Updates items={updates} />
				<Blog posts={data.blogPosts} />
				<ContactForm schema={data.formSchema} slug={data.formSlug} />
			</main>
			<BdFooter />
		</>
	);
}
