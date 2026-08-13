/** /reviews — public review wall with "load more" (offset pagination). */
import { biab, el } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

const PAGE = 10;

export default async function render(root) {
	root.replaceChildren(pageHead("Reviews", "What customers say."));
	const count = el("p", { class: "review-count muted" }, []);
	const list = el("ul", { class: "review-list" }, []);
	const moreWrap = el("div", { class: "review-more" }, []);
	root.append(count, list, moreWrap);

	let offset = 0;
	async function load() {
		moreWrap.replaceChildren(el("span", { class: "muted" }, ["Loading…"]));
		try {
			const res = await biab.reviews.list({ limit: PAGE, offset });
			for (const r of res?.items ?? []) list.append(reviewCard(r));
			if (typeof res?.totalCount === "number") {
				count.textContent = `${res.totalCount} review${res.totalCount === 1 ? "" : "s"}`;
			}
			if (res?.nextOffset != null) {
				offset = res.nextOffset;
				moreWrap.replaceChildren(
					el("button", { class: "btn btn--ghost", type: "button", onClick: load }, ["Load more"]),
				);
			} else {
				moreWrap.replaceChildren();
				if (!list.children.length) list.append(el("li", { class: "muted" }, ["No reviews yet."]));
			}
		} catch (err) {
			moreWrap.replaceChildren(errBox(err));
		}
	}
	load();
}

function reviewCard(r) {
	return el("li", { class: "review-card" }, [
		el("div", { class: "review-card__head" }, [
			r.reviewerImageUrl ? el("img", { class: "review-card__avatar", src: r.reviewerImageUrl, alt: "" }) : null,
			el("div", { class: "review-card__who" }, [
				el("div", { class: "review-card__name" }, [r.reviewerName ?? "Anonymous"]),
				el("div", { class: "review-card__stars", "aria-label": `${r.rating} out of 5` }, [stars(r.rating)]),
			]),
			r.source ? el("span", { class: "review-card__source" }, [r.source]) : null,
		]),
		el("p", { class: "review-card__text" }, [r.text ?? ""]),
	]);
}

function stars(n) {
	const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}
