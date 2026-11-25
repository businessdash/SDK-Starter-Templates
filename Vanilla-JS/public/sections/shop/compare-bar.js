// [bd-file:store]
import { el } from "/bd.js";

/** The products picked to compare, with Compare and Clear, by `<bd-compare-bar>`. */
export function compareBar({ storeHref = "/store" } = {}) {
	return el("bd-compare-bar", { "data-store-href": storeHref }, []);
}
