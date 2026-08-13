/**
 * Tiny HTML tag helper. Use as a tagged template:
 *
 *   html`<a href="${url}">${text}</a>`
 *
 * Auto-escapes every interpolation by default. Pre-built HTML
 * fragments can opt out by being wrapped in `raw(...)` (e.g. the
 * result of another `html` call doesn't get double-escaped).
 *
 * Arrays of interpolated values are joined with no separator —
 * useful for `items.map((i) => html\`<li>${i.name}</li>\`)`.
 */

const RAW = Symbol("RAW");
export type Raw = { [RAW]: string };

export function raw(s: string): Raw {
	return { [RAW]: s };
}

function isRaw(v: unknown): v is Raw {
	return typeof v === "object" && v !== null && RAW in v;
}

function escape(v: string): string {
	return v
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function stringify(value: unknown): string {
	if (value == null || value === false) return "";
	if (isRaw(value)) return value[RAW];
	if (Array.isArray(value)) return value.map(stringify).join("");
	return escape(String(value));
}

export function html(
	strings: TemplateStringsArray,
	...values: unknown[]
): Raw {
	let out = strings[0] ?? "";
	for (let i = 0; i < values.length; i += 1) {
		out += stringify(values[i]);
		out += strings[i + 1] ?? "";
	}
	return raw(out);
}

export function render(node: Raw): string {
	return node[RAW];
}
