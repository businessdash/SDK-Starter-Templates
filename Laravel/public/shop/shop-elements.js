// Generated from the BD shop elements' TypeScript (the same elements every
// BD starter ships); plain JavaScript, so this starter needs no build step.
import { define, h, patch, postJson, readJson, upgradeProperty } from "./bd-dom.js";
import { chosenOptions, compareList, defaultVariant, formatCents, formatDollars, galleryFor, optionGroupsFor, priceFor, recentlyViewed, shareLink, toProductView, wishlist, } from "./shop.js";
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
function reviewDate(iso) {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : "";
}
/**
 * The product page: photos that follow the chosen option, option and size
 * buttons, the price for what's chosen, add to cart, save and compare, share,
 * details, add-ons, reviews, related products and what was viewed before.
 * Adding POSTs `{ productId, variantId, quantity, options }` as JSON to
 * data-add-url; the answer carries `itemCount` (or `ok: false` and `error`).
 */
class ProductPage extends HTMLElement {
    #data = null;
    #view = null;
    #variantId = "";
    #chosen = {};
    #photo = 0;
    #quantity = 1;
    #busy = false;
    #message = null;
    #shareNote = "";
    #addingAddon = null;
    #addedAddons = {};
    #recent = [];
    #off = null;
    /**
     * The page's data as a property, for frameworks that bind properties
     * (Angular: `[data]="…"`) in place of the JSON script. A new product
     * starts the choices over.
     */
    get data() {
        return this.#data;
    }
    set data(value) {
        if (!value || value === this.#data)
            return;
        this.#load(value);
        if (this.isConnected)
            this.render();
    }
    #load(data) {
        this.#data = data;
        this.#view = toProductView(data.product);
        this.#variantId = defaultVariant(this.#view)?.id ?? "";
        this.#chosen = {};
        this.#photo = 0;
        this.#quantity = 1;
        this.#message = null;
        this.#shareNote = "";
        this.#addedAddons = {};
        // Recently viewed: read before this one is added, so it isn't in its own list.
        this.#recent = recentlyViewed.read().filter((item) => item.id !== this.#view?.id);
        recentlyViewed.add(this.#summary());
    }
    connectedCallback() {
        upgradeProperty(this, "data");
        if (!this.#data) {
            const data = readJson(this);
            if (data)
                this.#load(data);
        }
        this.#off = onAct(this, (act, target) => this.#act(act, target));
        // Without data yet, the property brings it.
        this.render();
    }
    disconnectedCallback() {
        this.#off?.();
    }
    #summary() {
        const view = this.#view;
        const price = priceFor(view, this.#variantId, this.#chosen);
        const start = price.amount ?? view.variants[0]?.price ?? null;
        return {
            id: view.id,
            name: view.name,
            image: view.images[0] ?? null,
            priceCents: start != null ? Math.round(start * 100) : null,
        };
    }
    async #add(input) {
        const { status, data } = await postJson(this.getAttribute("data-add-url") ?? "/api/bd/cart/add", input);
        if (status >= 200 && status < 300 && data.ok !== false && typeof data.itemCount === "number") {
            return { ok: true, itemCount: data.itemCount };
        }
        return { ok: false, error: typeof data.error === "string" ? data.error : "Couldn't add that to your cart. Try again." };
    }
    async #act(act, target) {
        const view = this.#view;
        const gallery = galleryFor(view, this.#variantId);
        switch (act) {
            case "variant":
                this.#variantId = target.getAttribute("data-id") ?? "";
                this.#chosen = {};
                this.#photo = 0;
                break;
            case "option":
                this.#chosen = { ...this.#chosen, [target.getAttribute("data-group") ?? ""]: target.getAttribute("data-id") ?? "" };
                break;
            case "photo":
                this.#photo = Number(target.getAttribute("data-index")) || 0;
                break;
            case "step":
                this.#photo = (this.#photo + Number(target.getAttribute("data-by")) + gallery.length) % gallery.length;
                break;
            case "fewer":
                this.#quantity = Math.max(1, this.#quantity - 1);
                break;
            case "more":
                this.#quantity = Math.min(999, this.#quantity + 1);
                break;
            case "add": {
                if (!priceFor(view, this.#variantId, this.#chosen).ready)
                    return;
                this.#busy = true;
                this.#message = null;
                this.render();
                const quantity = this.#quantity;
                const options = chosenOptions(view, this.#variantId, this.#chosen);
                const res = await this.#add({
                    productId: view.id,
                    ...(this.#variantId ? { variantId: this.#variantId } : {}),
                    quantity,
                    ...(options ? { options } : {}),
                });
                this.#busy = false;
                if (res.ok) {
                    announceCartCount(res.itemCount);
                    this.#message = { kind: "ok", text: `Added ${quantity} to your cart.` };
                }
                else {
                    this.#message = { kind: "error", text: res.error };
                }
                break;
            }
            case "addon": {
                const addon = this.#data?.addons.find((a) => a.id === target.getAttribute("data-id"));
                if (!addon)
                    return;
                this.#addingAddon = addon.id;
                this.render();
                const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined);
                const variant = first?.variantId ?? first?.id;
                const res = await this.#add({
                    productId: addon.addonProductId,
                    ...(typeof variant === "string" ? { variantId: variant } : {}),
                    quantity: 1,
                });
                this.#addingAddon = null;
                if (res.ok) {
                    announceCartCount(res.itemCount);
                    this.#addedAddons = { ...this.#addedAddons, [addon.id]: true };
                }
                break;
            }
            case "share": {
                const result = await shareLink(`${window.location.origin}${window.location.pathname}`, view.name);
                this.#shareNote = result === "copied" ? "Link copied" : result === "failed" ? "Couldn't share" : "";
                if (this.#shareNote) {
                    setTimeout(() => {
                        this.#shareNote = "";
                        this.render();
                    }, 2500);
                }
                break;
            }
            default:
                return;
        }
        this.render();
    }
    render() {
        const data = this.#data;
        const view = this.#view;
        if (!data || !view)
            return;
        const store = storeHref(this);
        const cartHref = this.getAttribute("data-cart-href") ?? `${store}/cart`;
        const contactHref = this.getAttribute("data-contact-href") ?? "/#contact";
        const { reviews, addons, related, moreReviewsHref } = data;
        const gallery = galleryFor(view, this.#variantId);
        const groups = optionGroupsFor(view, this.#variantId);
        const price = priceFor(view, this.#variantId, this.#chosen);
        const photo = Math.min(this.#photo, Math.max(gallery.length - 1, 0));
        const quantity = this.#quantity;
        const cta = price.amount === null ? "Sold out" : !price.ready ? "Choose options" : this.#busy ? "Adding…" : "Add to cart";
        const relatedCards = related.map((rp) => ({
            id: rp.id,
            name: rp.name,
            image: rp.coverImageUrl,
            priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
        }));
        patch(this, [
            h("nav", { "aria-label": "Breadcrumb", class: "crumbs" }, h("a", { href: store }, "Store"), view.categoryId && [
                h("span", { "aria-hidden": "true" }, "/"),
                h("a", { href: `${store}?category=${encodeURIComponent(view.categoryId)}` }, view.categoryName ?? "Category"),
            ], h("span", { "aria-hidden": "true" }, "/"), h("span", { "aria-current": "page" }, view.name)),
            h("div", { class: "product-detail" }, h("div", { class: "gallery" }, h("div", { class: "gallery__main" }, gallery[photo]
                ? h("img", { alt: view.name, referrerpolicy: "no-referrer", src: gallery[photo] })
                : h("div", { class: "gallery__placeholder" }, "No photo yet"), gallery.length > 1 && [
                h("button", { "aria-label": "Previous photo", class: "gallery__step gallery__step--prev", "data-act": "step", "data-by": -1, type: "button" }, "‹"),
                h("button", { "aria-label": "Next photo", class: "gallery__step gallery__step--next", "data-act": "step", "data-by": 1, type: "button" }, "›"),
            ]), gallery.length > 1 &&
                h("div", { class: "gallery__thumbs" }, gallery.map((src, i) => h("button", {
                    "aria-current": String(i === photo),
                    "aria-label": `Photo ${i + 1} of ${gallery.length}`,
                    class: `gallery__thumb${i === photo ? " gallery__thumb--on" : ""}`,
                    "data-act": "photo",
                    "data-index": i,
                    type: "button",
                }, h("img", { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src }))))), h("div", { class: "product-detail__info bd-card" }, h("div", null, view.categoryName && h("p", { class: "product-detail__eyebrow" }, view.categoryName), h("h1", null, view.name), reviews &&
                reviews.totalCount > 0 &&
                h("a", { class: "product-detail__rating", href: "#reviews" }, starRating(reviews.avgRating), h("span", null, `${reviews.avgRating.toFixed(1)} · ${reviews.totalCount} reviews`))), h("p", { class: "product-detail__price" }, price.amount != null
                ? [
                    price.from && h("span", { class: "product-detail__from" }, "From"),
                    " ",
                    formatDollars(price.amount * quantity),
                    quantity > 1 && h("span", { class: "product-detail__each" }, ` (${formatDollars(price.amount)} each)`),
                ]
                : "Sold out"), view.description && h("p", { class: "product-detail__desc" }, view.description), view.variants.length > 1 &&
                h("fieldset", { class: "choice" }, h("legend", { class: "bd-label" }, "Option"), h("div", { class: "choice__values" }, view.variants.map((v) => h("button", {
                    "aria-pressed": String(v.id === this.#variantId),
                    class: `choice__value${v.id === this.#variantId ? " choice__value--on" : ""}`,
                    "data-act": "variant",
                    "data-id": v.id,
                    disabled: !v.available,
                    type: "button",
                }, v.name, v.price != null && groups.length === 0 && h("small", null, ` ${formatDollars(v.price)}`))))), groups.map((group) => h("fieldset", { class: "choice" }, h("legend", { class: "bd-label" }, group.title, this.#chosen[group.id] &&
                h("span", { class: "choice__picked" }, ` ${group.values.find((v) => v.id === this.#chosen[group.id])?.value ?? ""}`)), h("div", { class: "choice__values" }, group.values.map((value) => h("button", {
                "aria-pressed": String(this.#chosen[group.id] === value.id),
                class: `choice__value${this.#chosen[group.id] === value.id ? " choice__value--on" : ""}`,
                "data-act": "option",
                "data-group": group.id,
                "data-id": value.id,
                disabled: !value.available,
                title: value.available ? null : "Sold out",
                type: "button",
            }, value.value))))), price.stock != null &&
                price.stock > 0 &&
                price.stock <= 5 &&
                h("p", { class: "product-detail__stock" }, `Only ${price.stock} left`), h("div", { class: "buy" }, h("div", { "aria-label": "Quantity", class: "qty", role: "group" }, h("button", { "aria-label": "One fewer", "data-act": "fewer", disabled: quantity <= 1, type: "button" }, "−"), h("span", { "aria-live": "polite" }, quantity), h("button", { "aria-label": "One more", "data-act": "more", disabled: price.stock != null && quantity >= price.stock, type: "button" }, "+")), h("button", { class: "bd-btn buy__add", "data-act": "add", disabled: this.#busy || !price.ready, type: "button" }, cta)), this.#message &&
                h("div", {
                    class: `product-detail__msg${this.#message.kind === "error" ? " product-detail__msg--err" : ""}`,
                    role: "status",
                }, this.#message.text, this.#message.kind === "ok" && h("a", { class: "bd-btn bd-btn--ghost", href: cartHref }, "View cart")), h("div", { class: "product-detail__tools" }, h("bd-save-buttons", { "data-product": JSON.stringify(this.#summary()) }), h("button", { class: "share", "data-act": "share", type: "button" }, h("span", { "aria-hidden": "true" }, "↗"), " Share"), this.#shareNote && h("span", { class: "share__note", role: "status" }, this.#shareNote)), h("ul", { class: "policies" }, h("li", null, "Secure checkout with Stripe"), h("li", null, "Questions? ", h("a", { href: contactHref }, "Ask us"), " before you buy")))),
            (view.features.length > 0 || view.specs.length > 0) &&
                h("section", { class: "product-section", id: "specs" }, h("h2", { class: "product-section__title" }, "Details"), view.features.length > 0 && h("ul", { class: "features" }, view.features.map((feature) => h("li", null, feature))), view.specs.map((group) => h("table", { class: "specs" }, h("caption", null, group.name), h("tbody", null, group.rows.map((row) => h("tr", null, h("th", { scope: "row" }, row.label), h("td", null, row.value))))))),
            addons.length > 0 &&
                h("section", { class: "product-section" }, h("h2", { class: "product-section__title" }, "Complete your purchase"), h("div", { class: "addon-grid" }, addons.map((addon) => h("div", { class: "addon-card bd-card" }, h("div", { class: "addon-card__media" }, addon.imageUrl
                    ? h("img", { alt: addon.addonName, loading: "lazy", referrerpolicy: "no-referrer", src: addon.imageUrl })
                    : h("div", { class: "addon-card__noimg" }, "—")), h("div", { class: "addon-card__body" }, addon.groupLabel && h("span", { class: "addon-card__group" }, addon.groupLabel), h("p", { class: "addon-card__name" }, addon.addonName), addon.priceCents != null && h("span", { class: "addon-card__price" }, formatCents(addon.priceCents))), h("button", {
                    class: "bd-btn bd-btn--ghost addon-card__add",
                    "data-act": "addon",
                    "data-id": addon.id,
                    disabled: this.#addingAddon === addon.id || this.#addedAddons[addon.id] === true,
                    type: "button",
                }, this.#addedAddons[addon.id] ? "Added" : this.#addingAddon === addon.id ? "…" : "Add"))))),
            h("section", { class: "product-section", id: "reviews" }, h("h2", { class: "product-section__title" }, "Reviews"), reviews && reviews.items.length > 0
                ? [
                    h("p", { class: "reviews__summary" }, starRating(reviews.avgRating), h("strong", null, `${reviews.avgRating.toFixed(1)} out of 5`), h("span", null, `from ${reviews.totalCount} reviews`)),
                    h("div", { class: "review-list" }, reviews.items.map((review) => h("article", { class: "review" }, h("div", { class: "review__head" }, starRating(review.rating), h("span", { class: "review__name" }, review.reviewerName || "Verified buyer"), h("span", { class: "review__date" }, reviewDate(review.createdAt))), review.title && h("p", { class: "review__title" }, review.title), (review.content || review.body) && h("p", { class: "review__body" }, review.content || review.body)))),
                    moreReviewsHref && h("a", { class: "bd-btn bd-btn--ghost reviews__more", href: moreReviewsHref }, "Show more reviews"),
                ]
                : h("p", { class: "reviews__none" }, "No reviews yet.")),
            productRail("You may also like", relatedCards, store),
            productRail("Recently viewed", this.#recent, store),
            h("bd-compare-bar", { "data-store-href": store }),
        ]);
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
define("bd-product", ProductPage);
define("bd-wishlist", Wishlist);
define("bd-compare", CompareTable);
define("bd-saved-count", SavedCount);
define("bd-cart-count", CartCount);
