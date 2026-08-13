import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BiabFooter } from "@/app/_components/biab/Footer";
import { BiabHeader } from "@/app/_components/biab/Header";
import { getBiab } from "@/server/lib/biab";

type Params = Promise<{ service: string; area: string }>;

const PARALLEL_KEY = "service-area";

/**
 * Programmatic SEO page: one URL per (service × area) combination declared in
 * `biab.config.ts` (`defineParallelPage`). BIAB resolves the tokens
 * server-side so crawlers see fully-rendered copy. Pair with the
 * `/sitemap.xml` + `/robots.txt` proxies so the platform enumerates these.
 */

export async function generateStaticParams(): Promise<
	Array<{ service: string; area: string }>
> {
	const biab = getBiab();
	if (!biab) return [];
	try {
		const { variants } = await biab.parallelPages.listVariants(PARALLEL_KEY);
		return variants.map((v) => ({
			service: v.service ?? "",
			area: v.area ?? "",
		}));
	} catch (err) {
		if (process.env.NODE_ENV === "development") {
			console.warn("[parallel-pages] generateStaticParams failed:", err);
		}
		return [];
	}
}

async function loadVariant(params: Params) {
	const { service, area } = await params;
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.parallelPages.render(PARALLEL_KEY, { service, area });
	} catch (err) {
		// A suspended org should surface as a 503-ish outage; re-throw so the
		// framework error boundary handles it rather than 404-ing a real page.
		if (err instanceof BiabServiceSuspendedError) throw err;
		// Lapsed payments shouldn't reach static reads, but bail to notFound()
		// if they do so the page never renders half-broken.
		if (err instanceof BiabPaymentLapsedError) return null;
		if (process.env.NODE_ENV === "development") {
			console.warn("[parallel-pages] render failed:", err);
		}
		return null;
	}
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const variant = await loadVariant(params);
	if (!variant) return { title: "Not found" };
	return {
		title: variant.meta.title,
		description: variant.meta.description,
		alternates: variant.meta.canonical
			? { canonical: variant.meta.canonical }
			: undefined,
		openGraph: variant.meta.ogImage
			? { images: [variant.meta.ogImage] }
			: undefined,
	};
}

export default async function ServiceAreaPage({ params }: { params: Params }) {
	const variant = await loadVariant(params);
	if (!variant) notFound();

	const body = variant.body as {
		PageTitle?: string;
		PageHeadline?: string;
		heading?: string;
		body?: string;
	} | null;

	return (
		<>
			<BiabHeader />
			<main className="biab-section biab-section--narrow">
				<div className="biab-section__lead">
					<h1 className="biab-section__title">
						{variant.meta.title.split(" | ")[0]}
					</h1>
					<p className="biab-section__sub">{variant.meta.description}</p>
				</div>
				{body?.PageTitle || body?.heading ? (
					<div className="biab-card service-area">
						<h2>{body.PageTitle ?? body.heading}</h2>
						{body.PageHeadline || body.body ? (
							<p>{body.PageHeadline ?? body.body}</p>
						) : null}
					</div>
				) : null}
			</main>
			<BiabFooter />
		</>
	);
}
