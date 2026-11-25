// Generated from the BD shop elements' TypeScript (the same elements every
// BD starter ships); plain JavaScript, so this starter needs no build step.
/**
 * The few DOM helpers the shop and blog elements share. `h` builds nodes;
 * `patch` makes an element's children match new ones by updating what is
 * already there, so focus, scroll position and typed text survive a
 * re-render. No framework: the elements work on any server-rendered page.
 */
/** An element. `true` sets an empty attribute; false and null leave it out. */
export function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs ?? {})) {
        if (value === false || value === null || value === undefined)
            continue;
        el.setAttribute(name, value === true ? "" : String(value));
    }
    append(el, children);
    return el;
}
function append(parent, children) {
    for (const child of children) {
        if (child === null || child === undefined || child === false)
            continue;
        if (Array.isArray(child))
            append(parent, child);
        else
            parent.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
    }
}
/** Makes `target`'s children match `children`, reusing the nodes there. */
export function patch(target, children) {
    const next = document.createElement("div");
    append(next, children);
    patchChildren(target, next);
}
function patchChildren(from, to) {
    const old = [...from.childNodes];
    const fresh = [...to.childNodes];
    fresh.forEach((node, i) => {
        const current = old[i];
        if (current)
            patchNode(current, node);
        else
            from.appendChild(node);
    });
    for (const extra of old.slice(fresh.length))
        from.removeChild(extra);
}
function patchNode(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
        from.parentNode?.replaceChild(to, from);
        return;
    }
    if (from.nodeType !== Node.ELEMENT_NODE) {
        if (from.nodeValue !== to.nodeValue)
            from.nodeValue = to.nodeValue;
        return;
    }
    const a = from;
    const b = to;
    for (const attr of [...a.attributes])
        if (!b.hasAttribute(attr.name))
            a.removeAttribute(attr.name);
    for (const attr of [...b.attributes]) {
        if (a.getAttribute(attr.name) !== attr.value)
            a.setAttribute(attr.name, attr.value);
    }
    // Another bd- element draws its own inside; only its attributes are ours.
    if (a.localName.startsWith("bd-"))
        return;
    patchChildren(a, b);
}
/**
 * A property set before the element was defined (a framework binding it
 * early) sits on the instance and hides the class's setter; this moves it
 * through the setter.
 */
export function upgradeProperty(el, name) {
    if (!Object.prototype.hasOwnProperty.call(el, name))
        return;
    const record = el;
    const value = record[name];
    delete record[name];
    record[name] = value;
}
/** The JSON a server put in the element: `<script type="application/json">`. */
export function readJson(el) {
    const script = el.querySelector(':scope > script[type="application/json"]');
    try {
        return script?.textContent ? JSON.parse(script.textContent) : null;
    }
    catch {
        return null;
    }
}
/** POST JSON; the reply's status and the fields `K` of its JSON. */
export async function postJson(url, body) {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (csrf)
        headers["X-CSRF-Token"] = csrf;
    try {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "same-origin" });
        const data = await res.json().catch(() => null);
        return { status: res.status, data: data && typeof data === "object" ? data : {} };
    }
    catch {
        return { status: 0, data: {} };
    }
}
/** Defines an element once, so a page can load the script more than once. */
export function define(name, element) {
    if (!customElements.get(name))
        customElements.define(name, element);
}
