import { bd } from "../lib/bd";
import { Link } from "../lib/router";
import { ErrorBox, PageHead, useApi } from "./ui";

export function ServiceAreas() {
	const { data, error, loading } = useApi(() => bd.parallelPages.listVariants("service-area"));
	const variants: Record<string, any>[] = data?.variants ?? data?.items ?? [];
	return (
		<main className="page">
			<PageHead title="Service areas" sub="Programmatic-SEO pages, one per service × area." />
			{loading ? <p className="muted">Loading…</p> : null}
			{error ? <ErrorBox error={error} /> : null}
			{data && variants.length === 0 ? <p className="muted">No parallel pages generated yet.</p> : null}
			{variants.length > 0 ? (
				<ul className="variant-list">
					{variants.map((v, i) => {
						const s = v.slugs ?? v.params ?? v;
						const service = s.service ?? v.service ?? "";
						const area = s.area ?? v.area ?? "";
						const href = v.url ?? `/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`;
						return (
							<li key={i}>
								<Link to={href}>{v.title ?? `${service} — ${area}`}</Link>
							</li>
						);
					})}
				</ul>
			) : null}
		</main>
	);
}
