import Link from "next/link";

/**
 * The 404.
 *
 * Deliberately static — no BusinessDash call, no data fetch, nothing that can
 * fail. This is the page most likely to be rendered while something else is
 * broken, so it must not depend on the thing that is broken. A 404 that itself
 * errors turns a wrong URL into a blank screen.
 */
export default function NotFound() {
	return (
		<main className="bd-section bd-section--narrow">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">404</span>
				<h1 className="bd-section__title">We couldn&apos;t find that page</h1>
				<p className="bd-section__sub">
					The link may be out of date, or the page may have moved.
				</p>
			</div>
			<p>
				<Link href="/">Back to the homepage</Link>
			</p>
		</main>
	);
}
