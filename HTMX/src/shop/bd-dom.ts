/**
 * The few DOM helpers the shop and blog elements share. `h` builds nodes;
 * `patch` makes an element's children match new ones by updating what is
 * already there, so focus, scroll position and typed text survive a
 * re-render. No framework: the elements work on any server-rendered page.
 */

export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, string | number | boolean | null | undefined>;

/** An element. `true` sets an empty attribute; false and null leave it out. */
export function h(tag: string, attrs: Attrs | null, ...children: Child[]): HTMLElement {
	const el = document.createElement(tag);
	for (const [name, value] of Object.entries(attrs ?? {})) {
		if (value === false || value === null || value === undefined) continue;
		el.setAttribute(name, value === true ? "" : String(value));
	}
	append(el, children);
	return el;
}

function append(parent: Node, children: Child[]): void {
	for (const child of children) {
		if (child === null || child === undefined || child === false) continue;
		if (Array.isArray(child)) append(parent, child);
		else parent.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
	}
}

/** Makes `target`'s children match `children`, reusing the nodes there. */
export function patch(target: Element, children: Child[]): void {
	const next = document.createElement("div");
	append(next, children);
	patchChildren(target, next);
}

function patchChildren(from: Node, to: Node): void {
	const old = [...from.childNodes];
	const fresh = [...to.childNodes];
	fresh.forEach((node, i) => {
		const current = old[i];
		if (current) patchNode(current, node);
		else from.appendChild(node);
	});
	for (const extra of old.slice(fresh.length)) from.removeChild(extra);
}

function patchNode(from: Node, to: Node): void {
	if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
		from.parentNode?.replaceChild(to, from);
		return;
	}
	if (from.nodeType !== Node.ELEMENT_NODE) {
		if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
		return;
	}
	const a = from as Element;
	const b = to as Element;
	for (const attr of [...a.attributes]) if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
	for (const attr of [...b.attributes]) {
		if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
	}
	// Another bd- element draws its own inside; only its attributes are ours.
	if (a.localName.startsWith("bd-")) return;
	patchChildren(a, b);
}

/**
 * A property set before the element was defined (a framework binding it
 * early) sits on the instance and hides the class's setter; this moves it
 * through the setter.
 */
export function upgradeProperty(el: HTMLElement, name: string): void {
	if (!Object.prototype.hasOwnProperty.call(el, name)) return;
	const record = el as unknown as Record<string, unknown>;
	const value = record[name];
	delete record[name];
	record[name] = value;
}

/** The JSON a server put in the element: `<script type="application/json">`. */
export function readJson<T>(el: Element): T | null {
	const script = el.querySelector(':scope > script[type="application/json"]');
	try {
		return script?.textContent ? (JSON.parse(script.textContent) as T) : null;
	} catch {
		return null;
	}
}

/**
 * POST JSON to this site's server and read the answer whatever its status
 * (the routes explain a refusal in the body). Sends the page's CSRF token
 * (`<meta name="csrf-token">`) when it has one, as Laravel and Phoenix want.
 */
/** JSON from outside, as the fields a caller reads; each is checked before use. */
export type Fields<K extends string> = { readonly [P in K]?: unknown };

/** POST JSON; the reply's status and the fields `K` of its JSON. */
export async function postJson<K extends string>(url: string, body: unknown): Promise<{ status: number; data: Fields<K> }> {
	const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
	const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
	if (csrf) headers["X-CSRF-Token"] = csrf;
	try {
		const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "same-origin" });
		const data: unknown = await res.json().catch(() => null);
		return { status: res.status, data: data && typeof data === "object" ? (data as Fields<K>) : {} };
	} catch {
		return { status: 0, data: {} };
	}
}

/** Defines an element once, so a page can load the script more than once. */
export function define(name: string, element: CustomElementConstructor): void {
	if (!customElements.get(name)) customElements.define(name, element);
}
