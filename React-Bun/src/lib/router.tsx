/**
 * Tiny dependency-free client router. The Bun server's SPA fallback serves
 * index.html for any unknown GET path, so `pushState` navigation just works.
 * It tracks the query string too, so a page can keep its filters in the URL
 * (`?category=…&sort=…`) and a filtered view can be shared.
 */
import { useEffect, useMemo, useState } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Ctx, type RouteContext, useRoute } from "./route";

function here() {
	return { path: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }: { children: ReactNode }) {
	const [location, setLocation] = useState(here);
	useEffect(() => {
		const onPop = () => setLocation(here());
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);
	const value = useMemo<RouteContext>(
		() => ({
			...location,
			navigate(to, { replace = false, scroll = true } = {}) {
				const url = new URL(to, window.location.href);
				const next = url.pathname + url.search;
				if (next === window.location.pathname + window.location.search && !url.hash) return;
				window.history[replace ? "replaceState" : "pushState"]({}, "", next + url.hash);
				setLocation({ path: url.pathname, search: url.search });
				if (url.hash) {
					// After the new page renders, bring the anchor into view.
					const id = decodeURIComponent(url.hash.slice(1));
					requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
				} else if (scroll) {
					window.scrollTo(0, 0);
				}
			},
		}),
		[location],
	);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

type LinkProps = {
	to: string;
	children: ReactNode;
	/** Keep the scroll position (for links that only change a filter). */
	keepScroll?: boolean;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

/** SPA link. Falls back to a normal navigation for external URLs, server
 *  routes (`/api/*`), and modified clicks. */
export function Link({ to, children, onClick, keepScroll = false, ...rest }: LinkProps) {
	const { navigate } = useRoute();
	return (
		<a
			href={to}
			onClick={(e) => {
				onClick?.(e);
				if (e.defaultPrevented) return;
				if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
				if (to.startsWith("http") || to.startsWith("/api/") || to.startsWith("#")) return;
				e.preventDefault();
				navigate(to, { scroll: !keepScroll });
			}}
			{...rest}
		>
			{children}
		</a>
	);
}
