import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../components/biab/Footer";
import { SiteHeader } from "../../components/biab/SiteHeader";
import { getBiab } from "../../lib/biab";
import { getUpdatesFromBundle } from "../../lib/biab-content";
import { getCustomerSession } from "../../lib/biab-portal";

/**
 * News / Updates feed. `bundle.updates` is a Google-Business-style posts feed
 * that rides the marketing bundle as an untyped passthrough at 0.9.5; we read
 * it defensively via `getUpdatesFromBundle`.
 */
export const useUpdates = routeLoader$(async ({ cookie }) => {
	const biab = getBiab();
	const session = await getCustomerSession(cookie);
	if (!biab) {
		return { configured: false, items: [], signedIn: !!session };
	}
	const bundle = await biab.marketing
		.getPageBundle({ pageKey: "home", locale: "en" })
		.catch(() => null);
	return {
		configured: true,
		items: getUpdatesFromBundle(bundle),
		signedIn: !!session,
	};
});

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

export default component$(() => {
	const data = useUpdates();

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main>
				<section class="biab-section biab-section--narrow">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">News</span>
						<h2 class="biab-section__title">Updates</h2>
						<p class="biab-section__sub">
							Recent posts, synced from the business profile via the BIAB
							marketing bundle.
						</p>
					</div>

					{!data.value.configured ? (
						<div class="biab-empty">
							Updates aren't connected yet. Set the BIAB env vars to pull them
							in.
						</div>
					) : data.value.items.length === 0 ? (
						<div class="biab-empty">No updates posted yet.</div>
					) : (
						<div style="display: flex; flex-direction: column; gap: 1.25rem;">
							{data.value.items.map((u) => (
								<article class="biab-card" style="padding: 1.5rem;" key={u.id}>
									{u.imageUrl ? (
										<img
											alt={u.title ?? "Update"}
											src={u.imageUrl}
											style="border-radius: 0.75rem; margin-bottom: 1rem; aspect-ratio: 16/9; object-fit: cover;"
										/>
									) : null}
									{u.title ? <h3>{u.title}</h3> : null}
									<p style="margin-top: 0.5rem; white-space: pre-line;">
										{u.body}
									</p>
									<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
										<span style="color: var(--text-muted); font-size: 0.8rem;">
											{formatDate(u.postedAt)}
										</span>
										{u.link ? (
											<a class="biab-btn biab-btn--ghost" href={u.link}>
												Learn more
											</a>
										) : null}
									</div>
								</article>
							))}
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Updates — Your Business",
	meta: [{ name: "description", content: "News and updates feed." }],
};
