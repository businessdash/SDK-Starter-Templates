import { bd, el, empty, loading } from "../bd.js";

/**
 * Showcases the SDK's typed field-selection feature: only the
 * columns named in `FIELDS` come back, and the BD server
 * SELECTs only those columns. Vanilla loses the compile-time
 * narrowing the TS starters get, but the runtime payload + cost
 * shape is identical.
 */
const FIELDS = ["id", "src", "title", "category", "blurDataURL"];

/** @param {HTMLElement} target */
export async function renderGallery(target) {
	target.replaceChildren(
		el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Recent work"]),
			el("h2", { class: "bd-section__title" }, ["Gallery"]),
			el("p", { class: "bd-section__sub" }, [
				"Pulled live from the BD gallery surface. Each tile only fetches the fields it actually displays.",
			]),
		]),
		loading("Loading gallery…"),
	);

	let items;
	try {
		items = await bd.gallery.list({ limit: 12, fields: FIELDS });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		target.append(empty(`Couldn't load gallery: ${message}`));
		return;
	}

	// Strip the loading placeholder, keep the header.
	const lead = target.firstChild;
	target.replaceChildren(lead);

	if (items.length === 0) {
		target.append(
			empty("No gallery items yet. Add a few in BD and they'll appear here."),
		);
		return;
	}

	const grid = el(
		"div",
		{ class: "bd-grid-4" },
		items.map((item) => {
			const tile = el("div", { class: "bd-card gallery-tile" }, [
				item.src
					? el("img", {
							alt: item.title ?? item.category ?? "Gallery item",
							loading: "lazy",
							src: item.src,
							style: item.blurDataURL
								? `background-image: url(${item.blurDataURL}); background-size: cover;`
								: null,
						})
					: null,
				item.title || item.category
					? el("div", { class: "gallery-tile__caption" }, [
							item.title ?? item.category,
						])
					: null,
			]);
			return tile;
		}),
	);
	target.append(grid);
}
