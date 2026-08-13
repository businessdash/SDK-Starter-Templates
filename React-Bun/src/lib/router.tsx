/**
 * Tiny dependency-free client router. The Bun server's SPA fallback serves
 * index.html for any unknown GET path, so `pushState` navigation just works.
 */
import { createContext, useContext, useEffect, useState } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type RouteContext = { path: string; navigate: (to: string) => void };

const Ctx = createContext<RouteContext>({ path: "/", navigate: () => {} });

export function RouterProvider({ children }: { children: ReactNode }) {
	const [path, setPath] = useState(() => window.location.pathname);
	useEffect(() => {
		const onPop = () => setPath(window.location.pathname);
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);
	const navigate = (to: string) => {
		if (to === window.location.pathname) return;
		window.history.pushState({}, "", to);
		setPath(to);
		window.scrollTo(0, 0);
	};
	return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}

export function useRoute() {
	return useContext(Ctx);
}

type LinkProps = { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>;

/** SPA link. Falls back to a normal navigation for external URLs, server
 *  routes (`/api/*`), and modified clicks. */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
	const { navigate } = useRoute();
	return (
		<a
			href={to}
			onClick={(e) => {
				onClick?.(e);
				if (e.defaultPrevented) return;
				if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
				if (to.startsWith("http") || to.startsWith("/api/")) return;
				e.preventDefault();
				navigate(to);
			}}
			{...rest}
		>
			{children}
		</a>
	);
}
