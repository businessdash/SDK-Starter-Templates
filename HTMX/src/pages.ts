/**
 * Server-rendered feature pages + HTMX fragments (store / cart / subscriptions /
 * reviews / updates / my-account / services). Each renderer returns an HTML
 * string; cart mutations and "load more" return fragments the browser swaps in.
 *
 * Product/cart/etc. response shapes are read defensively — the SDK keeps several
 * commerce surfaces loose/passthrough at 0.9.5.
 */

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
	TODO_FORM_SLUG,
} from "../bd.data-model.config";
import { getBd, getBdDataModel, getSession, portalFor } from "./bd";
import { cached } from "./cache";
import { html, raw, render, type Raw } from "./html";
import {
	SESSION_COOKIE,
	VISITOR_COOKIE,
	dollars,
	errBlock,
	getCookie,
	money,
	page,
	resolveVisitor,
} from "./layout";

const NOT_CONFIGURED = new Error("BD not configured");

// ── store ──────────────────────────────────────────────────────────

type StoreSort = "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";

const SORT_LABELS: Record<StoreSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

/** Filters read off the `/store` querystring (mirrors the DGP store params). */
type StoreFilters = {
	search?: string;
	categoryId?: string;
	sort?: StoreSort;
	minRating?: number;
	minDollars?: number;
	maxDollars?: number;
};

function parseStoreFilters(params: URLSearchParams): StoreFilters {
	const f: StoreFilters = {};
	const q = params.get("q")?.trim();
	if (q) f.search = q;
	const category = params.get("category")?.trim();
	if (category) f.categoryId = category;
	const sort = params.get("sort")?.trim();
	if (sort && sort in SORT_LABELS) f.sort = sort as StoreSort;
	const rating = Number(params.get("rating"));
	if (Number.isFinite(rating) && rating >= 1 && rating <= 5) f.minRating = rating;
	// Price range — each side optional, in whole/fractional dollars.
	const minStr = params.get("priceMin")?.trim();
	const maxStr = params.get("priceMax")?.trim();
	const min = Number(minStr);
	const max = Number(maxStr);
	if (minStr && Number.isFinite(min) && min >= 0) f.minDollars = min;
	if (maxStr && Number.isFinite(max) && max >= 0) f.maxDollars = max;
	return f;
}

/** Re-emit the active price range as hidden inputs so a control that doesn't own
 *  the price form (search/sort) still round-trips it on swap. */
function pricePassThru(filters: StoreFilters): Raw {
	return html`${filters.minDollars != null ? html`<input type="hidden" name="priceMin" value="${String(filters.minDollars)}" />` : ""}${filters.maxDollars != null ? html`<input type="hidden" name="priceMax" value="${String(filters.maxDollars)}" />` : ""}`;
}

/** Build a `/store?…` href with one param flipped (null clears it). Keeps the
 *  rest of the current filter set so HTMX swaps + shareable URLs stay in sync. */
function storeHref(params: URLSearchParams, key: string, value: string | null): string {
	const next = new URLSearchParams(params.toString());
	if (value === null || value === "") next.delete(key);
	else next.set(key, value);
	const qs = next.toString();
	return qs ? `/store?${qs}` : "/store";
}

export async function storePage(url: URL, isHxRequest = false): Promise<string> {
	const origin = url.origin;
	const params = url.searchParams;
	const filters = parseStoreFilters(params);
	const bd = getBd();

	let layout: Raw;

	if (!bd) {
		layout = html`<div id="store-layout" class="store-layout store-layout--message">${errBlock(NOT_CONFIGURED)}</div>`;
	} else {
		try {
			const [meta, cats] = await Promise.all([
				bd.storefront.listProductsWithMeta({
					...(filters.search ? { search: filters.search } : {}),
					...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
					...(filters.minRating != null ? { minRating: filters.minRating } : {}),
					...(filters.minDollars != null ? { minPriceCents: Math.round(filters.minDollars * 100) } : {}),
					...(filters.maxDollars != null ? { maxPriceCents: Math.round(filters.maxDollars * 100) } : {}),
					...(filters.sort ? { sort: filters.sort } : {}),
					limit: 48,
				}),
				bd.storefront.listCategories().catch(() => ({ items: [] as any[] })),
			]);
			const items = (meta as any)?.items ?? [];
			// Full layout (sidebar + grid) so an htmx swap keeps active filter
			// states + category counts in sync, not just the grid.
			layout = html`<div id="store-layout" class="store-layout">
				<aside class="store-sidebar">${storeSidebar(meta as any, (cats as any)?.items ?? [], filters, params)}</aside>
				${storeGrid(items, filters)}
			</div>`;
		} catch (err) {
			layout = html`<div id="store-layout" class="store-layout store-layout--message">${errBlock(err)}</div>`;
		}
	}

	// HTMX swap: return just the layout region (controls target #store-layout).
	if (isHxRequest) return render(layout);

	const body = html`<header class="page__head">
			<h1 class="page__title">Store</h1>
			<p class="page__sub">Browse our products.</p>
		</header>
		${layout}`;
	return page({ origin, title: "Store", description: "Browse our products.", body });
}

