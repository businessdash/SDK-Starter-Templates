// [bd-file:store]
import { html, type Raw } from "../../html";

/** "Only 3 left", at five or fewer. */
export function stockNote(stock: number | null): Raw {
	const low = stock != null && stock > 0 && stock <= 5;
	return html`<p class="product-detail__stock" data-bd-stock${low ? "" : html` hidden`}>${low ? `Only ${stock} left` : ""}</p>`;
}
