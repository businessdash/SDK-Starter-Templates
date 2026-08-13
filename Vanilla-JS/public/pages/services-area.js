/** /services/:service/:area — one rendered programmatic-SEO page. The body
 *  is server-rendered HTML from BIAB (token-resolved), so it's trusted. */
import { biab, el } from "/biab.js";
import { errBox } from "./_ui.js";

export default async function render(root) {
	const segs = location.pathname.split("/").filter(Boolean); // services / :service / :area
	const service = decodeURIComponent(segs[1] ?? "");
	const area = decodeURIComponent(segs[2] ?? "");
	root.replaceChildren(el("p", { class: "page__loading" }, ["Loading…"]));
	if (!service || !area) {
		root.replaceChildren(errBox("Missing service or area."));
		return;
	}
	try {
		const res = await biab.parallelPages.render("service-area", { service, area });
		const meta = res?.meta ?? {};
		const nodes = [
			el("a", { class: "backlink", href: "/services" }, ["← All areas"]),
			el("h1", { class: "page__title" }, [meta.title ?? `${service} in ${area}`]),
		];
		if (meta.description) nodes.push(el("p", { class: "page__sub" }, [meta.description]));
		const body = res?.body;
		if (typeof body === "string" && body.trim()) {
			nodes.push(el("div", { class: "parallel-body", html: body }));
		} else if (body && typeof body === "object") {
			nodes.push(el("pre", { class: "parallel-body parallel-body--json" }, [JSON.stringify(body, null, 2)]));
		}
		root.replaceChildren(...nodes);
	} catch (err) {
		root.replaceChildren(errBox(err));
	}
}
