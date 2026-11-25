// Generated from the BD shop elements' TypeScript (the same elements every
// BD starter ships); plain JavaScript, so this starter needs no build step.
/**
 * The storefront's shared logic: product shaping for the product page, and
 * the visitor's saved lists (wishlist, compare, recently viewed).
 *
 * Framework-free on purpose. The pages render what these functions return,
 * so the rules (which photos show for an option, what "from $40" means, how
 * many products fit the compare table) live in one place.
 *
 * Money: product cards carry integer CENTS (`cheapestPriceCents`); variants,
 * options and cart lines carry DOLLARS. Each value below says which.
 */
const text = (v) => (typeof v === "string" ? v.trim() : "");
const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
const records = (v) => Array.isArray(v) ? v.filter((x) => !!x && typeof x === "object") : [];
/** Read the specifications column (`{ features, groups: [{ name, rows }] }`). */
export function readSpecs(raw) {
    const obj = raw && typeof raw === "object" ? raw : {};
    const features = Array.isArray(obj.features)
        ? obj.features.map(text).filter(Boolean)
        : [];
    const specs = records(obj.groups)
        .map((group) => ({
        name: text(group.name),
        rows: records(group.rows)
            .map((row) => ({ label: text(row.label), value: text(row.value) }))
            .filter((row) => row.label && row.value),
    }))
        .filter((group) => group.name && group.rows.length > 0);
    return { features, specs };
}
/** Shape a `storefront.getProduct` response for the product page. */
export function toProductView(product) {
    const detail = product;
    const category = detail.category && typeof detail.category === "object" ? detail.category : null;
    const productImages = records(detail.productImages)
        .map((image) => ({ url: text(image.url), order: num(image.order) ?? 0 }))
        .filter((image) => image.url)
        .sort((a, b) => a.order - b.order)
        .map((image) => image.url);
    const images = Array.isArray(detail.images)
        ? detail.images.map(text).filter(Boolean)
        : [];
    return {
        id: text(detail.id),
        name: text(detail.name) || "Untitled",
        description: text(detail.description),
        categoryId: text(detail.categoryId) || null,
        categoryName: category ? text(category.name) || null : null,
        images: images.length > 0 ? images : productImages,
        variants: records(detail.variants).map((variant) => ({
            id: text(variant.id),
            name: text(variant.name) || "Default",
            price: num(variant.price),
            stock: num(variant.stock),
            available: variant.isLive !== false && num(variant.stock) !== 0,
        })),
        variantImages: records(detail.variantImages)
            .map((image) => ({
            variantId: text(image.variantId),
            url: text(image.url),
            order: num(image.order) ?? 0,
        }))
            .filter((image) => image.url),
        optionTitles: records(detail.crossVariantTitles).map((title) => ({
            id: text(title.id),
            title: text(title.title),
            variantId: text(title.variantId) || null,
        })),
        optionValues: records(detail.crossVariants).map((option) => ({
            id: text(option.id),
            titleId: text(option.crossVariantTitleId),
            value: text(option.value),
            price: num(option.price) ?? 0,
            stock: num(option.stock),
            available: option.isLive !== false && num(option.stock) !== 0,
        })),
        ...readSpecs(detail.specifications),
    };
}
/** The variant a page opens on: the first one that can be bought. */
export function defaultVariant(view) {
    return view.variants.find((v) => v.available) ?? view.variants[0];
}
/** The photos for a variant: its own when it has any, else the product's. */
export function galleryFor(view, variantId) {
    const own = view.variantImages
        .filter((image) => image.variantId === variantId)
        .sort((a, b) => a.order - b.order)
        .map((image) => image.url);
    return own.length > 0 ? own : view.images;
}
const SIZE_ORDER = ["XXS", "2XS", "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "XXL", "3XL", "4XL"];
/** The option groups (Size, Colour…) that apply to a variant. */
export function optionGroupsFor(view, variantId) {
    return view.optionTitles
        .filter((title) => title.variantId === null || title.variantId === variantId)
        .map((title) => {
        const values = view.optionValues.filter((option) => option.titleId === title.id);
        if (/^sizes?$/i.test(title.title)) {
            const rank = (v) => {
                const i = SIZE_ORDER.indexOf(v.toUpperCase());
                return i === -1 ? SIZE_ORDER.length : i;
            };
            values.sort((a, b) => rank(a.value) - rank(b.value));
        }
        return { id: title.id, title: title.title, values };
    })
        .filter((group) => group.values.length > 0);
}
/**
 * The price shown for a variant and the options chosen so far (`chosen` maps
 * an option group's id to an option value's id).
 */
export function priceFor(view, variantId, chosen) {
    const variant = view.variants.find((v) => v.id === variantId);
    if (!variant?.available) {
        return { amount: null, from: false, stock: 0, ready: false };
    }
    const groups = optionGroupsFor(view, variantId);
    if (groups.length === 0) {
        return { amount: variant.price, from: false, stock: variant.stock, ready: true };
    }
    const picks = groups.map((group) => group.values.find((value) => value.id === chosen[group.id]));
    if (picks.some((pick) => !pick)) {
        const lowest = groups.map((group) => {
            const open = group.values.filter((value) => value.available);
            return open.length ? Math.min(...open.map((value) => value.price)) : 0;
        });
        return { amount: lowest.reduce((a, b) => a + b, 0), from: true, stock: null, ready: false };
    }
    if (picks.some((pick) => !pick?.available)) {
        return { amount: null, from: false, stock: 0, ready: false };
    }
    const stocks = picks
        .map((pick) => view.optionValues.find((v) => v.id === pick?.id)?.stock ?? null)
        .filter((stock) => stock !== null);
    return {
        amount: picks.reduce((sum, pick) => sum + (pick?.price ?? 0), 0),
        from: false,
        stock: stocks.length ? Math.min(...stocks) : null,
        ready: true,
    };
}
/** The chosen options as the cart line's `options` ({ Size: "M" }). */
export function chosenOptions(view, variantId, chosen) {
    const out = {};
    for (const group of optionGroupsFor(view, variantId)) {
        const value = group.values.find((v) => v.id === chosen[group.id]);
        if (value)
            out[group.title] = value.value;
    }
    return Object.keys(out).length ? out : undefined;
}
// ── Money ───────────────────────────────────────────────────────────
export function formatDollars(amount, currency = "USD") {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amount);
    }
    catch {
        return `$${amount.toFixed(2)}`;
    }
}
export function formatCents(cents, currency = "USD") {
    return formatDollars(cents / 100, currency);
}
const CHANGED = "bd:saved-list";
/**
 * A list kept in this browser's localStorage. Nothing reaches the server:
 * a wishlist that follows a signed-in customer between devices would need a
 * table of its own.
 */
