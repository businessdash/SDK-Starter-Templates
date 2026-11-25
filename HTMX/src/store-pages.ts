// [bd-file:store]
/**
 * The store: the product list, a product, the wishlist, the compare table
 * and the cart, rendered here on the server.
 *
 * - /store: every filter is in the URL (?q, ?category, ?priceMin, ?priceMax,
 *   ?rating, ?sort). The facets are links and the search, price and sort are
 *   GET forms, so they work without JavaScript; with it, htmx (`hx-boost`)
 *   fetches the new list and swaps just the layout, keeping the URL in step.
 * - /store/:id: the server loads the product, its reviews, add-ons and related
 *   products, and `<bd-product>` (src/shop/shop-elements.ts) draws the page
 *   from that data: option photos, option and size buttons, the price for
 *   what's chosen, add to cart (POST /api/bd/cart/add), save, compare, share.
 *   More reviews: ?reviews=20.
 * - /store/wishlist and /store/compare: lists saved in this browser, drawn by
 *   `<bd-wishlist>` and `<bd-compare>`; the compare page loads ?ids=a,b here.
 * - /cart: htmx posts each change and swaps the cart back in.
 *
 * Cart amounts are dollars (`dollars`); product prices are cents (`money`).
 */
import { getBd } from "./bd";
import { html, raw, render, type Raw } from "./html";
import { VISITOR_COOKIE, dollars, errBlock, getCookie, money, page, resolveVisitor } from "./layout";
import type { CompareColumn, ProductPageData } from "./shop/shop-elements";
import { STORE_NAV_MODULES, cartCountSwap, storeNav } from "./store-nav";

const NOT_CONFIGURED = new Error("BD not configured");
const SHOP_CSS = ["/bd-shop.css"];

/** Server data for a custom element, as JSON in a script tag inside it. `<`
 *  is written as \u003c, so the JSON can't close the tag early. */
function jsonScript(value: unknown): Raw {
	return raw(`<script type="application/json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`);
}

/** Stars for a rating, the same markup the shop elements draw. */
function stars(rating: number): Raw {
	return html`<span aria-label="${`${rating.toFixed(1)} out of 5`}" class="stars" role="img">${[1, 2, 3, 4, 5].map((i) => {
		const on = rating >= i;
		const half = !on && rating >= i - 0.5;
		return html`<span class="stars__star${on ? " stars__star--on" : ""}${half ? " stars__star--half" : ""}">★</span>`;
	})}</span>`;
}

function lead(eyebrow: string, title: string, sub: string): Raw {
	return html`<div class="bd-section__lead">
		<span class="bd-section__eyebrow">${eyebrow}</span>
		<h1 class="bd-section__title">${title}</h1>
		<p class="bd-section__sub">${sub}</p>
	</div>`;
}

// ── product list ───────────────────────────────────────────────────

const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const FILTER_KEYS = ["q", "category", "priceMin", "priceMax", "rating"];

/** On the filters: htmx fetches the new list and swaps only the layout. */
const SWAP = html`hx-boost="true" hx-target="#store-layout" hx-select="#store-layout" hx-swap="outerHTML"`;

