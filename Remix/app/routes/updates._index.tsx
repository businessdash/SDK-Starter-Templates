import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import {
	getMarketingBundle,
	getUpdatesFromBundle,
} from "~/lib/biab-bundle.server";
import { isServiceSuspended } from "~/lib/biab.server";

export const meta: MetaFunction = () => [{ title: "Updates — Your Business" }];

export async function loader(_: LoaderFunctionArgs) {
	try {
		const bundle = await getMarketingBundle();
		const updates = getUpdatesFromBundle(bundle);
		return {
			suspended: false,
			updates: updates.map((u) => ({
				id: u.id,
				title: u.title,
				body: u.body,
				link: u.link,
				image: u.imageUrl,
				postedAt: u.postedAt,
			})),
		};
	} catch (err) {
		if (isServiceSuspended(err)) return { suspended: true, updates: [] };
		throw err;
	}
}

export default function UpdatesPage() {
	const { suspended, updates } = useLoaderData<typeof loader>();
	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">News &amp; updates</h1>
					{suspended ? (
						<p className="muted">Temporarily unavailable. Please check back soon.</p>
					) : updates.length === 0 ? (
						<p className="muted">
							No updates yet — posts from your Google Business profile appear here.
						</p>
					) : (
						<ul className="post-list">
							{updates.map((u) => (
								<li key={u.id}>
									{u.image ? (
										<img className="card__img" src={u.image} alt={u.title ?? ""} />
									) : null}
									{u.title ? <strong>{u.title}</strong> : null}
									<p>{u.body}</p>
									{u.link ? (
										<a className="muted" href={u.link} target="_blank" rel="noreferrer">
											Learn more →
										</a>
									) : null}
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</>
	);
}
