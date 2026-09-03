import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BdFooter } from "@/app/_components/bd/Footer";
import { BdHeader } from "@/app/_components/bd/Header";
import { getBd } from "@/server/lib/bd";

type Params = Promise<{ service: string; area: string }>;

const PARALLEL_KEY = "service-area";

/**
 * Programmatic SEO page: one URL per (service × area) combination declared in
 * `bd.config.ts` (`defineParallelPage`). BD resolves the tokens
 * server-side so crawlers see fully-rendered copy. Pair with the
 * `/sitemap.xml` + `/robots.txt` proxies so the platform enumerates these.
 */

export async function generateStaticParams(): Promise<
	Array<{ service: string; area: string }>
> {
	const bd = getBd();
	if (!bd) return [];
	try {
		const { variants } = await bd.parallelPages.listVariants(PARALLEL_KEY);
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
	const bd = getBd();
	if (!bd) return null;
	try {
		return await bd.parallelPages.render(PARALLEL_KEY, { service, area });
	} catch (err) {
		// A suspended org should surface as a 503-ish outage; re-throw so the
		// framework error boundary handles it rather than 404-ing a real page.
		if (err instanceof BdServiceSuspendedError) throw err;
		// Lapsed payments shouldn't reach static reads, but bail to notFound()
		// if they do so the page never renders half-broken.
		if (err instanceof BdPaymentLapsedError) return null;
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
			<BdHeader />
			<main className="bd-section bd-section--narrow">
				<div className="bd-section__lead">
					<h1 className="bd-section__title">
						{variant.meta.title.split(" | ")[0]}
					</h1>
					<p className="bd-section__sub">{variant.meta.description}</p>
				</div>
				{body?.PageTitle || body?.heading ? (
					<div className="bd-card service-area">
						<h2>{body.PageTitle ?? body.heading}</h2>
						{body.PageHeadline || body.body ? (
							<p>{body.PageHeadline ?? body.body}</p>
						) : null}
					</div>
				) : null}
			</main>
			<BdFooter />
		</>
	);
}
