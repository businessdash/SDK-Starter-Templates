// [bd-file:store]
import { html, type Raw } from "../../html";

/** − and + around how many to add, from 1 up to what's in stock (`max`). */
export function quantityStepper({ max, quantity = 1 }: { max: number | null; quantity?: number }): Raw {
	return html`<div aria-label="Quantity" class="qty" role="group"><button aria-label="One fewer" data-bd-qty="-1"${quantity <= 1 ? html` disabled` : ""} type="button">−</button><span aria-live="polite" data-bd-qty-value>${String(quantity)}</span><button aria-label="One more" data-bd-qty="1"${max != null && quantity >= max ? html` disabled` : ""} type="button">+</button></div>`;
}