/** The filter sidebar — search, categories (+counts), price range, min-rating.
 *  Controls navigate to `/store?…` and HTMX-swap `#store-layout` in place,
 *  pushing the URL so filters stay shareable + back-button friendly. */
function storeSidebar(
	meta: { categoryCounts?: Array<{ categoryId: string; count: number }>; priceRange?: { minDollars: number; maxDollars: number } },
	categories: Array<{ id: string; name: string }>,
	filters: StoreFilters,
	params: URLSearchParams,
): Raw {
	const counts = new Map((meta.categoryCounts ?? []).map((c) => [c.categoryId, c.count]));
	const range = meta.priceRange ?? { minDollars: 0, maxDollars: 0 };
	const hasFilters = Boolean(
		filters.search || filters.categoryId || filters.minRating != null || filters.minDollars != null || filters.maxDollars != null,
	);
	// Keep the active sort across grid swaps so a search/category change doesn't
	// silently reset it — carry it as a hidden input on each control form.
	const sortHidden = filters.sort ? html`<input type="hidden" name="sort" value="${filters.sort}" />` : "";

	return html`
		<form class="store-facet" hx-get="/store" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">
			<label class="store-facet__label" for="store-search">Search</label>
			<input class="store-facet__input" id="store-search" type="search" name="q" value="${filters.search ?? ""}" placeholder="Search products…" />
			${filters.categoryId ? html`<input type="hidden" name="category" value="${filters.categoryId}" />` : ""}
			${filters.minRating != null ? html`<input type="hidden" name="rating" value="${String(filters.minRating)}" />` : ""}
			${pricePassThru(filters)}
			${sortHidden}
		</form>

		${categories.length
			? html`<div class="store-facet">
					<p class="store-facet__label">Category</p>
					<ul class="store-cats">
						<li>
							<a class="store-cats__link${filters.categoryId ? "" : " store-cats__link--active"}" href="${storeHref(params, "category", null)}" hx-get="${storeHref(params, "category", null)}" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">All products</a>
						</li>
						${categories.map((c) => {
							const active = filters.categoryId === c.id;
							const href = storeHref(params, "category", active ? null : c.id);
							return html`<li>
								<a class="store-cats__link${active ? " store-cats__link--active" : ""}" href="${href}" hx-get="${href}" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">
									<span>${c.name}</span><span class="store-cats__count">${String(counts.get(c.id) ?? 0)}</span>
								</a>
							</li>`;
						})}
					</ul>
				</div>`
			: ""}

		<form class="store-facet" hx-get="/store" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">
			<p class="store-facet__label">Price ($)</p>
			<div class="store-price">
				<input class="store-facet__input store-price__input" type="text" inputmode="numeric" name="priceMin" value="${filters.minDollars != null ? String(filters.minDollars) : ""}" placeholder="${range.minDollars != null ? String(Math.floor(range.minDollars)) : "Min"}" aria-label="Minimum price" />
				<span class="store-price__sep">–</span>
				<input class="store-facet__input store-price__input" type="text" inputmode="numeric" name="priceMax" value="${filters.maxDollars != null ? String(filters.maxDollars) : ""}" placeholder="${range.maxDollars != null ? String(Math.ceil(range.maxDollars)) : "Max"}" aria-label="Maximum price" />
			</div>
			${filters.search ? html`<input type="hidden" name="q" value="${filters.search}" />` : ""}
			${filters.categoryId ? html`<input type="hidden" name="category" value="${filters.categoryId}" />` : ""}
			${filters.minRating != null ? html`<input type="hidden" name="rating" value="${String(filters.minRating)}" />` : ""}
			${sortHidden}
			<button class="btn btn--ghost btn--sm store-facet__apply" type="submit">Apply</button>
		</form>

		<div class="store-facet">
			<p class="store-facet__label">Rating</p>
			<ul class="store-cats">
				${[4, 3, 2].map((r) => {
					const active = filters.minRating === r;
					const href = storeHref(params, "rating", active ? null : String(r));
					return html`<li>
						<a class="store-cats__link${active ? " store-cats__link--active" : ""}" href="${href}" hx-get="${href}" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">
							<span class="store-stars" aria-label="${`${r} stars and up`}">${stars(r)}</span><span>&amp; up</span>
						</a>
					</li>`;
				})}
			</ul>
		</div>

		${hasFilters ? html`<a class="store-clear" href="/store" hx-get="/store" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">Clear all filters</a>` : ""}`;
}

/** The results region: a count + sort header, then the product card grid (or an
 *  empty state). Lives inside `#store-layout`, which the controls swap in place. */