export function createSavedList(key, limit) {
    const read = () => {
        try {
            const raw = globalThis.localStorage?.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return records(parsed)
                .map((item) => ({
                id: text(item.id),
                name: text(item.name),
                image: text(item.image) || null,
                priceCents: num(item.priceCents),
            }))
                .filter((item) => item.id);
        }
        catch {
            return [];
        }
    };
    const write = (items) => {
        try {
            globalThis.localStorage?.setItem(key, JSON.stringify(items.slice(0, limit)));
        }
        catch {
            // Private mode or a full quota: the list just doesn't persist.
        }
        globalThis.dispatchEvent?.(new CustomEvent(CHANGED, { detail: key }));
    };
    return {
        limit,
        read,
        has: (id) => read().some((item) => item.id === id),
        toggle(product) {
            const items = read();
            if (items.some((item) => item.id === product.id)) {
                write(items.filter((item) => item.id !== product.id));
                return false;
            }
            if (items.length >= limit)
                return false;
            write([...items, product]);
            return true;
        },
        add(product) {
            write([product, ...read().filter((item) => item.id !== product.id)]);
        },
        remove(id) {
            write(read().filter((item) => item.id !== id));
        },
        clear() {
            write([]);
        },
        subscribe(listener) {
            const here = (event) => {
                if (event.detail === key)
                    listener(read());
            };
            const elsewhere = (event) => {
                if (event.key === key)
                    listener(read());
            };
            globalThis.addEventListener?.(CHANGED, here);
            globalThis.addEventListener?.("storage", elsewhere);
            return () => {
                globalThis.removeEventListener?.(CHANGED, here);
                globalThis.removeEventListener?.("storage", elsewhere);
            };
        },
    };
}
export const wishlist = createSavedList("bd:wishlist", 60);
/** The compare table fits four. */
export const compareList = createSavedList("bd:compare", 4);
export const recentlyViewed = createSavedList("bd:recently-viewed", 12);
// ── Sharing ─────────────────────────────────────────────────────────
/** The phone's share sheet where there is one, else the link copied. */
export async function shareLink(url, title) {
    try {
        if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share({ url, title });
            return "shared";
        }
        await navigator.clipboard.writeText(url);
        return "copied";
    }
    catch (error) {
        // Closing the share sheet isn't a failure.
        if (error instanceof DOMException && error.name === "AbortError")
            return "shared";
        return "failed";
    }
}
