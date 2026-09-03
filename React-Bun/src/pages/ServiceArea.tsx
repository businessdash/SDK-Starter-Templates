import { bd } from "../lib/bd";
import { Link } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

export function ServiceArea() {
	const segs = window.location.pathname.split("/").filter(Boolean); // services / :service / :area
	const service = decodeURIComponent(segs[1] ?? "");
	const area = decodeURIComponent(segs[2] ?? "");
	const { data, error, loading } = useApi(() => bd.parallelPages.render("service-area", { service, area }), [service, area]);

	if (loading)
		return (
			<main className="page">
				<p className="muted">Loading…</p>
			</main>
		);
	if (error || !data)
		return (
			<main className="page">
				<ErrorBox error={error} />
			</main>
		);

	const meta = data.meta ?? {};
	const body = data.body;
	return (
		<main className="page">
			<Link className="backlink" to="/services">
				← All areas
			</Link>
			<h1 className="page__title">{meta.title ?? `${service} in ${area}`}</h1>
			{meta.description ? <p className="page__sub">{meta.description}</p> : null}
			{typeof body === "string" ? (
				// Server-rendered (token-resolved) HTML from BD — trusted.
				<div className="parallel-body" dangerouslySetInnerHTML={{ __html: body }} />
			) : body && typeof body === "object" ? (
				<pre className="parallel-body parallel-body--json">{JSON.stringify(body, null, 2)}</pre>
			) : null}
		</main>
	);
}
