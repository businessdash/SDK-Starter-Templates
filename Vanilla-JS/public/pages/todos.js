/**
 * /todos — the relational custom-collections demo (`bd.data-model.config.ts`).
 *
 * READ: `bd.todos.list()` → `GET /api/bd/todos`, which lists both
 * collections via the SDK's `dataModel.listRecords({ object })` and joins
 * images to todos through the `todo` RELATION field.
 * WRITE: `bd.forms.submit("todo-form", …)` — submitting the generated
 * "Todo Form" is the SDK's documented create path for custom collections;
 * there is no direct row-write surface.
 */
import { bd, el, empty } from "/bd.js";
import { errBox, pageHead } from "./_ui.js";

/** Slug of the generated create form — see TODO_FORM_SLUG in
 *  `bd.data-model.config.ts` (kept as a literal here; the schema config is
 *  server/CLI code and never ships to the browser). */
const TODO_FORM_SLUG = "todo-form";

export default async function render(root) {
	root.replaceChildren(
		pageHead(
			"Todos",
			"A relational custom-collections demo — todos and their images live in your BD custom database.",
		),
	);

	const listRegion = el("div", { class: "todo-list-region" }, []);
	root.append(createForm(listRegion), listRegion);
	await renderList(listRegion);
}

function createForm(listRegion) {
	const msg = el("p", { class: "muted" }, []);
	const titleInput = el("input", {
		id: "todo-title",
		name: "title",
		placeholder: "What needs doing?",
		required: true,
	});
	const notesInput = el("textarea", { id: "todo-notes", name: "notes", rows: 2 });
	const button = el("button", { class: "btn btn--primary", type: "submit" }, ["Add todo"]);

	const form = el(
		"form",
		{
			class: "card todo-form",
			style:
				"display:flex;flex-direction:column;gap:0.5rem;padding:1.25rem;margin-bottom:1.5rem;",
			onsubmit: async (event) => {
				event.preventDefault();
				const title = titleInput.value.trim();
				if (!title) return;
				button.disabled = true;
				button.textContent = "Adding…";
				msg.textContent = "";
				try {
					// Keyed by each field's output key — the server-side
					// `validateFormSubmission` accepts output keys (preferred)
					// or legacy field ids.
					const notes = notesInput.value.trim();
					const result = await bd.forms.submit(TODO_FORM_SLUG, {
						title,
						...(notes ? { notes } : {}),
					});
					if (result && result.ok === false) {
						msg.textContent =
							result.reason === "not_found"
								? `Couldn't add that todo — is the generated "Todo Form" Live?`
								: result.message || "Couldn't add that todo.";
					} else {
						titleInput.value = "";
						notesInput.value = "";
						msg.textContent = "Added.";
						await renderList(listRegion);
					}
				} catch (err) {
					msg.textContent = String((err && err.message) || "Couldn't add that todo.");
				} finally {
					button.disabled = false;
					button.textContent = "Add todo";
				}
			},
		},
		[
			el("label", { for: "todo-title" }, [el("strong", {}, ["Title"])]),
			titleInput,
			el("label", { for: "todo-notes" }, [el("strong", {}, ["Notes (optional)"])]),
			notesInput,
			button,
			msg,
		],
	);
	return form;
}

async function renderList(region) {
	region.replaceChildren();
	try {
		const payload = await bd.todos.list();
		if (!payload.available) {
			region.append(
				empty(
					payload.reason ||
						"Todos aren't readable yet — sync + promote bd.data-model.config.ts and check your key's scopes.",
				),
			);
			return;
		}
		if (!payload.todos.length) {
			region.append(empty("No todos yet — add the first one."));
			return;
		}
		region.append(
			el(
				"ul",
				{
					class: "todo-list",
					style:
						"list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1rem;",
				},
				payload.todos.map(todoCard),
			),
		);
	} catch (err) {
		region.append(errBox(err));
	}
}

function todoCard(todo) {
	return el("li", { class: "card todo-item", style: "padding:1.25rem;" }, [
		el("div", { style: "display:flex;align-items:baseline;gap:0.5rem;" }, [
			el("span", {}, [todo.done ? "✓" : "○"]),
			el(
				"strong",
				todo.done ? { style: "text-decoration:line-through;opacity:0.6;" } : {},
				[todo.title],
			),
		]),
		todo.notes ? el("p", { class: "muted" }, [todo.notes]) : null,
		todo.images.length
			? el(
					"div",
					{ style: "display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:0.75rem;" },
					todo.images.map((image) =>
						el("figure", { style: "margin:0;" }, [
							el("img", {
								src: image.url,
								alt: image.alt || image.label || todo.title,
								loading: "lazy",
								width: 112,
								height: 112,
								style: "object-fit:cover;border-radius:0.5rem;",
							}),
							image.label ? el("figcaption", {}, [image.label]) : null,
						]),
					),
				)
			: null,
	]);
}
