// [bd-file:store]
"use client";

import type { ComponentProps } from "react";

import { ProductDetail } from "@/app/_components/bd/shop/ProductDetail";

import { announceCartCount } from "../_components/StoreNav";

/**
 * The shared product page, with the store bar's cart count kept in step:
 * a server component can hand over the add-to-cart server action, but not
 * a plain function, so this client wrapper adds that one.
 */
export function ProductPageClient(
	props: Omit<ComponentProps<typeof ProductDetail>, "onCartCount">,
) {
	return <ProductDetail {...props} onCartCount={announceCartCount} />;
}