function storeGrid(items: any[], filters: StoreFilters): Raw {
	const sortControl = html`<form class="store-sort" hx-get="/store" hx-target="#store-layout" hx-swap="outerHTML" hx-push-url="true">
		${filters.search ? html`<input type="hidden" name="q" value="${filters.search}" />` : ""}
		${filters.categoryId ? html`<input type="hidden" name="category" value="${filters.categoryId}" />` : ""}
		${filters.minRating != null ? html`<input type="hidden" name="rating" value="${String(filters.minRating)}" />` : ""}
		${pricePassThru(filters)}
		<label class="store-sort__label" for="store-sort">Sort</label>
		<select class="store-sort__select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
			${(Object.keys(SORT_LABELS) as StoreSort[]).map(
				(s) => html`<option value="${s}"${(filters.sort ?? "featured") === s ? raw(" selected") : ""}>${SORT_LABELS[s]}</option>`,
			)}
		</select>
	</form>`;

	const results = items.length
		? html`<div class="product-grid">${items.map(productCard)}</div>`
		: html`<p class="muted">No products match these filters. <a href="/store">Clear filters →</a></p>`;

	return html`<div class="store-grid">
		<div class="store-grid__head">
			<span class="store-grid__count">${String(items.length)} ${items.length === 1 ? "product" : "products"}</span>
			${sortControl}
		</div>
		${results}
	</div>`;
}

/** A richer product card from `listProductsWithMeta` — cover, badges, star
 *  rating + count, price (with "From" for multi-variant + compare-at strike). */
function productCard(p: any): Raw {
	const img = p.coverImage ?? (Array.isArray(p.images) ? p.images[0] : null);
	const hasReviews = (p.reviewCount ?? 0) > 0;
	return html`<a class="product-card" href="/store/${encodeURIComponent(p.id)}">
		<div class="product-card__media">
			${img ? html`<img class="product-card__img" src="${img}" alt="${p.name ?? "Product"}" loading="lazy" referrerpolicy="no-referrer" />` : html`<div class="product-card__img product-card__img--ph"></div>`}
			<div class="product-card__badges">
				${p.isBestSeller ? html`<span class="product-badge product-badge--amber">Best seller</span>` : ""}
				${p.isNew ? html`<span class="product-badge product-badge--neutral">New</span>` : ""}
				${p.isOnSale ? html`<span class="product-badge product-badge--sale">Sale</span>` : ""}
			</div>
		</div>
		<div class="product-card__body">
			<div class="product-card__name">${p.name ?? "Product"}</div>
			${hasReviews
				? html`<div class="product-card__rating"><span class="product-card__stars" aria-label="${`${Number(p.avgRating ?? 0).toFixed(1)} out of 5`}">${stars(p.avgRating)}</span><span class="product-card__count">(${String(p.reviewCount)})</span></div>`
				: ""}
			<div class="product-card__pricerow">
				${p.cheapestPriceCents != null
					? html`<span class="product-card__price">${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}</span>`
					: html`<span class="product-card__price">—</span>`}
				${p.isOnSale && p.comparePriceCents != null ? html`<span class="product-card__compare">${money(p.comparePriceCents)}</span>` : ""}
			</div>
			${p.isLowStock ? html`<span class="product-card__lowstock">Low stock</span>` : ""}
		</div>
	</a>`;
}

export async function productPage(origin: string, id: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const product = (await bd.storefront.getProduct(id)) as any;
			// Detail extras — each fetched independently and gracefully omitted when
			// empty (or when its endpoint is unavailable on an older BD).
			const [reviews, related, addons] = await Promise.all([
				bd.storefront.getProductReviews(id, { limit: 20 }).catch(() => null),
				bd.storefront.getRelatedProducts(id, { limit: 6 }).catch(() => null),
				bd.storefront.getProductAddons(id).catch(() => null),
			]);

			const images = productImageUrls(product);
			const variants = Array.isArray(product.variants) ? product.variants : [];
			const variantSelect = variants.length
				? html`<select name="variantId" class="product-detail__variant">
						${variants.map((v: any) =>
							html`<option value="${v.id ?? v.variantId ?? ""}">${`${v.title ?? v.name ?? "Variant"}${v.priceCents != null ? ` — ${money(v.priceCents)}` : v.price != null ? ` — ${dollars(v.price, v.currency ?? product.currency)}` : ""}`}</option>`,
						)}
					</select>`
				: "";

			const rev = reviews as any;
			const ratingSummary =
				rev && rev.totalCount > 0
					? html`<div class="product-detail__rating">
							<span class="product-detail__stars" aria-label="${`${Number(rev.avgRating).toFixed(1)} out of 5`}">${stars(rev.avgRating)}</span>
							<span class="product-detail__ratingnum">${Number(rev.avgRating).toFixed(1)} (${String(rev.totalCount)})</span>
						</div>`
					: "";

			body = html`<a class="backlink" href="/store">← Back to store</a>
				<div class="product-detail">
					${images[0] ? html`<img class="product-detail__img" src="${images[0]}" alt="${product.name ?? "Product"}" referrerpolicy="no-referrer" />` : html`<div class="product-detail__img product-detail__img--ph"></div>`}
					<div class="product-detail__body">
						<h1 class="product-detail__name">${product.name ?? "Product"}</h1>
						${ratingSummary}
						${product.description ? html`<p class="product-detail__desc">${product.description}</p>` : ""}
						<form hx-post="/cart/add" hx-target="#add-status" hx-swap="innerHTML">
							<input type="hidden" name="productId" value="${id}" />
							${variantSelect}
							<button class="btn btn--primary" type="submit">Add to cart</button>
						</form>
						<p id="add-status" class="product-detail__status"></p>
					</div>
				</div>
				${addonsRail(addons)}
				${reviewsBlock(rev)}
				${relatedGrid(related)}`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({ origin, title: "Product", body });
}

