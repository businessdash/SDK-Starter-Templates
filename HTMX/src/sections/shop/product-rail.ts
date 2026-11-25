// [bd-file:store]
import { html, type Raw } from "../../html";
import { formatCents, type SavedProduct } from "../../shop/shop";

/** A row of small product cards: related products. */
export function productRail(title: string, products: SavedProduct[], { storeHref = "/store" } = {}): Raw {
	if (products.length === 0) return html``;
	return html`<section class="product-rail">
		<h2 class="product-rail__title">${title}</h2>
		<ul class="product-rail__row">${products.map(
			(product) =>
				html`<li><a class="bd-card product-rail__card" href="${`${storeHref}/${encodeURIComponent(product.id)}`}">${
					product.image
						? html`<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${product.image}" />`
						: html`<span aria-hidden="true" class="product-rail__noimg"></span>`
				}<span class="product-rail__name">${product.name}</span>${
					product.priceCents != null ? html`<span class="product-rail__price">${formatCents(product.priceCents)}</span>` : ""
				}</a></li>`,
		)}</ul>
	</section>`;
}
