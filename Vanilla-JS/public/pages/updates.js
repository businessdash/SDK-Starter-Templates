/** /updates — the `bundle.updates` feed (Google-Business-style posts). */
import { biab, el } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("Updates", "News, offers, and events."));
	try {
		const { updates } = await biab.content.extras();
		const items = normalize(updates);
		if (!items.length) {
			root.append(el("p", { class: "muted" }, ["No updates posted yet."]));
			return;
		}
		root.append(el("div", { class: "update-grid" }, items.map(updateCard)));
	} catch (err) {
		root.append(errBox(err));
	}
}

function normalize(updates) {
	if (!updates) return [];
	if (Array.isArray(updates)) return updates;
	if (Array.isArray(updates.items)) return updates.items;
	if (Array.isArray(updates.posts)) return updates.posts;
	return [];
}

function updateCard(u) {
	const img = u.imageUrl ?? u.image ?? (Array.isArray(u.images) ? u.images[0] : null);
	const text = u.text ?? u.body ?? u.summary ?? "";
	const title = u.title ?? (u.kind ? cap(u.kind) : "Update");
	return el("article", { class: "update-card" }, [
		img ? el("img", { class: "update-card__img", src: img, alt: "", loading: "lazy" }) : null,
		el("div", { class: "update-card__body" }, [
			u.kind ? el("span", { class: "update-card__kind" }, [cap(u.kind)]) : null,
			el("h3", { class: "update-card__title" }, [title]),
			text ? el("p", { class: "update-card__text" }, [text]) : null,
			u.link ? el("a", { class: "update-card__link", href: u.link }, ["Read more →"]) : null,
		]),
	]);
}

function cap(s) {
	const str = String(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}
