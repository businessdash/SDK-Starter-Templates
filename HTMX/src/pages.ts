/**
 * Server-rendered feature pages + HTMX fragments (subscriptions / reviews /
 * updates / my-account / services / todos). Each renderer returns an HTML
 * string; "load more" and form posts return fragments the browser swaps in.
 * The store and the cart are in ./store-pages, the blog in ./blog-pages.
 *
 * Response shapes are read defensively — the SDK keeps several surfaces
 * loose/passthrough at 0.9.5.
 */

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
	TODO_FORM_SLUG,
} from "../bd.data-model.config";
import { getBd, getBdDataModel, getSession, portalFor } from "./bd";
import { cached } from "./cache";
import { html, raw, render, type Raw } from "./html";
import { signInSection } from "./sign-in";
import {
	SESSION_COOKIE,
	errBlock,
	getCookie,
	// [bd:subscriptions]
	money,
	// [/bd:subscriptions]
	page,
} from "./layout";
// [bd:subscriptions]
import { STORE_NAV_MODULES, storeNav } from "./store-nav";
// [/bd:subscriptions]

const NOT_CONFIGURED = new Error("BD not configured");

// [bd:subscriptions]
// ── subscriptions ──────────────────────────────────────────────────

export async function subscriptionsPage(origin: string, visitorToken: string | null): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.subscriptions.list()) as any;
			const items = res?.items ?? [];
			body = items.length
				? html`<div class="plan-grid">${items.map(
						(p: any) => html`<div class="plan-card">
							${p.imageUrl ? html`<img class="plan-card__img" src="${p.imageUrl}" alt="${p.name}" />` : ""}
							<h3 class="plan-card__name">${p.name ?? "Plan"}</h3>
							${p.description ? html`<p class="plan-card__desc">${p.description}</p>` : ""}
							<div class="plan-card__price">${money(p.amountCents, p.currency)}<span class="plan-card__interval"> / ${p.interval ?? "month"}</span></div>
						</div>`,
					)}</div>`
				: html`<p class="muted">No subscription plans yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Plans",
		description: "Subscription plans.",
		modules: STORE_NAV_MODULES,
		subnav: await storeNav(visitorToken),
		body: html`<header class="page__head"><h1 class="page__title">Plans</h1></header>${body}`,
	});
}
// [/bd:subscriptions]

// ── updates ────────────────────────────────────────────────────────

export async function updatesPage(origin: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			// biome-ignore lint: updates is an untyped bundle passthrough at 0.9.5
			const bundle = (await cached("bundle:home:en", ["bd:marketing"], () =>
				bd.marketing.getPageBundle({ pageKey: "home", locale: "en" }),
			)) as any;
			const items = normalizeUpdates(bundle?.updates);
			body = items.length
				? html`<div class="update-grid">${items.map(updateCard)}</div>`
				: html`<p class="muted">No updates posted yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Updates",
		description: "News, offers, and events.",
		body: html`<header class="page__head"><h1 class="page__title">Updates</h1></header>${body}`,
	});
}

function normalizeUpdates(updates: any): any[] {
	if (!updates) return [];
	if (Array.isArray(updates)) return updates;
	if (Array.isArray(updates.items)) return updates.items;
	if (Array.isArray(updates.posts)) return updates.posts;
	return [];
}

function updateCard(u: any): Raw {
	const img = u.imageUrl ?? u.image ?? (Array.isArray(u.images) ? u.images[0] : null);
	const text = u.text ?? u.body ?? u.summary ?? "";
	const title = u.title ?? (u.kind ? cap(u.kind) : "Update");
	return html`<article class="update-card">
		${img ? html`<img class="update-card__img" src="${img}" alt="" loading="lazy" />` : ""}
		<div class="update-card__body">
			${u.kind ? html`<span class="update-card__kind">${cap(u.kind)}</span>` : ""}
			<h3 class="update-card__title">${title}</h3>
			${text ? html`<p class="update-card__text">${text}</p>` : ""}
			${u.link ? html`<a class="update-card__link" href="${u.link}">Read more →</a>` : ""}
		</div>
	</article>`;
}

function cap(s: any): string {
	const str = String(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── parallel pages (programmatic SEO) ──────────────────────────────

export async function servicesPage(origin: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.parallelPages.listVariants("service-area")) as any;
			const variants = res?.variants ?? res?.items ?? [];
			body = variants.length
				? html`<ul class="variant-list">${variants.map((v: any) => {
						const s = v.slugs ?? v.params ?? v;
						const service = s.service ?? v.service ?? "";
						const area = s.area ?? v.area ?? "";
						const href = v.url ?? `/services/${encodeURIComponent(service)}/${encodeURIComponent(area)}`;
						return html`<li><a href="${href}">${v.title ?? `${service} — ${area}`}</a></li>`;
					})}</ul>`
				: html`<p class="muted">No parallel pages generated yet.</p>`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin,
		title: "Service areas",
		description: "Programmatic-SEO pages, one per service × area.",
		body: html`<header class="page__head"><h1 class="page__title">Service areas</h1></header>${body}`,
	});
}

