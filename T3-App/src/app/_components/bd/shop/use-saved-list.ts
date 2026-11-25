// [bd-file:store]
"use client";
import { useEffect, useState } from "react";
import type { SavedList, SavedProduct } from "./shop";

/**
 * The items of a saved list (wishlist, compare, recently viewed), kept in
 * step with every change, in this tab or another. Empty until the page is in
 * the browser, since the lists live in localStorage.
 */
export function useSavedList(list: SavedList): {
	items: SavedProduct[];
	ready: boolean;
} {
	const [items, setItems] = useState<SavedProduct[]>([]);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		setItems(list.read());
		setReady(true);
		return list.subscribe(setItems);
	}, [list]);
	return { items, ready };
}
