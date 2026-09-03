import type { BundleUpdateItem } from "@/server/lib/bd";

/**
 * News / Updates feed — Google-Business-style posts delivered via
 * `bundle.updates`. Renders nothing when the org has no cached posts (so the
 * home page just skips the section rather than showing an empty block).
 */

function formatDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

export function Updates({ items }: { items: BundleUpdateItem[] }) {
	if (items.length === 0) return null;

	return (
		<section className="bd-section" id="updates">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">News</span>
				<h2 className="bd-section__title">Latest updates</h2>
				<p className="bd-section__sub">
					Fresh from our Google Business profile, synced through BD.
				</p>
			</div>
			<div className="bd-grid-3">
				{items.map((u) => {
					const image = u.imageUrl ?? u.images[0] ?? null;
					return (
						<UpdateCard
							body={u.body}
							date={u.postedAt ? formatDate(u.postedAt) : null}
							image={image}
							key={u.id}
							link={u.link}
							title={u.title}
						/>
					);
				})}
			</div>
		</section>
	);
}

function UpdateCard({
	image,
	date,
	title,
	body,
	link,
}: {
	image: string | null;
	date: string | null;
	title: string | null;
	body: string;
	link: string | null;
}) {
	const card = (
		<article className="bd-card update-card">
			{image ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					alt={title ?? "Update"}
					className="update-card__img"
					loading="lazy"
					src={image}
				/>
			) : null}
			<div className="update-card__body">
				{date ? <span className="update-card__date">{date}</span> : null}
				{title ? <h3>{title}</h3> : null}
				<p>{body}</p>
			</div>
		</article>
	);
	return link ? (
		<a href={link} rel="noreferrer" target="_blank">
			{card}
		</a>
	) : (
		card
	);
}
