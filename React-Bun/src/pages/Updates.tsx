import { bd } from "../lib/bd";
import type { Loose } from "../lib/bd";
import { ErrorBox, PageHead, useApi } from "./ui";

function normalize(updates: Loose | null | undefined): Record<string, any>[] {
	if (!updates) return [];
	if (Array.isArray(updates)) return updates;
	if (Array.isArray(updates.items)) return updates.items;
	if (Array.isArray(updates.posts)) return updates.posts;
	return [];
}

function cap(s: any): string {
	const str = String(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function Updates() {
	const { data, error, loading } = useApi(() => bd.content.extras());
	const items = normalize(data?.updates);
	return (
		<main className="page">
			<PageHead title="Updates" sub="News, offers, and events." />
			{loading ? <p className="muted">Loading…</p> : null}
			{error ? <ErrorBox error={error} /> : null}
			{data && items.length === 0 ? <p className="muted">No updates posted yet.</p> : null}
			{items.length > 0 ? (
				<div className="update-grid">
					{items.map((u, i) => {
						const img = u.imageUrl ?? u.image ?? (Array.isArray(u.images) ? u.images[0] : null);
						const text = u.text ?? u.body ?? u.summary ?? "";
						const title = u.title ?? (u.kind ? cap(u.kind) : "Update");
						return (
							<article key={u.id ?? i} className="update-card">
								{img ? <img className="update-card__img" src={img} alt="" loading="lazy" /> : null}
								<div className="update-card__body">
									{u.kind ? <span className="update-card__kind">{cap(u.kind)}</span> : null}
									<h3 className="update-card__title">{title}</h3>
									{text ? <p className="update-card__text">{text}</p> : null}
									{u.link ? (
										<a className="update-card__link" href={u.link}>
											Read more →
										</a>
									) : null}
								</div>
							</article>
						);
					})}
				</div>
			) : null}
		</main>
	);
}
