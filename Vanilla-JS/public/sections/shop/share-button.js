// [bd-file:store]
import { el } from "/bd.js";

/** ↗ Share: the share sheet, or the link copied ("Link copied"), by `<bd-share>`. */
export function shareButton(title) {
	return el("bd-share", { "data-title": title }, [
		el("button", { class: "share", "data-bd-share": true, type: "button" }, [
			el("span", { "aria-hidden": "true" }, ["↗"]),
			" Share",
		]),
		el("span", { class: "share__note", "data-bd-share-note": true, hidden: true, role: "status" }, []),
	]);
}
