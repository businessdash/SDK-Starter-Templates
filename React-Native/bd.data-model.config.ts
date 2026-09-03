/**
 * BD starter — custom-database data model (Todos demo).
 *
 * Two related collections declared with the 0.9.50+ `collection()` + `bd`
 * schema builders: `todos`, plus `todoImages` whose `todo` field is a
 * RELATION back to `todos`. Your data model is code from here on:
 *
 *   1. Run the `sync-data-model` package script — it pushes this model (plus
 *      the auto-generated "Todo Form" draft) to BD's draft slot. Nothing
 *      changes until a human promotes it in the dashboard.
 *   2. Activate the generated create form — promotion creates it INACTIVE.
 *      Find "Todo Form" (slug `todo-form`) under the dashboard's Forms
 *      surface and set it Live.
 *   3. Open `/todos` in this app — it lists rows (relations included) via
 *      `createBdApiClient(...).site(id).dataModel.listRecords({ object })`
 *      and creates rows by submitting the generated form. Those are the SDK's
 *      documented read/write paths for custom collections — direct row writes
 *      aren't a consumer surface (`sync-records` seeds from the CLI; forms
 *      create at runtime).
 *
 * Reading records needs the `metadata:read_records` scope on your secret key
 * plus the org's custom-objects entitlement — the page degrades to a notice
 * when either is missing.
 */

import { bd, createFormSchemaOrchestrator } from "@businessdash/sdk";
import { collection } from "@businessdash/sdk/collections";

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

export const todoImages = collection("todoImages", {
	labelIdentifierFieldName: "url",
	description:
		"Starter demo — images attached to a todo via a RELATION field.",
	fields: {
		todo: bd
			.relation()
			.references("todos")
			.onDelete("CASCADE")
			.required(),
		url: bd.text().formElement("url").required().helper("Where the image lives."),
		alt: bd
			.text()
			.formElement("short_text")
			.optional()
			.helper("Accessible description."),
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
 * collection names), so importing them here beats hardcoding UUIDs.
 */
export const TODOS_OBJECT_ID = todos.universalIdentifier;
export const TODO_IMAGES_OBJECT_ID = todoImages.universalIdentifier;

/** Slug of the generated create form (`<singular>-form`) — the write path. */
export const TODO_FORM_SLUG = "todo-form";

export default createFormSchemaOrchestrator([todos, todoImages], {
	defaultIdType: "uuid",
});
