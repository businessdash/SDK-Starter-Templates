// [bd-file:store]
import { useEffect, useState } from "react";
import type { SavedList, SavedProduct } from "./shop";

/**
 * The items of a saved list (wishlist, compare, recently viewed), kept in
 * step with every change, in this tab or another. The lists live in
 * localStorage, which this browser-only app can read from the start.
 */
export function useSavedList(list: SavedList): {
	items: SavedProduct[];
	ready: boolean;
} {
	const [items, setItems] = useState<SavedProduct[]>(() => list.read());
	useEffect(() => list.subscribe(setItems), [list]);
	return { items, ready: true };
}
