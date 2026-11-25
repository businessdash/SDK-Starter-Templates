// Generated from the BD shop elements' TypeScript (the same elements every
// BD starter ships); plain JavaScript, so this starter needs no build step.
import { define, h, patch, postJson, readJson, upgradeProperty } from "./bd-dom.js";
import { chosenOptions, compareList, defaultVariant, formatCents, formatDollars, optionGroupsFor, priceFor, productSummary, recentlyViewed, shareLink, toProductView, wishlist, } from "./shop.js";
/** The window event that carries the cart's new item count. */
export const CART_EVENT = "bd:cart-count";
export function announceCartCount(count) {
    window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: count }));
}
function storeHref(el) {
    return el.getAttribute("data-store-href") ?? "/store";
}
/** Five stars, filled to `rating` (halves shown). */
export function starRating(rating) {
    return h("span", { "aria-label": `${rating.toFixed(1)} out of 5`, class: "stars", role: "img" }, [1, 2, 3, 4, 5].map((i) => {
        const on = rating >= i;
        const half = !on && rating >= i - 0.5;
        return h("span", { class: `stars__star${on ? " stars__star--on" : ""}${half ? " stars__star--half" : ""}` }, "★");
    }));
}
/** Runs `act` for clicks on `[data-act]` inside `root`, not inside a nested bd- element. */
function onAct(root, act) {
    const listener = (event) => {
        const target = event.target?.closest("[data-act]");
        if (!target)
            return;
        let owner = target;
        while (owner && !owner.localName.startsWith("bd-"))
            owner = owner.parentElement;
        if (owner !== root)
            return;
        act(target.getAttribute("data-act") ?? "", target, event);
    };
    root.addEventListener("click", listener);
    return () => root.removeEventListener("click", listener);
}
// ── Save and compare buttons ────────────────────────────────────────
class SaveButtons extends HTMLElement {
    static observedAttributes = ["data-product"];
    #off = [];
    connectedCallback() {
        this.#off = [
            wishlist.subscribe(() => this.render()),
            compareList.subscribe(() => this.render()),
            onAct(this, (act, _target, event) => {
                // Inside a product card (a link), pressing a button must not follow it.
                event.preventDefault();
                event.stopPropagation();
                const product = this.product;
                if (!product)
                    return;
                if (act === "save")
                    wishlist.toggle(product);
                if (act === "compare")
                    compareList.toggle(product);
            }),
        ];
        this.render();
    }
    disconnectedCallback() {
        for (const off of this.#off)
            off();
    }
    attributeChangedCallback() {
        if (this.isConnected)
            this.render();
    }
    get product() {
        try {
            return JSON.parse(this.getAttribute("data-product") ?? "");
        }
        catch {
            return null;
        }
    }
    render() {
        const product = this.product;
        if (!product)
            return;
        const compact = this.hasAttribute("compact");
        const saved = wishlist.has(product.id);
        const picked = compareList.read();
        const comparing = picked.some((item) => item.id === product.id);
        const full = !comparing && picked.length >= compareList.limit;
        patch(this, [
            h("div", { class: `save-buttons${compact ? " save-buttons--compact" : ""}` }, h("button", {
                "aria-label": saved ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`,
                "aria-pressed": String(saved),
                class: `save-buttons__btn${saved ? " save-buttons__btn--on" : ""}`,
                "data-act": "save",
                type: "button",
            }, h("span", { "aria-hidden": "true" }, saved ? "♥" : "♡"), !compact && (saved ? "Saved" : "Save")), h("button", {
                "aria-label": comparing ? `Remove ${product.name} from compare` : `Compare ${product.name}`,
                "aria-pressed": String(comparing),
                class: `save-buttons__btn${comparing ? " save-buttons__btn--on" : ""}`,
                "data-act": "compare",
                disabled: full,
                title: full ? `The compare table holds ${compareList.limit}` : null,
                type: "button",
            }, h("span", { "aria-hidden": "true" }, "⇄"), !compact && (comparing ? "Comparing" : "Compare"))),
        ]);
    }
}
// ── Compare bar ─────────────────────────────────────────────────────
class CompareBar extends HTMLElement {
    #off = [];
    connectedCallback() {
        this.#off = [
            compareList.subscribe(() => this.render()),
            onAct(this, (act, target) => {
                if (act === "remove")
                    compareList.remove(target.getAttribute("data-id") ?? "");
                if (act === "clear")
                    compareList.clear();
            }),
        ];
        this.render();
    }
    disconnectedCallback() {
        for (const off of this.#off)
            off();
    }
    render() {
        const items = compareList.read();
        const href = this.getAttribute("data-compare-href") ?? `${storeHref(this)}/compare`;
        patch(this, items.length === 0
            ? []
            : [
                h("aside", { "aria-label": "Products to compare", class: "compare-bar" }, h("ul", { class: "compare-bar__items" }, items.map((item) => h("li", null, item.image && h("img", { alt: "", referrerpolicy: "no-referrer", src: item.image }), h("span", null, item.name), h("button", { "aria-label": `Remove ${item.name} from compare`, "data-act": "remove", "data-id": item.id, type: "button" }, "×")))), h("div", { class: "compare-bar__actions" }, h("button", { class: "bd-btn bd-btn--ghost", "data-act": "clear", type: "button" }, "Clear"), h("a", {
                    "aria-disabled": String(items.length < 2),
                    class: "bd-btn",
                    href: `${href}?ids=${items.map((i) => i.id).join(",")}`,
                }, items.length < 2 ? "Pick one more to compare" : `Compare ${items.length}`))),
            ]);
    }
}
// ── Product rails ───────────────────────────────────────────────────
/** A row of small product cards: related products, recently viewed. */
function productRail(title, products, store) {
    if (products.length === 0)
        return null;
    return h("section", { class: "product-rail" }, h("h2", { class: "product-rail__title" }, title), h("ul", { class: "product-rail__row" }, products.map((product) => h("li", null, h("a", { class: "bd-card product-rail__card", href: `${store}/${encodeURIComponent(product.id)}` }, product.image
        ? h("img", { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src: product.image })
        : h("span", { "aria-hidden": "true", class: "product-rail__noimg" }), h("span", { class: "product-rail__name" }, product.name), product.priceCents != null && h("span", { class: "product-rail__price" }, formatCents(product.priceCents)))))));
}
// ── Product page ────────────────────────────────────────────────────
//
// The page draws the product page's markup itself (in the starter's own
// components), and these elements bring the parts that change to life.
// They find their pieces by data-bd attributes, so the markup can be laid
// out and styled any way as long as those stay.
/** What <bd-product-form> announces when the chosen variant changes. */
export const VARIANT_EVENT = "bd:variant";
/** POSTs a cart line as JSON; the answer carries `itemCount` (or `ok: false` and `error`). */
async function addToCart(url, input) {
    const { status, data } = await postJson(url, input);
    if (status >= 200 && status < 300 && data.ok !== false && typeof data.itemCount === "number") {
        return { ok: true, itemCount: data.itemCount };
    }
    return { ok: false, error: typeof data.error === "string" ? data.error : "Couldn't add that to your cart. Try again." };
}
function addUrl(el) {
    return el.getAttribute("data-add-url") ?? "/api/bd/cart/add";
}
// These change the page's markup only where it differs, so markup the server
// drew as it should be is left exactly as it is (a framework hydrating it
// finds what it rendered).
function show(el, on) {
    if (el && el.hidden === on)
        el.hidden = !on;
}
function setText(el, text) {
    if (el && el.textContent !== text)
        el.textContent = text;
}
function enable(el, on) {
    if (el instanceof HTMLButtonElement && el.disabled === on)
        el.disabled = !on;
}
/** Marks a choice button chosen or not: aria-pressed, and choice__value--on for bd-shop.css. */
function press(button, on) {
    if (button.getAttribute("aria-pressed") !== String(on))
        button.setAttribute("aria-pressed", String(on));
    if (button.classList.contains("choice__value--on") !== on)
        button.classList.toggle("choice__value--on", on);
}
/**
 * `<bd-gallery data-product-id="…">`: the product's photos. It holds one
 * photo set per `[data-bd-photos-for]`: "" for the product's photos, or a
 * variant id for a variant with photos of its own. The chosen variant's set
 * shows (else the product's), starting at its first photo. In a set, the
 * thumbnails (`[data-bd-photo]`) and ‹ › (`[data-bd-step="-1"]`, `"1"`)
 * change the main photo (`img[data-bd-main]`).
 */
class Gallery extends HTMLElement {
    #off = [];
    connectedCallback() {
        const onClick = (event) => {
            const target = event.target?.closest("[data-bd-photo],[data-bd-step]");
            const set = target?.closest("[data-bd-photos-for]");
            if (!target || !set || !this.contains(set))
                return;
            const thumbs = set.querySelectorAll("[data-bd-photo]");
            const count = Math.max(thumbs.length, 1);
            const index = target.hasAttribute("data-bd-photo")
                ? Number(target.getAttribute("data-bd-photo")) || 0
                : (this.#current(set) + Number(target.getAttribute("data-bd-step")) + count) % count;
            this.#showPhoto(set, index);
        };
        const onVariant = (event) => {
            const { productId, variantId } = event.detail;
            const mine = this.getAttribute("data-product-id");
            if (mine && mine !== productId)
                return;
            const sets = [...this.querySelectorAll("[data-bd-photos-for]")];
            const chosen = sets.find((set) => set.getAttribute("data-bd-photos-for") === variantId) ??
                sets.find((set) => set.getAttribute("data-bd-photos-for") === "");
            for (const set of sets)
                set.hidden = set !== chosen;
            if (chosen)
                this.#showPhoto(chosen, 0);
        };
        this.addEventListener("click", onClick);
        document.addEventListener(VARIANT_EVENT, onVariant);
        this.#off = [
            () => this.removeEventListener("click", onClick),
            () => document.removeEventListener(VARIANT_EVENT, onVariant),
        ];
    }
    disconnectedCallback() {
        for (const off of this.#off)
            off();
    }
    #current(set) {
        const i = [...set.querySelectorAll("[data-bd-photo]")].findIndex((t) => t.getAttribute("aria-current") === "true");
        return Math.max(i, 0);
    }
    #showPhoto(set, index) {
        const thumbs = [...set.querySelectorAll("[data-bd-photo]")];
        const main = set.querySelector("img[data-bd-main]");
        const src = thumbs[index]?.querySelector("img")?.getAttribute("src");
        if (main && src && main.getAttribute("src") !== src)
            main.src = src;
        thumbs.forEach((thumb, i) => {
            thumb.setAttribute("aria-current", String(i === index));
            thumb.classList.toggle("gallery__thumb--on", i === index);
        });
    }
}
/**
 * `<bd-product-form data-add-url="/api/…" data-cart-href="/cart">`: choosing
 * and buying. The product comes as a JSON script inside (`{ "product": … }`,
 * the storefront's product) or as the `product` property. Inside it, the
 * page's markup marks:
 *
 *   [data-bd-variant="<id>"]          a variant button
 *     [data-bd-variant-price]         its price, shown while the chosen variant has no options
 *   [data-bd-group="<id>"]            an option group (Size…); with
 *     data-bd-for-variant="<id>"      when it belongs to one variant (hidden for the others)
 *     [data-bd-value="<id>"]          a choice in it
 *     [data-bd-picked]                where the chosen value's name goes
 *   [data-bd-price]                   [data-bd-from], [data-bd-amount], [data-bd-each] inside
 *   [data-bd-stock]                   "Only 3 left", shown at 5 or fewer
 *   [data-bd-qty="-1"], [data-bd-qty="1"], [data-bd-qty-value]
 *   [data-bd-add]                     the add to cart button
 *   [data-bd-notice]                  after adding: [data-bd-notice-text], [data-bd-notice-link]
 *   bd-save-buttons                   given the price of what's chosen
 *
 * The page draws them as they are before any choice (the first variant that
 * can be bought, quantity 1); this keeps them in step after. Adding POSTs
 * `{ productId, variantId, quantity, options }` as JSON to data-add-url.
 * Picking a variant sends `bd:variant` ({ productId, variantId }) on the
 * document, which <bd-gallery> follows.
 */
class ProductForm extends HTMLElement {
    #view = null;
    #variantId = "";
    #chosen = {};
    #quantity = 1;
    #busy = false;
    #message = null;
    #off = null;
    /** The storefront's product, for frameworks that bind properties (Angular: `[product]="…"`). */
    set product(value) {
        if (!value)
            return;
        this.#load(value);
        if (this.isConnected)
            this.#update();
    }
    #load(product) {
        this.#view = toProductView(product);
        this.#variantId = defaultVariant(this.#view)?.id ?? "";
        this.#chosen = {};
        this.#quantity = 1;
        this.#message = null;
    }
    connectedCallback() {
        upgradeProperty(this, "product");
        if (!this.#view) {
            const data = readJson(this);
            if (data?.product)
                this.#load(data.product);
        }
        const onClick = (event) => {
            const target = event.target?.closest("[data-bd-variant],[data-bd-value],[data-bd-qty],[data-bd-add]");
            if (target && this.contains(target) && !target.closest("bd-save-buttons"))
                void this.#act(target);
        };
        this.addEventListener("click", onClick);
        this.#off = () => this.removeEventListener("click", onClick);
        this.#update();
    }
    disconnectedCallback() {
        this.#off?.();
    }
    async #act(target) {
        const view = this.#view;
        if (!view)
            return;
        const variant = target.getAttribute("data-bd-variant");
        const value = target.getAttribute("data-bd-value");
        const step = target.getAttribute("data-bd-qty");
        if (variant !== null) {
            this.#variantId = variant;
            this.#chosen = {};
            document.dispatchEvent(new CustomEvent(VARIANT_EVENT, { detail: { productId: view.id, variantId: variant } }));
        }
        else if (value !== null) {
            const group = target.closest("[data-bd-group]")?.getAttribute("data-bd-group") ?? "";
            this.#chosen = { ...this.#chosen, [group]: value };
        }
        else if (step !== null) {
            this.#quantity = Math.min(999, Math.max(1, this.#quantity + (Number(step) || 0)));
        }
        else {
            if (this.#busy || !priceFor(view, this.#variantId, this.#chosen).ready)
                return;
            this.#busy = true;
            this.#message = null;
            this.#update();
            const quantity = this.#quantity;
            const options = chosenOptions(view, this.#variantId, this.#chosen);
            const res = await addToCart(addUrl(this), {
                productId: view.id,
                ...(this.#variantId ? { variantId: this.#variantId } : {}),
                quantity,
                ...(options ? { options } : {}),
            });
            this.#busy = false;
            if (res.ok)
                announceCartCount(res.itemCount);
            this.#message = res.ok
                ? { kind: "ok", text: `Added ${quantity} to your cart.` }
                : { kind: "error", text: res.error };
        }
        this.#update();
    }
    #update() {
        const view = this.#view;
        if (!view)
            return;
        const all = (selector) => this.querySelectorAll(selector);
        const one = (selector) => this.querySelector(selector);
        const price = priceFor(view, this.#variantId, this.#chosen);
        const quantity = this.#quantity;
        for (const button of all("[data-bd-variant]"))
            press(button, button.getAttribute("data-bd-variant") === this.#variantId);
        // A variant's price shows on its button while the chosen one has no options.
        const plain = optionGroupsFor(view, this.#variantId).length === 0;
        for (const small of all("[data-bd-variant-price]"))
            show(small, plain);
        for (const group of all("[data-bd-group]")) {
            const only = group.getAttribute("data-bd-for-variant");
            show(group, only === null || only === this.#variantId);
            const chosen = this.#chosen[group.getAttribute("data-bd-group") ?? ""];
            for (const button of group.querySelectorAll("[data-bd-value]"))
                press(button, button.getAttribute("data-bd-value") === chosen);
            const picked = group.querySelector("[data-bd-picked]");
            const name = chosen ? (view.optionValues.find((v) => v.id === chosen)?.value ?? "") : "";
            setText(picked, name ? ` ${name}` : "");
            show(picked, Boolean(name));
        }
        const priceBox = one("[data-bd-price]");
        if (priceBox) {
            const amount = priceBox.querySelector("[data-bd-amount]");
            const each = priceBox.querySelector("[data-bd-each]");
            setText(amount, price.amount != null ? formatDollars(price.amount * quantity) : "Sold out");
            show(priceBox.querySelector("[data-bd-from]"), price.amount != null && price.from);
            setText(each, price.amount != null && quantity > 1 ? ` (${formatDollars(price.amount)} each)` : "");
            show(each, price.amount != null && quantity > 1);
        }
        const stock = one("[data-bd-stock]");
        const low = price.stock != null && price.stock > 0 && price.stock <= 5;
        setText(stock, low ? `Only ${price.stock} left` : "");
        show(stock, low);
        setText(one("[data-bd-qty-value]"), String(quantity));
        for (const button of all("[data-bd-qty]")) {
            const down = Number(button.getAttribute("data-bd-qty")) < 0;
            enable(button, down ? quantity > 1 : price.stock == null || quantity < price.stock);
        }
        const add = one("[data-bd-add]");
        enable(add, !this.#busy && price.ready);
        setText(add, price.amount === null ? "Sold out" : !price.ready ? "Choose options" : this.#busy ? "Adding…" : "Add to cart");
        const notice = one("[data-bd-notice]");
        if (notice) {
            const message = this.#message;
            show(notice, Boolean(message));
            const error = message?.kind === "error";
            if (notice.classList.contains("product-detail__msg--err") !== error)
                notice.classList.toggle("product-detail__msg--err", error);
            setText(notice.querySelector("[data-bd-notice-text]"), message?.text ?? "");
            show(notice.querySelector("[data-bd-notice-link]"), message?.kind === "ok");
        }
        const summary = JSON.stringify(productSummary(view, this.#variantId, this.#chosen));
        for (const save of all("bd-save-buttons")) {
            if (save.getAttribute("data-product") !== summary)
                save.setAttribute("data-product", summary);
        }
    }
}
/**
 * `<bd-share data-title="…">`: its `[data-bd-share]` button opens the share
 * sheet, or copies the page's link and says so in `[data-bd-share-note]`.
 */
class ShareButton extends HTMLElement {
    #off = null;
    #timer;
    connectedCallback() {
        const onClick = async (event) => {
            if (!event.target?.closest("[data-bd-share]"))
                return;
            const result = await shareLink(`${window.location.origin}${window.location.pathname}`, this.getAttribute("data-title") ?? document.title);
            const note = this.querySelector("[data-bd-share-note]");
            const text = result === "copied" ? "Link copied" : result === "failed" ? "Couldn't share" : "";
            if (!note || !text)
                return;
            note.textContent = text;
            note.hidden = false;
            clearTimeout(this.#timer);
            this.#timer = setTimeout(() => {
                note.textContent = "";
                note.hidden = true;
            }, 2500);
        };
        this.addEventListener("click", onClick);
        this.#off = () => this.removeEventListener("click", onClick);
    }
    disconnectedCallback() {
        this.#off?.();
        clearTimeout(this.#timer);
    }
}
/**
 * `<bd-addon data-product-id="…" data-variant-id="…" data-add-url="/api/…">`:
 * its `[data-bd-add]` button adds one of the add-on to the cart, reading
 * "…" on the way and "Added" after.
 */
class AddonButton extends HTMLElement {
    #off = null;
    connectedCallback() {
        const onClick = async (event) => {
            const button = event.target?.closest("[data-bd-add]");
            if (!button || !this.contains(button) || button.disabled)
                return;
            const label = button.textContent;
            button.disabled = true;
            button.textContent = "…";
            const variantId = this.getAttribute("data-variant-id");
            const res = await addToCart(addUrl(this), {
                productId: this.getAttribute("data-product-id") ?? "",
                ...(variantId ? { variantId } : {}),
                quantity: 1,
            });
            if (res.ok) {
                announceCartCount(res.itemCount);
                button.textContent = "Added";
            }
            else {
                button.disabled = false;
                button.textContent = label;
            }
        };
        this.addEventListener("click", onClick);
        this.#off = () => this.removeEventListener("click", onClick);
    }
    disconnectedCallback() {
        this.#off?.();
    }
}
/**
 * `<bd-recently-viewed data-product='{"id":…,"name":…,"image":…,"priceCents":…}'>`:
 * the products this browser opened before this one, as a rail, and this
 * one added to the list for next time. The list lives in localStorage, so
 * this draws its own cards (the same markup as a product rail). It follows
 * data-product, for frameworks that set it after adding the element.
 */
class RecentlyViewed extends HTMLElement {
    static observedAttributes = ["data-product"];
    #connected = false;
    #added = "";
    connectedCallback() {
        this.#connected = true;
        this.#draw();
    }
    disconnectedCallback() {
        this.#connected = false;
    }
    attributeChangedCallback() {
        if (this.#connected)
            this.#draw();
    }
    #draw() {
        let product = null;
        try {
            product = JSON.parse(this.getAttribute("data-product") ?? "");
        }
        catch {
            product = null;
        }
        const recent = recentlyViewed.read().filter((item) => item.id !== product?.id);
        if (product?.id && product.id !== this.#added) {
            recentlyViewed.add(product);
            this.#added = product.id;
        }
        patch(this, [productRail(this.getAttribute("data-title") ?? "Recently viewed", recent, storeHref(this))]);
    }
}
// ── Wishlist ────────────────────────────────────────────────────────
/** The wishlist: products saved on this device, to open and buy later. */
class Wishlist extends HTMLElement {
    #off = [];
    connectedCallback() {
        this.#off = [
            wishlist.subscribe(() => this.render()),
            onAct(this, (act, target) => {
                if (act === "remove")
                    wishlist.remove(target.getAttribute("data-id") ?? "");
                if (act === "clear")
                    wishlist.clear();
            }),
        ];
        this.render();
    }
    disconnectedCallback() {
        for (const off of this.#off)
            off();
    }
    render() {
        const store = storeHref(this);
        const items = wishlist.read();
        patch(this, items.length === 0
            ? [
                h("div", { class: "bd-empty" }, "Nothing saved yet. Press ", h("span", { "aria-hidden": "true" }, "♡"), " Save on any product.", h("p", null, h("a", { class: "bd-btn", href: store }, "Browse products"))),
            ]
            : [
                h("ul", { class: "wishlist bd-grid-4" }, items.map((item) => h("li", { class: "bd-card wishlist__card" }, h("a", { class: "wishlist__link", href: `${store}/${encodeURIComponent(item.id)}` }, item.image
                    ? h("img", { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src: item.image })
                    : h("span", { "aria-hidden": "true", class: "wishlist__noimg" }), h("span", { class: "wishlist__name" }, item.name), item.priceCents != null && h("span", { class: "wishlist__price" }, formatCents(item.priceCents))), h("button", { class: "bd-btn bd-btn--ghost", "data-act": "remove", "data-id": item.id, type: "button" }, "Remove")))),
                h("p", { class: "wishlist__clear" }, h("button", { class: "bd-btn bd-btn--ghost", "data-act": "clear", type: "button" }, "Clear the wishlist")),
            ]);
    }
}
/**
 * Up to four products side by side: price, rating, category, options and
 * every spec any of them lists. The server renders the products in ?ids=a,b
 * (JSON inside: `{ ids, columns }`), so a comparison can be shared; opened
 * without ids, this browser's picks are moved into the URL.
 */
class CompareTable extends HTMLElement {
    #data = null;
    #off = null;
    /** The table's data as a property (Angular: `[data]="…"`), in place of the JSON script. */
    get data() {
        return this.#data;
    }
    set data(value) {
        if (!value || value === this.#data)
            return;
        this.#data = value;
        if (this.isConnected)
            this.#show();
    }
    connectedCallback() {
        upgradeProperty(this, "data");
        if (!this.#data)
            this.#data = readJson(this);
        this.#off = onAct(this, (act, target) => {
            if (act !== "remove")
                return;
            const id = target.getAttribute("data-id") ?? "";
            compareList.remove(id);
            this.#go((this.#data?.ids ?? []).filter((other) => other !== id));
        });
        // Without data yet, the property brings it.
        if (this.#data)
            this.#show();
    }
    /** Opened without ids, this browser's picks go into the URL; otherwise the table. */
    #show() {
        if (this.#data?.ids.length === 0) {
            const saved = compareList.read().map((item) => item.id);
            if (saved.length > 0) {
                this.#go(saved);
                return;
            }
        }
        this.render();
    }
    disconnectedCallback() {
        this.#off?.();
    }
    #go(ids) {
        const href = this.getAttribute("data-compare-href") ?? `${storeHref(this)}/compare`;
        window.location.replace(ids.length > 0 ? `${href}?ids=${ids.map(encodeURIComponent).join(",")}` : href);
    }
    render() {
        const store = storeHref(this);
        const views = (this.#data?.columns ?? []).map((column) => ({
            view: toProductView(column.product),
            rating: column.rating,
        }));
        if (views.length === 0) {
            patch(this, [
                h("div", { class: "bd-empty" }, "Nothing to compare yet. Press ", h("span", { "aria-hidden": "true" }, "⇄"), " Compare on two or more products.", h("p", null, h("a", { class: "bd-btn", href: store }, "Browse products"))),
            ]);
            return;
        }
        const rows = [];
        const seen = new Set();
        for (const { view } of views) {
            for (const group of view.specs) {
                for (const row of group.rows) {
                    const key = `${group.name}\u0000${row.label}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        rows.push({ group: group.name, label: row.label });
                    }
                }
            }
        }
        const productHref = (id) => `${store}/${encodeURIComponent(id)}`;
        const cells = (cell) => views.map((entry) => h("td", null, cell(entry)));
        patch(this, [
            h("div", { class: "compare-scroll" }, h("table", { class: "compare" }, h("caption", { class: "visually-hidden" }, "Products compared"), h("thead", null, h("tr", null, h("td", null), views.map(({ view }) => h("th", { scope: "col" }, h("a", { class: "compare__product", href: productHref(view.id) }, view.images[0] && h("img", { alt: "", referrerpolicy: "no-referrer", src: view.images[0] }), h("span", null, view.name)), h("button", { class: "compare__remove", "data-act": "remove", "data-id": view.id, type: "button" }, "Remove"))))), h("tbody", null, h("tr", null, h("th", { scope: "row" }, "Price"), cells(({ view }) => {
                const variant = defaultVariant(view);
                return variant?.price != null ? formatDollars(variant.price) : "—";
            })), h("tr", null, h("th", { scope: "row" }, "Rating"), cells(({ rating }) => (rating ? `${rating.avg.toFixed(1)} ★ (${rating.count})` : "No reviews"))), h("tr", null, h("th", { scope: "row" }, "Category"), cells(({ view }) => view.categoryName ?? "—")), h("tr", null, h("th", { scope: "row" }, "Options"), cells(({ view }) => view.variants.map((v) => v.name).join(", ") || "—")), rows.map((row) => h("tr", null, h("th", { scope: "row" }, `${row.label} `, h("small", null, row.group)), cells(({ view }) => view.specs.find((g) => g.name === row.group)?.rows.find((r) => r.label === row.label)?.value ?? "—"))), h("tr", null, h("td", null), cells(({ view }) => h("a", { class: "bd-btn", href: productHref(view.id) }, "View product")))))),
        ]);
    }
}
// ── Store bar counts ────────────────────────────────────────────────
/** How many products a saved list holds (data-list="wishlist" or "compare"). */
class SavedCount extends HTMLElement {
    #off = null;
    connectedCallback() {
        const list = this.getAttribute("data-list") === "compare" ? compareList : wishlist;
        this.#off = list.subscribe(() => this.render());
        this.render();
    }
    disconnectedCallback() {
        this.#off?.();
    }
    render() {
        const count = (this.getAttribute("data-list") === "compare" ? compareList : wishlist).read().length;
        patch(this, [count > 0 && h("span", { class: "store-nav__count" }, count)]);
    }
}
/** The cart's item count: data-count from the server, then each add's. */
class CartCount extends HTMLElement {
    static observedAttributes = ["data-count"];
    #count = 0;
    #onCount = (event) => {
        this.#count = Number(event.detail) || 0;
        this.render();
    };
    connectedCallback() {
        this.#count = Number(this.getAttribute("data-count")) || 0;
        window.addEventListener(CART_EVENT, this.#onCount);
        this.render();
    }
    disconnectedCallback() {
        window.removeEventListener(CART_EVENT, this.#onCount);
    }
    /** A framework may set data-count after the element is in the page. */
    attributeChangedCallback() {
        this.#count = Number(this.getAttribute("data-count")) || 0;
        if (this.isConnected)
            this.render();
    }
    render() {
        patch(this, [this.#count > 0 && h("span", { class: "store-nav__badge" }, this.#count)]);
    }
}
define("bd-save-buttons", SaveButtons);
define("bd-compare-bar", CompareBar);
define("bd-gallery", Gallery);
define("bd-product-form", ProductForm);
define("bd-share", ShareButton);
define("bd-addon", AddonButton);
define("bd-recently-viewed", RecentlyViewed);
define("bd-wishlist", Wishlist);
define("bd-compare", CompareTable);
define("bd-saved-count", SavedCount);
define("bd-cart-count", CartCount);
