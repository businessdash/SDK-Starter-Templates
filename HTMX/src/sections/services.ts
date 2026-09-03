import { getBd } from "../bd";
import { html, render } from "../html";

type Service = {
	id: string;
	name: string;
	description: string;
	priceLabel: string;
};

const defaults: Service[] = [
	{
		id: "tuneup",
		name: "Annual tune-up",
		description: "Pre-season inspection + tune-up.",
		priceLabel: "from $149",
	},
	{
		id: "install",
		name: "Install",
		description: "New equipment install with a 10-year warranty.",
		priceLabel: "quote on site",
	},
	{
		id: "repair",
		name: "Repair",
		description: "Same-day repair for most makes + models.",
		priceLabel: "$95 diagnostic",
	},
];

export async function renderServices(): Promise<string> {
	let items = defaults;
	const bd = getBd();
	if (bd) {
		try {
			const list = await bd.storefront.listProducts({ limit: 6 });
			if (Array.isArray(list?.items) && list.items.length > 0) {
				items = list.items.map((p: any) => ({
					id: p.id,
					name: p.name,
					description: p.description ?? "",
					priceLabel:
						p.priceCents != null
							? `from $${(p.priceCents / 100).toFixed(0)}`
							: p.price != null
								? `from $${Number(p.price).toFixed(0)}`
								: "quote on site",
				}));
			}
		} catch {
			/* keep defaults */
		}
	}
	return render(html`
		<section class="section" id="services">
			<h2 class="section__title">Services</h2>
			<div class="grid">
				${items.map(
					(s) => html`
						<article class="card">
							<h3>${s.name}</h3>
							<p>${s.description}</p>
							<span class="price">${s.priceLabel}</span>
						</article>
					`,
				)}
			</div>
		</section>
	`);
}
