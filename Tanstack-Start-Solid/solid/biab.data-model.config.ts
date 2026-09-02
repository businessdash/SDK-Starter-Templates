/**
 * BIAB starter — custom-database data model (relational Todos demo).
 *
 * Two collections — `todos` and `todoImages` (images point at a todo via a
 * required RELATION field) — declared with the 0.9.50+ `collection()` + `bd`
 * schema builders. Your data model is code from here on:
 *
 *   1. `pnpm sync-data-model` — pushes this model (plus the auto-generated
 *      create-form drafts) to BIAB's draft slot. Nothing changes until a human
 *      promotes it in the dashboard.
 *   2. Activate the generated create form — promotion creates it INACTIVE.
 *      Find "Todo Form" (slug `todo-form`) under the dashboard's Forms surface
 *      and set it Live.
 *   3. Open `/todos` in this app — it lists rows (images joined onto their
 *      todo) via `dataModel.listRecords({ object })` and creates rows by
 *      submitting the generated form. Those are the SDK's documented
 *      read/write paths for custom collections: reads go through the
 *      data-model client, writes go through forms — there is no direct
 *      row-write API for consumers.
 *
 * Reading records needs the `metadata:read_records` scope on your secret key
 * plus the org's custom-objects entitlement — the page degrades to a notice
 * when either is missing.
 */

import { bd, createFormSchemaOrchestrator } from "@businessdash/sdk";
import { collection } from "@businessdash/sdk/collections";

/** A minimal todo list — one row per task. */
export const todos = collection("todos", {
	labelIdentifierFieldName: "title",
	description:
		"Starter demo — a minimal todo list in the org's custom database.",
	fields: {
		title: bd
			.text()
			.formElement("short_text")
			.required()
			.helper("What needs doing."),
		done: bd
			.boolean()
			.formElement("yes_no_toggle")
			.default(false)
			.helper("Flip on when it's finished."),
		notes: bd
			.text()
			.formElement("long_text")
			.optional()
			.helper("Optional details."),
	},
});

/** Images attached to a todo — demonstrates a required RELATION field. */
export const todoImages = collection("todoImages", {
	labelIdentifierFieldName: "url",
	description: "Starter demo — images attached to a todo.",
	fields: {
		todo: bd
			.relation()
			.references("todos")
			.required()
			.helper("The todo this image belongs to."),
		url: bd.text().formElement("short_text").required().helper("Image URL."),
		alt: bd
			.text()
			.formElement("short_text")
			.optional()
			.helper("Alt text for screen readers."),
		label: bd
			.text()
			.formElement("short_text")
			.optional()
			.helper("Short caption."),
	},
});

/**
 * Stable identities of the two objects — the `object` values
 * `dataModel.listRecords` expects. They're deterministic (derived from the
 * collection name), so importing them here beats hardcoding UUIDs.
 */
export const TODOS_OBJECT_ID = todos.universalIdentifier;
export const TODO_IMAGES_OBJECT_ID = todoImages.universalIdentifier;

/** Slug of the generated create form (`<singular>-form`) — the write path. */
export const TODO_FORM_SLUG = "todo-form";

export default createFormSchemaOrchestrator([todos, todoImages], {
	defaultIdType: "uuid",
});