/** De-duped, ordered image URLs from the product detail (images[] + the
 *  productImages/variantImages record arrays). */
function productImageUrls(product: any): string[] {
	const out: string[] = [];
	const push = (u: unknown) => {
		if (typeof u === "string" && u && !out.includes(u)) out.push(u);
	};
	if (Array.isArray(product.images)) for (const u of product.images) push(u);
	if (Array.isArray(product.productImages)) {
		const sorted = [...product.productImages].sort((a: any, b: any) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
		for (const r of sorted) push(r?.url);
	}
	if (Array.isArray(product.variantImages)) for (const r of product.variantImages) push(r?.url);
	return out;
}

/** Companion / cross-sell addons rail ("complete your purchase"). Omitted when
 *  there are none. */
function addonsRail(addons: any): Raw {
	const items = addons?.items ?? [];
	if (!items.length) return raw("");
	return html`<section class="addons">
		<h2 class="section-title">Complete your purchase</h2>
		<div class="addons-rail">
			${items.map((a: any) => {
				const href = a.addonProductId ? `/store/${encodeURIComponent(a.addonProductId)}` : null;
				const inner = html`${a.imageUrl ? html`<img class="addon-card__img" src="${a.imageUrl}" alt="${a.addonName ?? ""}" loading="lazy" referrerpolicy="no-referrer" />` : html`<div class="addon-card__img addon-card__img--ph"></div>`}
					<div class="addon-card__body">
						${a.groupLabel ? html`<span class="addon-card__group">${a.groupLabel}</span>` : ""}
						<div class="addon-card__name">${a.addonName ?? "Add-on"}</div>
						<div class="addon-card__pricerow">
							${a.priceCents != null ? html`<span class="addon-card__price">${money(a.priceCents)}</span>` : ""}
							${a.originalPriceCents != null && a.originalPriceCents !== a.priceCents ? html`<span class="addon-card__compare">${money(a.originalPriceCents)}</span>` : ""}
						</div>
					</div>`;
				return href
					? html`<a class="addon-card" href="${href}">${inner}</a>`
					: html`<div class="addon-card">${inner}</div>`;
			})}
		</div>
	</section>`;
}

/** Approved reviews list + aggregate. Omitted when there are none. */
function reviewsBlock(rev: any): Raw {
	const items = rev?.items ?? [];
	if (!items.length) return raw("");
	return html`<section class="product-reviews">
		<h2 class="section-title">Reviews</h2>
		<ul class="review-list">
			${items.map((r: any) => {
				const name = r.reviewerName || "Verified buyer";
				const text = r.content || r.body || "";
				return html`<li class="review-card">
					<div class="review-card__head">
						<div class="review-card__who">
							<div class="review-card__name">${name}</div>
							<div class="review-card__stars" aria-label="${`${r.rating} out of 5`}">${stars(r.rating)}</div>
						</div>
					</div>
					${r.title ? html`<p class="review-card__title">${r.title}</p>` : ""}
					${text ? html`<p class="review-card__text">${text}</p>` : ""}
				</li>`;
			})}
		</ul>
	</section>`;
}

/** "You may also like" related grid. Omitted when there are none. */
function relatedGrid(related: any): Raw {
	const items = related?.items ?? [];
	if (!items.length) return raw("");
	return html`<section class="related">
		<h2 class="section-title">You may also like</h2>
		<div class="product-grid">
			${items.map((r: any) => {
				const cover = r.coverImageUrl ?? null;
				const price = Number(r.minPriceDollars);
				return html`<a class="product-card" href="/store/${encodeURIComponent(r.id)}">
					<div class="product-card__media">
						${cover ? html`<img class="product-card__img" src="${cover}" alt="${r.name ?? "Product"}" loading="lazy" referrerpolicy="no-referrer" />` : html`<div class="product-card__img product-card__img--ph"></div>`}
					</div>
					<div class="product-card__body">
						<div class="product-card__name">${r.name ?? "Product"}</div>
						${Number.isFinite(price) ? html`<div class="product-card__pricerow"><span class="product-card__price">${dollars(price)}</span></div>` : ""}
					</div>
				</a>`;
			})}
		</div>
	</section>`;
}

// ── cart ───────────────────────────────────────────────────────────

async function getCartSnap(token: string | null): Promise<any> {
	const bd = getBd();
	const emptyCart = { items: [], itemCount: 0, subtotal: 0, currency: "USD" };
	if (!bd || !token) return emptyCart;
	try {
		return await bd.cart.forVisitor(token).get();
	} catch {
		return emptyCart;
	}
}

export function cartRegion(snap: any): Raw {
	const items = snap?.items ?? [];
	const currency = snap?.currency ?? "USD";
	if (!items.length) {
		return html`<div id="cart-region"><p class="muted">Your cart is empty. <a href="/store">Browse the store →</a></p></div>`;
	}
	return html`<div id="cart-region">
		<ul class="cart-list">${items.map((it: any) => cartItem(it, currency))}</ul>
		${couponRow(snap)}
		<div class="cart-summary">
			<div class="cart-summary__row">
				<span>Subtotal (${snap.itemCount} item${snap.itemCount === 1 ? "" : "s"})</span>
				<strong>${dollars(snap.subtotal, currency)}</strong>
			</div>
		</div>
		<div class="cart-actions">
			<button class="btn btn--ghost" type="button" hx-post="/cart/clear" hx-target="#cart-region" hx-swap="outerHTML">Clear cart</button>
			<form method="post" action="/cart/checkout"><button class="btn btn--primary btn--lg" type="submit">Checkout</button></form>
		</div>
	</div>`;
}

function cartItem(it: any, currency: string): Raw {
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
		<div class="qty">
			<button class="qty__btn" type="button" aria-label="Decrease" hx-post="/cart/update" hx-vals="${dec}" hx-target="#cart-region" hx-swap="outerHTML">−</button>
			<span class="qty__n">${it.quantity}</span>
			<button class="qty__btn" type="button" aria-label="Increase" hx-post="/cart/update" hx-vals="${inc}" hx-target="#cart-region" hx-swap="outerHTML">+</button>
		</div>
		<div class="cart-item__subtotal">${dollars(it.subtotal, it.currency ?? currency)}</div>
		<button class="cart-item__remove" type="button" hx-post="/cart/remove" hx-vals="${rm}" hx-target="#cart-region" hx-swap="outerHTML">Remove</button>
	</li>`;
}

function couponRow(snap: any): Raw {
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

function addStatus(snap: any): Raw {
	return html`<span class="add-ok">Added — cart has ${snap?.itemCount ?? "?"} item(s). <a href="/cart">View cart →</a></span>`;
}

export async function cartPage(origin: string, token: string | null): Promise<string> {
	const snap = await getCartSnap(token);
	return page({
		origin,
		title: "Your cart",
		body: html`<header class="page__head"><h1 class="page__title">Your cart</h1></header>${cartRegion(snap)}`,
	});
}

/** Handle a cart mutation; returns an HTML fragment (+ Set-Cookie when the
 *  visitor token is minted). `op` maps to the SDK cart methods. */
export async function handleCartOp(
	req: Request,
	op: "add" | "update" | "remove" | "coupon" | "coupon-remove" | "clear",
): Promise<{ body: string; setCookie?: string; status?: number }> {
	const bd = getBd();
	if (!bd) return { body: render(errBlock(NOT_CONFIGURED)), status: 503 };
	const form = await req.formData();
	let token = getCookie(req, VISITOR_COOKIE);
	let setCookie: string | undefined;
	if (!token) {
		const r = resolveVisitor(req);
		token = r.token;
		setCookie = r.setCookie;
	}
	const cart = bd.cart.forVisitor(token);
	try {
		if (op === "add") {
			const variantId = form.get("variantId");
			const snap = await cart.addItem({
				productId: String(form.get("productId") ?? ""),
				variantId: variantId ? String(variantId) : undefined,
				quantity: 1,
			});
			return { body: render(addStatus(snap)), setCookie };
		}
		let snap: any;
		if (op === "update") snap = await cart.updateItem(String(form.get("itemId") ?? ""), { quantity: Number(form.get("quantity") ?? 0) });
		else if (op === "remove") snap = await cart.removeItem(String(form.get("itemId") ?? ""));
		else if (op === "coupon") snap = await cart.applyCoupon({ code: String(form.get("code") ?? "") });
		else if (op === "coupon-remove") snap = await cart.removeCoupon();
		else snap = await cart.clear();
		return { body: render(cartRegion(snap)), setCookie };
	} catch (err) {
		return { body: render(errBlock(err)), setCookie };
	}
}

// ── subscriptions ──────────────────────────────────────────────────

export async function subscriptionsPage(origin: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.subscriptions.list()) as any;
			const items = res?.items ?? [];
			body = items.length
				? html`<div class="plan-grid">${items.map(
						(p: any) => html`<div class="plan-card">
							${p.imageUrl ? html`<img class="plan-card__img" src="${p.imageUrl}" alt="${p.name}" />` : ""}
							<h3 class="plan-card__name">${p.name ?? "Plan"}</h3>
							${p.description ? html`<p class="plan-card__desc">${p.description}</p>` : ""}
							<div class="plan-card__price">${money(p.amountCents, p.currency)}<span class="plan-card__interval"> / ${p.interval ?? "month"}</span></div>
						</div>`,
					)}</div>`
				: html`<p class="muted">No subscription plans yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Plans",
		description: "Subscription plans.",
		body: html`<header class="page__head"><h1 class="page__title">Plans</h1></header>${body}`,
	});
}