function cents(value: string | null): number | undefined {
	if (!value?.trim()) return undefined;
	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

export async function storePage(url: URL, visitorToken: string | null): Promise<string> {
	const params = url.searchParams;
	const search = params.get("q")?.trim() || undefined;
	const categoryId = params.get("category") || undefined;
	const sortRaw = params.get("sort");
	const sort: Sort = SORTS.find((s) => s.value === sortRaw)?.value ?? "featured";
	const minPriceCents = cents(params.get("priceMin"));
	const maxPriceCents = cents(params.get("priceMax"));
	const ratingRaw = Number.parseInt(params.get("rating") ?? "", 10);
	const minRating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined;
	const hasFilters = FILTER_KEYS.some((key) => params.get(key));

	/** This list with some filters changed (null removes one). */
	const hrefWith = (changes: Record<string, string | null>): string => {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === "") next.delete(key);
			else next.set(key, value);
		}
		const query = next.toString();
		return query ? `/store?${query}` : "/store";
	};
	/** The filters a form leaves alone, carried along as hidden fields. */
	const keep = (...replaced: string[]): Raw[] =>
		[...params]
			.filter(([key]) => !replaced.includes(key))
			.map(([name, value]) => html`<input type="hidden" name="${name}" value="${value}" />`);

	const bd = getBd();
	let layout: Raw;
	if (!bd) {
		layout = errBlock(NOT_CONFIGURED);
	} else {
		try {
			const [meta, cats] = await Promise.all([
				bd.storefront.listProductsWithMeta({
					limit: 48,
					sort,
					...(search ? { search } : {}),
					...(categoryId ? { categoryId } : {}),
					...(minPriceCents != null ? { minPriceCents } : {}),
					...(maxPriceCents != null ? { maxPriceCents } : {}),
					...(minRating != null ? { minRating } : {}),
				}),
				bd.storefront.listCategories().catch(() => ({ items: [] })),
			]);
			const products = meta.items ?? [];
			const counts = new Map((meta.categoryCounts ?? []).map((c) => [c.categoryId, c.count]));
			const range = meta.priceRange;

			const sidebar = html`<aside class="store-sidebar" ${SWAP}>
				<form action="/store" method="get">
					<label class="bd-label" for="store-search">Search</label>
					<input autocomplete="off" class="bd-input" id="store-search" name="q" placeholder="Search products…" type="search" value="${params.get("q") ?? ""}" />
					${keep("q")}
				</form>
				${
					cats.items.length > 0
						? html`<div class="store-facet">
							<p class="store-facet__title">Category</p>
							<ul class="store-facet__list">
								<li><a class="store-facet__item${categoryId ? "" : " store-facet__item--active"}" href="${hrefWith({ category: null })}">All products</a></li>
								${cats.items.map((c) => {
									const active = categoryId === c.id;
									return html`<li><a class="store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}" href="${hrefWith({ category: active ? null : c.id })}"><span>${c.name}</span><span class="store-facet__count">${String(counts.get(c.id) ?? 0)}</span></a></li>`;
								})}
							</ul>
						</div>`
						: ""
				}
				<form action="/store" class="store-facet" method="get">
					<p class="store-facet__title">Price</p>
					<div class="store-price">
						<input aria-label="Lowest price" class="bd-input" inputmode="decimal" name="priceMin" placeholder="${range ? `$${Math.floor(range.minDollars)}` : "Min"}" value="${params.get("priceMin") ?? ""}" />
						<span aria-hidden="true" class="store-price__sep">–</span>
						<input aria-label="Highest price" class="bd-input" inputmode="decimal" name="priceMax" placeholder="${range ? `$${Math.ceil(range.maxDollars)}` : "Max"}" value="${params.get("priceMax") ?? ""}" />
					</div>
					${keep("priceMin", "priceMax")}
					<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
				</form>
				<div class="store-facet">
					<p class="store-facet__title">Rating</p>
					<ul class="store-facet__list">
						${[4, 3, 2].map((r) => {
							const active = minRating === r;
							return html`<li><a class="store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}" href="${hrefWith({ rating: active ? null : String(r) })}">${stars(r)}<span class="store-facet__count">&amp; up</span></a></li>`;
						})}
					</ul>
				</div>
				${hasFilters ? html`<a class="store-clear" href="/store">Clear all filters</a>` : ""}
			</aside>`;

			const results = html`<div class="store-results">
				<div class="store-results__bar">
					<p class="bd-loading">${String(products.length)} ${products.length === 1 ? "product" : "products"}</p>
					<form action="/store" class="store-sort" method="get" ${SWAP}>
						<label for="store-sort">Sort</label>
						<select class="bd-select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
							${SORTS.map((s) => html`<option value="${s.value}"${s.value === sort ? html` selected` : ""}>${s.label}</option>`)}
						</select>
						${keep("sort")}
						<noscript><button class="bd-btn bd-btn--ghost" type="submit">Sort</button></noscript>
					</form>
				</div>
				${
					products.length === 0
						? html`<div class="bd-empty">${
								hasFilters
									? "No products match these filters. Try clearing a filter or broadening your search."
									: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."
							}</div>`
						: html`<div class="bd-grid-3">${products.map(productCard)}</div>`
				}
				<bd-compare-bar></bd-compare-bar>
			</div>`;

			layout = html`<div class="store-layout" id="store-layout">${sidebar}${results}</div>`;
		} catch (err) {
			layout = errBlock(err);
		}
	}

	return page({
		origin: url.origin,
		title: "Store",
		description: "Browse our products.",
		styles: SHOP_CSS,
		modules: STORE_NAV_MODULES,
		subnav: await storeNav(visitorToken),
		mainClass: "bd-page",
		body: html`${lead("Shop", "Products", "Filter, sort, and open a product to choose its options and add it to your cart.")}${layout}`,
	});
}

