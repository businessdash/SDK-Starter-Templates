import { createBdApiClient } from "@businessdash/sdk";

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
} from "../../../bd.data-model.config";

/**
 * GET /api/bd/todos
 *
 * Reads the Todos demo's two custom collections through the SDK's documented
 * custom-database READ path — `dataModel.listRecords({ object })` — and joins
 * them here. Relations come back as LINKS (`relations.todo` on each image is
 * `[{ recordId, object }]`, not an embedded row), so the join is: list both
 * objects, then group images by the todo record they point at.
 *
 * Needs `metadata:read_records` on the secret key + the org's custom-objects
 * entitlement; both objects stay `private` (default), so ONLY this server can
 * read them. Degrades to `{ available: false }` so the page can render a
 * setup notice instead of crashing.
 */

export type TodoImage = { url: string; alt: string | null; label: string | null };

export type TodoItem = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	createdAt: string;
	images: TodoImage[];
};

export type TodosPayload = {
	available: boolean;
	reason: string | null;
	todos: TodoItem[];
};

function asOptionalText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export default defineEventHandler(async (): Promise<TodosPayload> => {
	const cfg = getBdBaseConfig();
	if (!cfg) {
		return {
			available: false,
			reason: "BD isn't configured — see .env.example.",
			todos: [],
		};
	}

	const dataModel = createBdApiClient({
		apiKey: cfg.apiKey,
		baseUrl: cfg.baseUrl,
	})
		.site(cfg.siteId)
		.dataModel;

	try {
		const [todosRes, imagesRes] = await Promise.all([
			dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
			dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
		]);
		if (!todosRes.available || !imagesRes.available) {
			return {
				available: false,
				reason:
					"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
				todos: [],
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
			reason: null,
			todos: todosRes.records.map((record) => ({
				id: record.id,
				title: typeof record.fields["title"] === "string" ? record.fields["title"] : "(untitled)",
				done: record.fields["done"] === true,
				notes: asOptionalText(record.fields["notes"]),
				createdAt: String(record.createdAt),
				images: imagesByTodo.get(record.id) ?? [],
			})),
		};
	} catch (err) {
		return {
			available: false,
			reason: err instanceof Error ? err.message : "Couldn't read todos.",
			todos: [],
		};
	}
});
