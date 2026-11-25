import type { AnchorHTMLAttributes } from "react";
import { Link } from "react-router";

/**
 * The link the shared shop, blog and review components use. Here it's React
 * Router's `Link`, so moving between pages stays client-side; another
 * framework swaps in its own link and the components stay the same.
 */
export function BdLink({
	href,
	...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
	return <Link to={href} {...rest} />;
}
