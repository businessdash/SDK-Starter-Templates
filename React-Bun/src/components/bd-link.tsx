import type { AnchorHTMLAttributes } from "react";

import { Link } from "../lib/router";

/**
 * The link the shared shop, blog and review components use. Here it's this
 * app's router `Link`, so moving between pages stays client-side; another
 * framework swaps in its own link and the components stay the same.
 */
export function BdLink({
	href,
	children,
	...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
	return (
		<Link to={href} {...rest}>
			{children}
		</Link>
	);
}
