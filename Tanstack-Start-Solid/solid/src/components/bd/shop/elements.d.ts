// [bd-file:store]
/**
 * The shop's custom elements (src/lib/shop/shop-elements.ts) as JSX tags.
 * Their settings are data-* attributes, which every tag already takes.
 */
import type { JSX } from "@solidjs/web/jsx-runtime";

type BdElement = JSX.HTMLAttributes<HTMLElement> & { compact?: boolean };

declare module "@solidjs/web/jsx-runtime" {
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