// ── reviews wall (+ load more) ─────────────────────────────────────

export async function reviewsPage(origin: string): Promise<string> {
	const body = html`<header class="page__head"><h1 class="page__title">Reviews</h1><p class="page__sub">What customers say.</p></header>
		<ul class="review-list" id="review-list">${await reviewItems(0)}</ul>`;
	return page({ origin, title: "Reviews", body });
}

export async function reviewsMore(offset: number): Promise<string> {
	return render(await reviewItems(offset));
}

async function reviewItems(offset: number): Promise<Raw> {
	const bd = getBd();
	if (!bd) return html`<li>${errBlock(NOT_CONFIGURED)}</li>`;
	try {
		const res = (await bd.reviews.list({ limit: 10, offset })) as any;
		const items = res?.items ?? [];
		if (!items.length && offset === 0) return html`<li class="muted">No reviews yet.</li>`;
		const more =
			res?.nextOffset != null
				? html`<li class="review-more" id="review-more"><button class="btn btn--ghost" hx-get="/sections/reviews-more?offset=${String(res.nextOffset)}" hx-target="#review-more" hx-swap="outerHTML">Load more</button></li>`
				: "";
		return html`${items.map(reviewCard)}${more}`;
	} catch (err) {
		return html`<li>${errBlock(err)}</li>`;
	}
}

