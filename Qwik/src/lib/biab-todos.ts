/**
 * Read side of the todos demo — the org's CUSTOM DATABASE, reached through the
 * `BiabDevClient`'s `dataModel.listRecords`. That's a different surface (and a
 * different scope: `metadata:read_records`) from the marketing/content reads in
 * `biab.ts`, so it gets its own tiny module. Server-only — import it from
 * `routeLoader$` / `server$` bodies exactly like `getBiab`.
 *
 * Relations come back as LINKS (`{ recordId, object }`), not embedded rows —
 * so we fetch both collections and join each image onto its todo here.
 *
 * The object ids are imported from `biab.data-model.config.ts` (they're
 * deterministic), so the page and the pushed model can never drift apart.
 */

import { createBiabDevClient } from "@businessdash/sdk";

import {
	TODO_IMAGES_OBJECT_ID,
	TODOS_OBJECT_ID,
} from "../../biab.data-model.config";

export type TodoImage = {
	id: string;
	url: string;
	alt: string | null;
	label: string | null;
};

export type TodoWithImages = {
	id: string;
	title: string;
	done: boolean;
	notes: string | null;
	createdAt: string;
	images: TodoImage[];
};

export type TodosResult =
	| { status: "unconfigured" }
	/** Plan gate, missing `metadata:read_records` scope, or model not promoted. */
	| { status: "unavailable" }
	| { status: "ok"; todos: TodoWithImages[] };

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cachedDev:
	| { client: ReturnType<typeof createBiabDevClient>; siteId: string }
	| null
	| undefined;

function getBiabDev(): {
	client: ReturnType<typeof createBiabDevClient>;
	siteId: string;
} | null {
	if (cachedDev !== undefined) return cachedDev;
	const apiKey = process.env.BIAB_API_KEY;
	const siteId = process.env.PUBLIC_BIAB_SITE_ID ?? process.env.BIAB_SITE_ID;
	const baseUrl =
		process.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
		process.env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		cachedDev = null;
		return cachedDev;
	}
	cachedDev = {
		client: createBiabDevClient({
			apiKey,
			baseUrl: normalizeBaseUrl(baseUrl),
		}),
		siteId,
	};
	return cachedDev;
}

/**
 * One page of todos, newest first, with their images joined on. Any read
 * failure (403 scope, 404 unpromoted model, network) collapses to
 * `"unavailable"` — the page renders a setup notice instead of crashing.
 */
export async function listTodosWithImages(): Promise<TodosResult> {
	const dev = getBiabDev();
	if (!dev) return { status: "unconfigured" };

	try {
		const site = dev.client.site(dev.siteId);
		const [todosPage, imagesPage] = await Promise.all([
			site.dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
			site.dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
		]);
		if (!todosPage.available || !imagesPage.available) {
			return { status: "unavailable" };
		}

		const imagesByTodo = new Map<string, TodoImage[]>();
		for (const record of imagesPage.records) {
			// `relations.todo` is always present ([] when unlinked); a reference
			// holds at most one target.
			const link = record.relations.todo?.[0];
			if (!link) continue;
			const list = imagesByTodo.get(link.recordId) ?? [];
			list.push({
				id: record.id,
				url: typeof record.fields.url === "string" ? record.fields.url : "",
				alt: typeof record.fields.alt === "string" ? record.fields.alt : null,
				label:
					typeof record.fields.label === "string" ? record.fields.label : null,
			});
			imagesByTodo.set(link.recordId, list);
		}

		return {
			status: "ok",
			todos: todosPage.records.map((record) => ({
				id: record.id,
				title:
					typeof record.fields.title === "string"
						? record.fields.title
						: "Untitled",
				done: record.fields.done === true,
				notes:
					typeof record.fields.notes === "string" ? record.fields.notes : null,
				createdAt: record.createdAt,
				images: imagesByTodo.get(record.id) ?? [],
			})),
		};
	} catch (err) {
		if (process.env.NODE_ENV === "development") {
			const reason = err instanceof Error ? err.message : String(err);
			console.warn(`[biab] dataModel.listRecords failed: ${reason}`);
		}
		return { status: "unavailable" };
	}
}
