import { createFileRoute } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { getSiteContentExtras } from "../lib/biab-server-fns";

/**
 * News / updates feed. Google-Business-style posts ride the marketing
 * bundle as `bundle.updates`; the loader extracts them. No-ops to a
 * friendly empty state when unconfigured or unseeded.
 */
export const Route = createFileRoute("/updates")({
	component: Updates,
	loader: () => getSiteContentExtras(),
});

function formatDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function Updates() {
	const data = Route.useLoaderData();
	const updates = () => data().updates;

	return (
		<main>
			<section class="biab-section biab-section--narrow">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Latest</span>
					<h1 class="biab-section__title">Updates</h1>
					<p class="biab-section__sub">
						News and announcements, synced from the business's Google profile.
					</p>
				</div>

				<Show
					when={updates().length > 0}
					fallback={
						<div class="biab-empty">
							No updates posted yet. Check back soon.
						</div>
					}
				>
					<div style="display: flex; flex-direction: column; gap: 1.25rem;">
						<For each={updates()}>
							{(post) => (
								<article
									class="biab-card"
									style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;"
								>
									<Show when={post.imageUrl}>
										<img
											src={post.imageUrl ?? ""}
											alt={post.title ?? "Update"}
											style="aspect-ratio: 16/9; object-fit: cover; border-radius: 0.6rem; margin-bottom: 0.5rem;"
										/>
									</Show>
									<Show when={post.title}>
										<h3 style="font-size: 1.1rem;">{post.title}</h3>
									</Show>
									<Show when={post.postedAt}>
										<div class="blog-card__meta">
											{formatDate(post.postedAt)}
										</div>
									</Show>
									<p style="white-space: pre-wrap;">{post.body}</p>
									<Show when={post.link}>
										<a
											href={post.link ?? "#"}
											target="_blank"
											rel="noreferrer"
											class="biab-btn biab-btn--ghost"
											style="align-self: flex-start; margin-top: 0.5rem;"
										>
											Learn more
										</a>
									</Show>
								</article>
							)}
						</For>
					</div>
				</Show>
			</section>
		</main>
	);
}