function reviewCard(r: any): Raw {
	return html`<li class="review-card">
		<div class="review-card__head">
			${r.reviewerImageUrl ? html`<img class="review-card__avatar" src="${r.reviewerImageUrl}" alt="" />` : ""}
			<div class="review-card__who">
				<div class="review-card__name">${r.reviewerName ?? "Anonymous"}</div>
				<div class="review-card__stars" aria-label="${`${r.rating} out of 5`}">${stars(r.rating)}</div>
			</div>
			${r.source ? html`<span class="review-card__source">${r.source}</span>` : ""}
		</div>
		<p class="review-card__text">${r.text ?? ""}</p>
	</li>`;
}

function stars(n: any): string {
	const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}

// ── updates ────────────────────────────────────────────────────────

export async function updatesPage(origin: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			// biome-ignore lint: updates is an untyped bundle passthrough at 0.9.5
			const bundle = (await cached("bundle:home:en", ["bd:marketing"], () =>
				bd.marketing.getPageBundle({ pageKey: "home", locale: "en" }),
			)) as any;
			const items = normalizeUpdates(bundle?.updates);
			body = items.length
				? html`<div class="update-grid">${items.map(updateCard)}</div>`
				: html`<p class="muted">No updates posted yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Updates",
		description: "News, offers, and events.",
		body: html`<header class="page__head"><h1 class="page__title">Updates</h1></header>${body}`,
	});
}

function normalizeUpdates(updates: any): any[] {
	if (!updates) return [];
	if (Array.isArray(updates)) return updates;
	if (Array.isArray(updates.items)) return updates.items;
	if (Array.isArray(updates.posts)) return updates.posts;
	return [];
}

function updateCard(u: any): Raw {
	const img = u.imageUrl ?? u.image ?? (Array.isArray(u.images) ? u.images[0] : null);
	const text = u.text ?? u.body ?? u.summary ?? "";
	const title = u.title ?? (u.kind ? cap(u.kind) : "Update");
	return html`<article class="update-card">
		${img ? html`<img class="update-card__img" src="${img}" alt="" loading="lazy" />` : ""}
		<div class="update-card__body">
			${u.kind ? html`<span class="update-card__kind">${cap(u.kind)}</span>` : ""}
			<h3 class="update-card__title">${title}</h3>
			${text ? html`<p class="update-card__text">${text}</p>` : ""}
			${u.link ? html`<a class="update-card__link" href="${u.link}">Read more →</a>` : ""}
		</div>
	</article>`;
}

function cap(s: any): string {
	const str = String(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── parallel pages (programmatic SEO) ──────────────────────────────

export async function servicesPage(origin: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.parallelPages.listVariants("service-area")) as any;
			const variants = res?.variants ?? res?.items ?? [];
			body = variants.length
				? html`<ul class="variant-list">${variants.map((v: any) => {
						const s = v.slugs ?? v.params ?? v;
						const service = s.service ?? v.service ?? "";
						const area = s.area ?? v.area ?? "";
						const href = v.url ?? `/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`;
						return html`<li><a href="${href}">${v.title ?? `${service} — ${area}`}</a></li>`;
					})}</ul>`
				: html`<p class="muted">No parallel pages generated yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Service areas",
		description: "Programmatic-SEO pages, one per service × area.",
		body: html`<header class="page__head"><h1 class="page__title">Service areas</h1></header>${body}`,
	});
}