type ListedProduct = {
	id: string;
	name: string;
	coverImage?: string | null;
	isBestSeller?: boolean;
	isNew?: boolean;
	isOnSale?: boolean;
	isLowStock?: boolean;
	reviewCount?: number | null;
	avgRating?: number | null;
	cheapestPriceCents?: number | null;
	comparePriceCents?: number | null;
	hasMultipleVariants?: boolean;
};

function productCard(p: ListedProduct): Raw {
	const saved = JSON.stringify({ id: p.id, name: p.name, image: p.coverImage ?? null, priceCents: p.cheapestPriceCents ?? null });
	return html`<div class="bd-card product-card">
		<a class="product-card__link" href="/store/${encodeURIComponent(p.id)}">
			<div class="product-card__media">
				${
					p.coverImage
						? html`<img alt="${p.name}" class="product-card__img" loading="lazy" referrerpolicy="no-referrer" src="${p.coverImage}" />`
						: html`<div class="product-card__noimg">No image</div>`
				}
				<div class="product-card__badges">
					${p.isBestSeller ? html`<span class="bd-badge">Best seller</span>` : ""}
					${p.isNew ? html`<span class="bd-badge">New</span>` : ""}
					${p.isOnSale ? html`<span class="bd-badge product-card__badge--sale">Sale</span>` : ""}
				</div>
			</div>
			<div class="product-card__body">
				<h3>${p.name || "Untitled"}</h3>
				${
					(p.reviewCount ?? 0) > 0
						? html`<div class="product-card__rating">${stars(p.avgRating ?? 0)}<span class="product-card__count">(${String(p.reviewCount)})</span></div>`
						: ""
				}
				<div class="product-card__price">
					<span class="product-card__amount">${
						p.cheapestPriceCents != null ? `${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}` : "View details"
					}</span>
					${p.isOnSale && p.comparePriceCents != null ? html`<span class="product-card__compare">${money(p.comparePriceCents)}</span>` : ""}
				</div>
				${p.isLowStock ? html`<span class="product-card__lowstock">Low stock</span>` : ""}
			</div>
		</a>
		<div class="product-card__save"><bd-save-buttons compact data-product="${saved}"></bd-save-buttons></div>
	</div>`;
}

// ── one product ────────────────────────────────────────────────────

/** Reviews shown at first, and how many more each "Show more" adds. */
const REVIEWS_PAGE = 10;

