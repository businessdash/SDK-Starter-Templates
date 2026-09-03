import { getBd } from "../bd";
import { html, render } from "../html";
import { renderSubscribe } from "./subscribe";

const defaults: Array<{ heading: string; body: string }> = [
	{
		heading: "Family-run for 12 years",
		body: "Honest pricing, the same crew every visit, and the kind of follow-up your neighbour-recommended service should have.",
	},
];

export async function renderAbout(req?: Request): Promise<string> {
	let blocks = defaults;
	const bd = getBd();
	if (bd) {
		try {
			const bundle = await bd.marketing.getPageBundle({
				pageKey: "home",
				locale: "en",
			});
			const raw = (bundle as { sections?: Record<string, unknown> })?.sections
				?.["about"];
			if (
				raw &&
				typeof raw === "object" &&
				"ok" in raw &&
				(raw as { ok: boolean }).ok
			) {
				const data = (
					raw as unknown as { data: { blocks?: Array<{ heading: string; body: string }> } }
				).data;
				if (Array.isArray(data?.blocks) && data.blocks.length > 0) {
					blocks = data.blocks;
				}
			}
		} catch {
			/* keep defaults */
		}
	}
	return render(html`
		<section class="section" id="about">
			<h2 class="section__title">About</h2>
			${blocks.map(
				(b) => html`
					<article class="card">
						<h3>${b.heading}</h3>
						<p>${b.body}</p>
					</article>
				`,
			)}
			<div class="subscribe-block">
				${renderSubscribe(
					{
						label: "Get news and offers in your inbox",
						source: "about",
						buttonLabel: "Subscribe",
					},
					req,
				)}
			</div>
		</section>
	`);
}