export async function serviceAreaPage(origin: string, service: string, area: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	let title = `${service} in ${area}`;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.parallelPages.render("service-area", { service, area })) as any;
			const meta = res?.meta ?? {};
			if (meta.title) title = meta.title;
			const bdy = res?.body;
			body = html`<a class="backlink" href="/services">← All areas</a>
				<h1 class="page__title">${meta.title ?? `${service} in ${area}`}</h1>
				${meta.description ? html`<p class="page__sub">${meta.description}</p>` : ""}
				${typeof bdy === "string" && bdy.trim() ? raw(bdy) : bdy && typeof bdy === "object" ? html`<pre class="parallel-body parallel-body--json">${JSON.stringify(bdy, null, 2)}</pre>` : ""}`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({ origin, title, body });
}

// ── customer portal ────────────────────────────────────────────────

export async function myAccountPage(origin: string, sessionCookie: string | null): Promise<string> {
	const session = await getSession(sessionCookie);
	let body: Raw;
	if (!session) {
		body = html`<header class="page__head"><h1 class="page__title">My account</h1></header>
			<div class="signin-card">
				<p>You're not signed in.</p>
				<div class="signin-card__actions">
					<a class="btn btn--primary" href="/api/bd-auth/sign-in">Sign in</a>
					<a class="btn btn--ghost" href="/api/bd-auth/sign-up">Create account</a>
				</div>
			</div>`;
	} else {
		let work: any = {};
		try {
			work = await portalFor(session).getWork();
		} catch {
			work = {};
		}
		const jobs = work?.jobs ?? work?.items ?? [];
		const u = session.user;
		body = html`<header class="page__head"><h1 class="page__title">My account</h1></header>
			<div class="account-head">
				<p>Signed in as <strong>${u.firstName || u.email || "customer"}</strong></p>
				<a class="btn btn--ghost btn--sm" href="/api/bd-auth/sign-out">Sign out</a>
			</div>
			<h2 class="section-title">Your work</h2>
			${jobs.length
				? html`<ul class="job-list">${jobs.map(
						(j: any) => html`<li class="job-row"><span class="job-row__name">${j.name ?? j.title ?? j.jobName ?? "Job"}</span>${j.status ? html`<span class="job-row__status">${j.status}</span>` : ""}</li>`,
					)}</ul>`
				: html`<p class="muted">${work?.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."}</p>`}
			<section class="review-form">
				<h2 class="section-title">Leave a review</h2>
				<form hx-post="/account/review" hx-target="#review-msg" hx-swap="innerHTML">
					<div class="rf__row">
						<select class="rf__rating" name="rating" aria-label="Rating">
							<option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option>
						</select>
					</div>
					<textarea class="rf__text" name="body" rows="4" placeholder="Tell us about your experience…"></textarea>
					<button class="btn btn--primary" type="submit">Submit review</button>
				</form>
				<p id="review-msg" class="rf__msg"></p>
			</section>`;
	}
	return page({ origin, title: "My account", body });
}

export async function submitReviewFragment(req: Request): Promise<string> {
	const session = await getSession(getCookie(req, SESSION_COOKIE));
	if (!session) return "Please sign in first.";
	const form = await req.formData();
	const text = String(form.get("body") ?? "").trim();
	if (!text) return "Please write a short review first.";
	try {
		const res = (await portalFor(session).submitReview({ rating: Number(form.get("rating") ?? 5), body: text })) as any;
		return res?.status === "pending" ? "Thanks! Your review is pending moderation." : "Thanks for your review!";
	} catch (err) {
		return `Couldn't submit: ${err instanceof Error ? err.message : String(err)}`;
	}
}

// ── todos (custom-collections demo) ────────────────────────────────
//
// The relational custom-collections demo declared in
// `bd.data-model.config.ts`: a `todos` collection plus `todoImages`, whose
// `todo` field is a RELATION back to `todos`.
//
// READ: the SDK's documented custom-database read path —
// `dataModel.listRecords({ object })` — for both collections, joined here.
// Relations come back as LINKS (`relations.todo` on each image is
// `[{ recordId, object }]`, not an embedded row), so the join is: list both
// objects, then group images by the todo record they point at.
//
// WRITE: submitting the generated "Todo Form" (slug `todo-form`) via
// `bd.forms.submit(...)` — forms are the SDK's documented create path for
// custom collections; there is no direct row-write surface.

type TodoImage = { url: string; alt: string | null; label: string | null };
type TodoItem = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	images: TodoImage[];
};

function asOptionalText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

async function readTodos(): Promise<
	{ available: true; todos: TodoItem[] } | { available: false; reason: string }
