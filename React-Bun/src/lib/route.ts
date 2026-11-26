/** The router's state and its hooks; `router.tsx` has the provider and `Link`. */
import { createContext, useContext, useMemo } from "react";

type NavigateOptions = {
	/** Replace the current history entry instead of adding one. */
	replace?: boolean;
	/** Scroll to the top after navigating (default true). */
	scroll?: boolean;
};

export type RouteContext = {
	path: string;
	/** The query string, with its `?` (or ""). */
	search: string;
	navigate: (to: string, options?: NavigateOptions) => void;
};

export const Ctx = createContext<RouteContext>({ path: "/", search: "", navigate: () => {} });

export function useRoute() {
	return useContext(Ctx);
}

/** The current query string, parsed. */
export function useSearchParams(): URLSearchParams {
	const { search } = useRoute();
	return useMemo(() => new URLSearchParams(search), [search]);
}
