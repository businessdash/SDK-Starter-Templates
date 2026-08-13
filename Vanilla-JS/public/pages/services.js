/** /services — index of programmatic-SEO variants (service × area). */
import { biab, el } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("Service areas", "Programmatic-SEO pages, one per service × area."));
	try {
		const res = await biab.parallelPages.listVariants("service-area");
		const variants = res?.variants ?? res?.items ?? [];
		if (!variants.length) {
			root.append(el("p", { class: "muted" }, ["No parallel pages generated yet."]));
			return;
		}
		root.append(el("ul", { class: "variant-list" }, variants.map(variantLink)));
	} catch (err) {
		root.append(errBox(err));
	}
}

function variantLink(v) {
	const slugs = v.slugs ?? v.params ?? v;
	const service = slugs.service ?? v.service ?? "";
	const area = slugs.area ?? v.area ?? "";
	const href = v.url ?? `/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`;
	return el("li", {}, [el("a", { href }, [v.title ?? `${service} — ${area}`])]);
}