> {
	const dataModel = getBdDataModel();
	if (!dataModel) {
		return { available: false, reason: "BD isn't configured — see .env.example." };
	}
	const [todosRes, imagesRes] = await Promise.all([
		dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
		dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
	]);
	if (!todosRes.available || !imagesRes.available) {
		return {
			available: false,
			reason:
				"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
		};
	}
	// Group images by the todo each one's RELATION field links to.
	const imagesByTodo = new Map<string, TodoImage[]>();
	for (const record of imagesRes.records) {
		const url = record.fields["url"];
		if (typeof url !== "string" || url.length === 0) continue;
		const image: TodoImage = {
			url,
			alt: asOptionalText(record.fields["alt"]),
			label: asOptionalText(record.fields["label"]),
		};
		for (const link of record.relations["todo"] ?? []) {
			const bucket = imagesByTodo.get(link.recordId) ?? [];
			bucket.push(image);
			imagesByTodo.set(link.recordId, bucket);
		}
	}
	return {
		available: true,
		todos: todosRes.records.map((record) => ({
			id: record.id,
			title: typeof record.fields["title"] === "string" ? record.fields["title"] : "(untitled)",
			done: record.fields["done"] === true,
			notes: asOptionalText(record.fields["notes"]),
			images: imagesByTodo.get(record.id) ?? [],
		})),
	};
}

function todoCard(todo: TodoItem): Raw {
	return html`<li class="card todo-item">
		<div class="todo-item__head">
			<span>${todo.done ? "✓" : "○"}</span>
			<strong class="${todo.done ? "todo-item__title todo-item__title--done" : "todo-item__title"}">${todo.title}</strong>
		</div>
		${todo.notes ? html`<p class="muted">${todo.notes}</p>` : ""}
		${
			todo.images.length
				? html`<div class="todo-item__images">${todo.images.map(
						(image) =>
							html`<figure class="todo-item__figure">
								<img class="todo-item__img" src="${image.url}" alt="${image.alt ?? image.label ?? todo.title}" loading="lazy" width="112" height="112" style="object-fit:cover;border-radius:0.5rem;" />
								${image.label ? html`<figcaption>${image.label}</figcaption>` : ""}
							</figure>`,
					)}</div>`
				: ""
		}
	</li>`;
}

/** The swappable region: create form + list. `hx-post` re-renders it whole. */
async function todosRegion(message?: { text: string; error: boolean }): Promise<Raw> {
	let listBlock: Raw;
	try {
		const result = await readTodos();
		if (!result.available) listBlock = html`<p class="muted">${result.reason}</p>`;
		else if (result.todos.length === 0)
			listBlock = html`<p class="muted">No todos yet — add the first one.</p>`;
		else
			listBlock = html`<ul class="todo-list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1rem;">${result.todos.map(todoCard)}</ul>`;
	} catch (err) {
		listBlock = errBlock(err);
	}
	return html`<div id="todos-region">
		<form class="card todo-form" hx-post="/todos" hx-target="#todos-region" hx-swap="outerHTML" style="display:flex;flex-direction:column;gap:0.5rem;padding:1.25rem;margin-bottom:1.5rem;">
			<label for="todo-title"><strong>Title</strong></label>
			<input id="todo-title" name="title" placeholder="What needs doing?" required />
			<label for="todo-notes"><strong>Notes (optional)</strong></label>
			<textarea id="todo-notes" name="notes" rows="2"></textarea>
			<button class="btn btn--primary" type="submit">Add todo</button>
			${message ? html`<p class="${message.error ? "error" : "muted"}">${message.text}</p>` : ""}
		</form>
		${listBlock}
	</div>`;
}

export async function todosPage(origin: string): Promise<string> {
	return page({
		origin,
		title: "Todos",
		description:
			"A relational custom-collections demo — todos and their images live in your BD custom database.",
		body: html`<header class="page__head">
				<h1 class="page__title">Todos</h1>
				<p class="muted">
					A relational custom-collections demo — todos and their images live in
					your BD custom database.
				</p>
			</header>
			${await todosRegion()}`,
	});
}

/** POST /todos — create via the generated "Todo Form", re-render the region. */
export async function todosCreateFragment(req: Request): Promise<string> {
	const bd = getBd();
	if (!bd) {
		return render(await todosRegion({ text: "BD isn't configured — see .env.example.", error: true }));
	}
	const form = await req.formData();
	const title = String(form.get("title") ?? "").trim();
	const notes = String(form.get("notes") ?? "").trim();
	if (!title) {
		return render(await todosRegion({ text: "Title is required.", error: true }));
	}
	// Keyed by each field's output key — `validateFormSubmission` accepts
	// output keys (preferred) or legacy field ids.
	const result = await bd.forms.submit(TODO_FORM_SLUG, {
		title,
		...(notes ? { notes } : {}),
	});
	if (!result.ok) {
		const text =
			result.reason === "not_found"
				? `Couldn't add that todo — is the generated "Todo Form" Live?`
				: result.message;
		return render(await todosRegion({ text, error: true }));
	}
	return render(await todosRegion({ text: "Added.", error: false }));
}
