// [bd-file:store]
/**
 * The shop's custom elements (src/lib/shop/shop-elements.ts) as JSX tags.
 * Solid sets a custom element's props as properties; the parts write
 * `attr:data-…` so their settings land as attributes, which is what the
 * elements read.
 */
import type { JSX } from "solid-js";

type BdElement = JSX.HTMLAttributes<HTMLElement> & { "attr:compact"?: string };

declare module "solid-js" {
	namespace JSX {
		interface IntrinsicElements {
			"bd-gallery": BdElement;
			"bd-product-form": BdElement;
			"bd-share": BdElement;
			"bd-addon": BdElement;
			"bd-recently-viewed": BdElement;
			"bd-save-buttons": BdElement;
			"bd-compare-bar": BdElement;
		}
	}
}
