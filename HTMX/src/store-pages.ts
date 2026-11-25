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
 *   products, and draws the page from them (`productDetail`): option photos,
 *   option and size buttons, the price for what's chosen, add to cart
 *   (POST /api/bd/cart/add), save, compare, share. Small custom elements
 *   (src/shop/shop-elements.ts) bring it to life in the browser. More
 *   reviews: ?reviews=20.
 * - /store/wishlist and /store/compare: lists saved in this browser, drawn by
 *   `<bd-wishlist>` and `<bd-compare>`; the compare page loads ?ids=a,b here.
 * - /cart: htmx posts each change and swaps the cart back in.
 *
 * Every page is laid out from the shop's parts in src/sections/shop/, one
 * file each, so you can move, restyle or drop one, or build your own pages
 * from them. Cart amounts are dollars; product prices are cents.
 */
import { getBd } from "./bd";
import { html, jsonScript, render, type Raw } from "./html";
import { VISITOR_COOKIE, errBlock, getCookie, page, resolveVisitor } from "./layout";
import { cartActions } from "./sections/shop/cart-actions";
import { type CartLineItem, cartLine } from "./sections/shop/cart-line";
import { cartSummary } from "./sections/shop/cart-summary";
import { categoryFilter } from "./sections/shop/category-filter";
import { clearFilters } from "./sections/shop/clear-filters";
import { compareBar } from "./sections/shop/compare-bar";
import { couponForm } from "./sections/shop/coupon-form";
import { priceFilter } from "./sections/shop/price-filter";
import { productDetail } from "./sections/shop/product-detail";
import { productGrid } from "./sections/shop/product-grid";
import { ratingFilter } from "./sections/shop/rating-filter";
import { sortSelect } from "./sections/shop/sort-select";
import { SWAP, hasFilters as anyFilters, ratingOf, sortOf } from "./sections/shop/store-filters";
import { storeSearch } from "./sections/shop/store-search";
import type { ProductPageData } from "./shop/shop";
import type { CompareColumn } from "./shop/shop-elements";
import { STORE_NAV_MODULES, cartCountSwap, storeNav } from "./store-nav";

const NOT_CONFIGURED = new Error("BD not configured");
const SHOP_CSS = ["/bd-shop.css"];

function lead(eyebrow: string, title: string, sub: string): Raw {
	return html`<div class="bd-section__lead">
		<span class="bd-section__eyebrow">${eyebrow}</span>
		<h1 class="bd-section__title">${title}</h1>
		<p class="bd-section__sub">${sub}</p>
	</div>`;
}

// ── product list ───────────────────────────────────────────────────

function cents(value: string | null): number | undefined {
	if (!value?.trim()) return undefined;
	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

export async function storePage(url: URL, visitorToken: string | null): Promise<string> {
	const params = url.searchParams;
	const search = params.get("q")?.trim() || undefined;
	const categoryId = params.get("category") || undefined;
	const sort = sortOf(params);
	const minPriceCents = cents(params.get("priceMin"));
	const maxPriceCents = cents(params.get("priceMax"));
	const minRating = ratingOf(params) || undefined;
	const hasFilters = anyFilters(params);

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
			const categories = cats.items.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));

			const sidebar = html`<aside class="store-sidebar" ${SWAP}>
				${storeSearch(params)}
				${categoryFilter(params, categories)}
				${priceFilter(params, meta.priceRange)}
				${ratingFilter(params)}
				${hasFilters ? clearFilters() : ""}
			</aside>`;

			const results = html`<div class="store-results">
				<div class="store-results__bar">
					<p class="bd-loading">${String(products.length)} ${products.length === 1 ? "product" : "products"}</p>
					${sortSelect(params)}
				</div>
				${
					products.length === 0
						? html`<div class="bd-empty">${
								hasFilters
									? "No products match these filters. Try clearing a filter or broadening your search."
									: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."
							}</div>`
						: productGrid(products)
				}
				${compareBar()}
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
			: productDetail(data, { cartHref: "/cart", contactHref: "/#contact" });

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
	items: CartLineItem[];
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
		<ul class="cart-list">${items.map((item) => cartLine(item, currency))}</ul>
		${couponForm(snap.couponCode)}
		${cartSummary(snap, currency)}
		${cartActions()}
	</div>`;
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