export async function productPage(
	url: URL,
	id: string,
	visitorToken: string | null,
): Promise<{ html: string; status: number }> {
	const bd = getBd();
	const reviewsRaw = Number.parseInt(url.searchParams.get("reviews") ?? "", 10);
	const reviewLimit = Math.min(100, Number.isFinite(reviewsRaw) && reviewsRaw > REVIEWS_PAGE ? reviewsRaw : REVIEWS_PAGE);

	let data: ProductPageData | null = null;
	let failure: unknown = null;
	if (bd) {
		try {
			const product = await bd.storefront.getProduct(id);
			const [reviews, addons, related] = await Promise.all([
				bd.storefront.getProductReviews(id, { limit: reviewLimit }).catch(() => null),
				bd.storefront
					.getProductAddons(id)
					.then((res) => res.items)
					.catch(() => []),
				bd.storefront
					.getRelatedProducts(id, { limit: 6 })
					.then((res) => res.items)
					.catch(() => []),
			]);
			data = {
				product,
				reviews,
				addons,
				related,
				moreReviewsHref:
					reviews && reviews.totalCount > reviews.items.length
						? `/store/${encodeURIComponent(id)}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
						: null,
			};
		} catch (err) {
			failure = err;
		}
	}

	const product = data?.product;
	const description = typeof product?.description === "string" && product.description ? product.description : null;
	const body = !bd
		? errBlock(NOT_CONFIGURED)
		: !data || !product
			? /Suspended|Lapsed|unavailable|\b503\b/i.test(String(failure))
				? errBlock(failure)
				: html`<div class="bd-empty">That product isn't available. <a href="/store">Browse the store</a></div>`
			: html`<bd-product data-add-url="/api/bd/cart/add" data-cart-href="/cart" data-contact-href="/#contact">
					${jsonScript(data)}
					<noscript>
						<h1>${product.name}</h1>
						${description ? html`<p>${description}</p>` : ""}
						<p>Turn on JavaScript to choose options and add this to your cart.</p>
					</noscript>
				</bd-product>`;

	return {
		status: bd && !data ? 404 : 200,
		html: await page({
			origin: url.origin,
			title: product ? `${product.name} — Store` : "Product — Store",
			description: description ?? "Product detail",
			image: product?.images?.[0] ?? null,
			styles: SHOP_CSS,
			modules: STORE_NAV_MODULES,
			subnav: await storeNav(visitorToken),
			mainClass: "bd-page",
			body,
		}),
	};
}

// ── wishlist + compare ─────────────────────────────────────────────

/** Products saved on this device with ♡ Save; `<bd-wishlist>` draws them there. */
export async function wishlistPage(url: URL, visitorToken: string | null): Promise<string> {
	return page({
		origin: url.origin,
		title: "Wishlist — Store",
		description: "Products you saved to come back to.",
		styles: SHOP_CSS,
		modules: STORE_NAV_MODULES,
		subnav: await storeNav(visitorToken),
		mainClass: "bd-page",
		body: html`${lead("Shop", "Wishlist", "Products you saved on this device.")}
			<bd-wishlist><p class="bd-loading">Loading your wishlist…</p></bd-wishlist>`,
	});
}

/**
 * Up to four products side by side. The products come from ?ids=a,b, so a
 * comparison can be shared; opened without ids, `<bd-compare>` moves this
 * browser's picks into the URL.
 */
export async function comparePage(url: URL, visitorToken: string | null): Promise<string> {
	const ids = (url.searchParams.get("ids") ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 4);
	const bd = getBd();
	const columns: CompareColumn[] = [];
	if (bd) {
		const loaded = await Promise.all(
			ids.map(async (id): Promise<CompareColumn | null> => {
				try {
					const [product, reviews] = await Promise.all([
						bd.storefront.getProduct(id),
						bd.storefront.getProductReviews(id, { limit: 1 }).catch(() => null),
					]);
					return {
						product,
						rating: reviews && reviews.totalCount > 0 ? { avg: reviews.avgRating, count: reviews.totalCount } : null,
					};
				} catch {
					return null;
				}
			}),
		);
		for (const column of loaded) if (column) columns.push(column);
	}
	return page({
		origin: url.origin,
		title: "Compare — Store",
		description: "Products side by side.",
		styles: SHOP_CSS,
		modules: STORE_NAV_MODULES,
		subnav: await storeNav(visitorToken),
		mainClass: "bd-page",
		body: html`${lead("Shop", "Compare", "Up to four products side by side.")}
			<bd-compare>${jsonScript({ ids, columns })}</bd-compare>`,
	});
}

// ── cart ───────────────────────────────────────────────────────────

/** The cart as the SDK returns it; amounts are dollars. */
type CartSnap = {
	items: Array<{
		id: string;
		productName?: string | null;
		productImage?: string | null;
		variantTitle?: string | null;
		quantity: number;
		unitPrice: number;
		subtotal: number;
		currency?: string | null;
	}>;
	itemCount: number;
	subtotal: number;
	currency?: string | null;
	couponCode?: string | null;
};

const EMPTY_CART: CartSnap = { items: [], itemCount: 0, subtotal: 0, currency: "USD" };

async function getCartSnap(token: string | null): Promise<CartSnap> {
	const bd = getBd();
	if (!bd || !token) return EMPTY_CART;
	try {
		return (await bd.cart.forVisitor(token).get()) as CartSnap;
	} catch {
		return EMPTY_CART;
	}
}

export async function cartPage(origin: string, token: string | null): Promise<string> {
	const snap = await getCartSnap(token);
	return page({
		origin,
		title: "Your cart",
		modules: STORE_NAV_MODULES,
		subnav: await storeNav(token, snap.itemCount),
		body: html`<header class="page__head"><h1 class="page__title">Your cart</h1></header>${cartRegion(snap)}`,
	});
}

function cartRegion(snap: CartSnap): Raw {
	const items = snap.items ?? [];
	const currency = snap.currency ?? "USD";
	if (!items.length) {
		return html`<div id="cart-region"><p class="muted">Your cart is empty. <a href="/store">Browse the store →</a></p></div>`;
	}
	return html`<div id="cart-region">
		<ul class="cart-list">${items.map((it) => cartItem(it, currency))}</ul>
		${couponRow(snap)}
		<div class="cart-summary">
			<div class="cart-summary__row">
				<span>Subtotal (${String(snap.itemCount)} item${snap.itemCount === 1 ? "" : "s"})</span>
				<strong>${dollars(snap.subtotal, currency)}</strong>
			</div>
		</div>
		<div class="cart-actions">
			<button class="btn btn--ghost" type="button" hx-post="/cart/clear" hx-target="#cart-region" hx-swap="outerHTML">Clear cart</button>
			<form method="post" action="/cart/checkout"><button class="btn btn--primary btn--lg" type="submit">Checkout</button></form>
		</div>
	</div>`;
}

function cartItem(it: CartSnap["items"][number], currency: string): Raw {
	const dec = JSON.stringify({ itemId: it.id, quantity: Math.max(0, it.quantity - 1) });
	const inc = JSON.stringify({ itemId: it.id, quantity: it.quantity + 1 });
	const rm = JSON.stringify({ itemId: it.id });
	return html`<li class="cart-item">
		${it.productImage ? html`<img class="cart-item__img" src="${it.productImage}" alt="${it.productName ?? ""}" />` : ""}
		<div class="cart-item__main">
			<div class="cart-item__name">${it.productName ?? "Item"}</div>
			${it.variantTitle ? html`<div class="cart-item__variant">${it.variantTitle}</div>` : ""}
			<div class="cart-item__price">${dollars(it.unitPrice, it.currency ?? currency)} each</div>
		</div>
		<div class="cart-qty">
			<button class="cart-qty__btn" type="button" aria-label="Decrease" hx-post="/cart/update" hx-vals="${dec}" hx-target="#cart-region" hx-swap="outerHTML">−</button>
			<span class="cart-qty__n">${String(it.quantity)}</span>
			<button class="cart-qty__btn" type="button" aria-label="Increase" hx-post="/cart/update" hx-vals="${inc}" hx-target="#cart-region" hx-swap="outerHTML">+</button>
		</div>
		<div class="cart-item__subtotal">${dollars(it.subtotal, it.currency ?? currency)}</div>
		<button class="cart-item__remove" type="button" hx-post="/cart/remove" hx-vals="${rm}" hx-target="#cart-region" hx-swap="outerHTML">Remove</button>
	</li>`;
}

function couponRow(snap: CartSnap): Raw {
	if (snap.couponCode) {
		return html`<div class="coupon coupon--applied">
			<span>Coupon ${snap.couponCode} applied</span>
			<button class="btn btn--ghost btn--sm" type="button" hx-post="/cart/coupon/remove" hx-target="#cart-region" hx-swap="outerHTML">Remove</button>
		</div>`;
	}
	return html`<form class="coupon" hx-post="/cart/coupon" hx-target="#cart-region" hx-swap="outerHTML">
		<input class="coupon__input" type="text" name="code" placeholder="Coupon code" aria-label="Coupon code" />
		<button class="btn btn--ghost btn--sm" type="submit">Apply</button>
	</form>`;
}

/** A change on /cart: the SDK call for `op`, then the cart and the store
 *  bar's count as HTML for htmx to swap in. */
export async function handleCartOp(
	req: Request,
	op: "update" | "remove" | "coupon" | "coupon-remove" | "clear",
): Promise<{ body: string; status?: number }> {
	const bd = getBd();
	if (!bd) return { body: render(errBlock(NOT_CONFIGURED)), status: 503 };
	const token = getCookie(req, VISITOR_COOKIE);
	if (!token) return { body: render(cartRegion(EMPTY_CART)) };
	const form = await req.formData();
	const cart = bd.cart.forVisitor(token);
	try {
		let snap: unknown;
		if (op === "update") snap = await cart.updateItem(String(form.get("itemId") ?? ""), { quantity: Number(form.get("quantity") ?? 0) });
		else if (op === "remove") snap = await cart.removeItem(String(form.get("itemId") ?? ""));
		else if (op === "coupon") snap = await cart.applyCoupon({ code: String(form.get("code") ?? "") });
		else if (op === "coupon-remove") snap = await cart.removeCoupon();
		else snap = await cart.clear();
		const next = snap as CartSnap;
		return { body: render(html`${cartRegion(next)}${cartCountSwap(next.itemCount)}`) };
	} catch (err) {
		return { body: render(errBlock(err)) };
	}
}

/**
 * Add to the cart, for `<bd-product>`: JSON `{ productId, variantId?,
 * quantity?, options? }` in; `{ ok, itemCount }` or `{ ok: false, error }`
 * out. The first add mints the visitor's cart cookie.
 */
export async function addToCart(req: Request): Promise<Response> {
	const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
	const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
	const bd = getBd();
	if (!bd) return reply({ ok: false, error: "The store isn't connected yet." }, 503);
	// A JSON body only: a form on another site can't send one.
	if (!req.headers.get("content-type")?.includes("application/json")) return reply({ ok: false, error: "Send JSON." }, 415);
	const body = (await req.json().catch(() => null)) as {
		productId?: unknown;
		variantId?: unknown;
		quantity?: unknown;
		options?: unknown;
	} | null;
	const productId = typeof body?.productId === "string" ? body.productId : "";
	if (!productId) return reply({ ok: false, error: "Choose a product." }, 400);
	const quantity = Math.max(1, Math.min(99, Math.floor(Number(body?.quantity) || 1)));
	const options =
		body?.options && typeof body.options === "object"
			? Object.fromEntries(Object.entries(body.options as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"))
			: {};
	const { token, setCookie } = resolveVisitor(req);
	if (setCookie) headers["Set-Cookie"] = setCookie;
	try {
		const snap = await bd.cart.forVisitor(token).addItem({
			productId,
			quantity,
			...(typeof body?.variantId === "string" && body.variantId ? { variantId: body.variantId } : {}),
			...(Object.keys(options).length > 0 ? { options } : {}),
		});
		return reply({ ok: true, itemCount: snap.itemCount });
	} catch {
		return reply({ ok: false, error: "Couldn't add that to your cart. Try again." }, 502);
	}
}