export async function serviceAreaPage(origin: string, service: string, area: string): Promise<string> {
	const bd = getBd();
	let body: Raw;
	let title = `${service} in ${area}`;
	if (!bd) body = errBlock(NOT_CONFIGURED);
	else {
		try {
			const res = (await bd.parallelPages.render("service-area", { service, area })) as any;
			const meta = res?.meta ?? {};
			if (meta.title) title = meta.title;
			const bdy = res?.body;
			body = html`<a class="backlink" href="/services">← All areas</a>
				<h1 class="page__title">${meta.title ?? `${service} in ${area}`}</h1>
				${meta.description ? html`<p class="page__sub">${meta.description}</p>` : ""}
				${typeof bdy === "string" && bdy.trim() ? raw(bdy) : bdy && typeof bdy === "object" ? html`<pre class="parallel-body parallel-body--json">${JSON.stringify(bdy, null, 2)}</pre>` : ""}`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({ origin, title, body });
}

// ── customer portal ────────────────────────────────────────────────

/** /my-account with the sign-in screen in it — also a no-script form post's answer. */
export function signInPage(origin: string, section: Raw): Promise<string> {
	return page({
		origin,
		title: "My account",
		body: html`<header class="page__head"><h1 class="page__title">My account</h1></header>${section}`,
	});
}

export async function myAccountPage(url: URL, sessionCookie: string | null): Promise<string> {
	const origin = url.origin;
	const session = await getSession(sessionCookie);
	let body: Raw;
	if (!session) {
		// The business's own sign-in screen (name, logo and brand colours from
		// BD), rendered here: password, emailed codes, and "Continue with
		// Google / Apple / GitHub / Discord" — WorkOS underneath, through
		// /api/bd-auth, which sets the session cookie. See src/sign-in.ts.
		return signInPage(origin, await signInSection(origin, url));
	} else {
		let work: any = {};
		try {
			work = await portalFor(session).getWork();
		} catch {
			work = {};
		}
		const jobs = work?.jobs ?? work?.items ?? [];
		const u = session.user;
		body = html`<header class="page__head"><h1 class="page__title">My account</h1></header>
			<div class="account-head">
				<p>Signed in as <strong>${u.firstName || u.email || "customer"}</strong></p>
				<a class="btn btn--ghost btn--sm" href="/api/bd-auth/sign-out">Sign out</a>
			</div>
			<h2 class="section-title">Your work</h2>
			${jobs.length
				? html`<ul class="job-list">${jobs.map(
						(j: any) => html`<li class="job-row"><span class="job-row__name">${j.name ?? j.title ?? j.jobName ?? "Job"}</span>${j.status ? html`<span class="job-row__status">${j.status}</span>` : ""}</li>`,
					)}</ul>`
				: html`<p class="muted">${work?.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."}</p>`}
			<section class="review-form">
				<h2 class="section-title">Leave a review</h2>
				<form hx-post="/account/review" hx-target="#review-msg" hx-swap="innerHTML">
					<div class="rf__row">
						<select class="rf__rating" name="rating" aria-label="Rating">
							<option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option>
						</select>
					</div>
					<textarea class="rf__text" name="body" rows="4" placeholder="Tell us about your experience…"></textarea>
					<button class="btn btn--primary" type="submit">Submit review</button>
				</form>
				<p id="review-msg" class="rf__msg"></p>
			</section>
			<p class="muted"><a href="/api/bd-auth/delete-account">Delete my account</a></p>`;
	}
	return page({ origin, title: "My account", body });
}

export async function submitReviewFragment(req: Request): Promise<string> {
	const session = await getSession(getCookie(req, SESSION_COOKIE));
	if (!session) return "Please sign in first.";
	const form = await req.formData();
	const text = String(form.get("body") ?? "").trim();
	if (!text) return "Please write a short review first.";
	try {
		const res = (await portalFor(session).submitReview({ rating: Number(form.get("rating") ?? 5), body: text })) as any;
		return res?.status === "pending" ? "Thanks! Your review is pending moderation." : "Thanks for your review!";
	} catch (err) {
		return `Couldn't submit: ${err instanceof Error ? err.message : String(err)}`;
	}
}

// ── todos (custom-collections demo) ────────────────────────────────
//
// The relational custom-collections demo declared in
// `bd.data-model.config.ts`: a `todos` collection plus `todoImages`, whose
// `todo` field is a RELATION back to `todos`.
//
// READ: the SDK's documented custom-database read path —
// `dataModel.listRecords({ object })` — for both collections, joined here.
// Relations come back as LINKS (`relations.todo` on each image is
// `[{ recordId, object }]`, not an embedded row), so the join is: list both
// objects, then group images by the todo record they point at.
//
// WRITE: submitting the generated "Todo Form" (slug `todo-form`) via
// `bd.forms.submit(...)` — forms are the SDK's documented create path for
// custom collections; there is no direct row-write surface.

type TodoImage = { url: string; alt: string | null; label: string | null };
type TodoItem = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	images: TodoImage[];
};

function asOptionalText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

async function readTodos(): Promise<
	{ available: true; todos: TodoItem[] } | { available: false; reason: string }
> {
	const dataModel = getBdDataModel();
	if (!dataModel) {
		return { available: false, reason: "BD isn't configured — see .env.example." };
	}
	const [todosRes, imagesRes] = await Promise.all([
		dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
		dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
	]);
	if (!todosRes.available || !imagesRes.available) {
		return {
			available: false,
			reason:
				"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
		};
	}
	// Group images by the todo each one's RELATION field links to.
	const imagesByTodo = new Map<string, TodoImage[]>();
	for (const record of imagesRes.records) {
		const url = record.fields["url"];
		if (typeof url !== "string" || url.length === 0) continue;
		const image: TodoImage = {
			url,
			alt: asOptionalText(record.fields["alt"]),
			label: asOptionalText(record.fields["label"]),
		};
		for (const link of record.relations["todo"] ?? []) {
			const bucket = imagesByTodo.get(link.recordId) ?? [];
			bucket.push(image);
			imagesByTodo.set(link.recordId, bucket);
		}
	}
	return {
		available: true,
		todos: todosRes.records.map((record) => ({
			id: record.id,
			title: typeof record.fields["title"] === "string" ? record.fields["title"] : "(untitled)",
			done: record.fields["done"] === true,
			notes: asOptionalText(record.fields["notes"]),
			images: imagesByTodo.get(record.id) ?? [],
		})),
	};
}

function todoCard(todo: TodoItem): Raw {
	return html`<li class="card todo-item">
		<div class="todo-item__head">
			<span>${todo.done ? "✓" : "○"}</span>
			<strong class="${todo.done ? "todo-item__title todo-item__title--done" : "todo-item__title"}">${todo.title}</strong>
		</div>
		${todo.notes ? html`<p class="muted">${todo.notes}</p>` : ""}
		${
			todo.images.length
				? html`<div class="todo-item__images">${todo.images.map(
						(image) =>
							html`<figure class="todo-item__figure">
								<img class="todo-item__img" src="${image.url}" alt="${image.alt ?? image.label ?? todo.title}" loading="lazy" width="112" height="112" style="object-fit:cover;border-radius:0.5rem;" />
								${image.label ? html`<figcaption>${image.label}</figcaption>` : ""}
							</figure>`,
					)}</div>`
				: ""
		}
	</li>`;
}

/** The swappable region: create form + list. `hx-post` re-renders it whole. */
async function todosRegion(message?: { text: string; error: boolean }): Promise<Raw> {
	let listBlock: Raw;
	try {
		const result = await readTodos();
		if (!result.available) listBlock = html`<p class="muted">${result.reason}</p>`;
		else if (result.todos.length === 0)
			listBlock = html`<p class="muted">No todos yet — add the first one.</p>`;
		else
			listBlock = html`<ul class="todo-list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1rem;">${result.todos.map(todoCard)}</ul>`;
	} catch (err) {
		listBlock = errBlock(err);
	}
	return html`<div id="todos-region">
		<form class="card todo-form" hx-post="/todos" hx-target="#todos-region" hx-swap="outerHTML" style="display:flex;flex-direction:column;gap:0.5rem;padding:1.25rem;margin-bottom:1.5rem;">
			<label for="todo-title"><strong>Title</strong></label>
			<input id="todo-title" name="title" placeholder="What needs doing?" required />
			<label for="todo-notes"><strong>Notes (optional)</strong></label>
			<textarea id="todo-notes" name="notes" rows="2"></textarea>
			<button class="btn btn--primary" type="submit">Add todo</button>
			${message ? html`<p class="${message.error ? "error" : "muted"}">${message.text}</p>` : ""}
		</form>
		${listBlock}
	</div>`;
}

export async function todosPage(origin: string): Promise<string> {
	return page({
		origin,
		title: "Todos",
		description:
			"A relational custom-collections demo — todos and their images live in your BD custom database.",
		body: html`<header class="page__head">
				<h1 class="page__title">Todos</h1>
				<p class="muted">
					A relational custom-collections demo — todos and their images live in
					your BD custom database.
				</p>
			</header>
			${await todosRegion()}`,
	});
}

/** POST /todos — create via the generated "Todo Form", re-render the region. */
export async function todosCreateFragment(req: Request): Promise<string> {
	const bd = getBd();
	if (!bd) {
		return render(await todosRegion({ text: "BD isn't configured — see .env.example.", error: true }));
	}
	const form = await req.formData();
	const title = String(form.get("title") ?? "").trim();
	const notes = String(form.get("notes") ?? "").trim();
	if (!title) {
		return render(await todosRegion({ text: "Title is required.", error: true }));
	}
	// Keyed by each field's output key — `validateFormSubmission` accepts
	// output keys (preferred) or legacy field ids.
	const result = await bd.forms.submit(TODO_FORM_SLUG, {
		title,
		...(notes ? { notes } : {}),
	});
	if (!result.ok) {
		const text =
			result.reason === "not_found"
				? `Couldn't add that todo — is the generated "Todo Form" Live?`
				: result.message;
		return render(await todosRegion({ text, error: true }));
	}
	return render(await todosRegion({ text: "Added.", error: false }));
}
