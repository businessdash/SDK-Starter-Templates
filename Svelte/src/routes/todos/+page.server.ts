import { fail } from "@sveltejs/kit";
import { createBdApiClient } from "@businessdash/sdk";

import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { bd } from "$lib/server/bd";

import type { Actions, PageServerLoad } from "./$types";

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
	TODO_FORM_SLUG,
} from "../../../bd.data-model.config";

/**
 * Todos — the relational custom-collections demo (`bd.data-model.config.ts`).
 *
 * READ (load): the SDK's documented custom-database read path —
 * `dataModel.listRecords({ object })` — for both collections, joined here.
 * Relations come back as LINKS (`relations.todo` on each image is
 * `[{ recordId, object }]`, not an embedded row), so the join is: list both
 * objects, then group images by the todo record they point at.
 *
 * WRITE (action): submitting the generated "Todo Form" (slug `todo-form`)
 * via `bd.forms.submit(...)` — forms are the SDK's documented create path
 * for custom collections; there is no direct row-write surface.
 *
 * Needs `metadata:read_records` on the secret key + the org's custom-objects
 * entitlement; both objects stay `private` (default), so only this server
 * can read them.
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

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

function getDataModel() {
	const apiKey = env.BD_API_KEY;
	const siteId = publicEnv.PUBLIC_BD_SITE_ID ?? env.BD_SITE_ID;
	const rawBaseUrl =
		publicEnv.PUBLIC_BD_PACKAGE_API_BASE_URL ?? env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !rawBaseUrl) return null;
	return createBdApiClient({ apiKey, baseUrl: normalizeBaseUrl(rawBaseUrl) })
		.site(siteId)
		.dataModel;
}

function asOptionalText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export const load: PageServerLoad = async () => {
	const dataModel = getDataModel();
	if (!dataModel) {
		return {
			available: false as const,
			reason: "BD isn't configured — see .env.example.",
			todos: [] as TodoItem[],
		};
	}

	try {
		const [todosRes, imagesRes] = await Promise.all([
			dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
			dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
		]);
		if (!todosRes.available || !imagesRes.available) {
			return {
				available: false as const,
				reason:
					"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
				todos: [] as TodoItem[],
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
			available: true as const,
			reason: null,
			todos: todosRes.records.map(
				(record): TodoItem => ({
					id: record.id,
					title:
						typeof record.fields["title"] === "string"
							? record.fields["title"]
							: "(untitled)",
					done: record.fields["done"] === true,
					notes: asOptionalText(record.fields["notes"]),
					createdAt: String(record.createdAt),
					images: imagesByTodo.get(record.id) ?? [],
				}),
			),
		};
	} catch (err) {
		return {
			available: false as const,
			reason: err instanceof Error ? err.message : "Couldn't read todos.",
			todos: [] as TodoItem[],
		};
	}
};

export const actions: Actions = {
	/** Create a todo by submitting the generated "Todo Form". */
	default: async ({ request }) => {
		if (!bd) {
			return fail(503, { message: "BD isn't configured — see .env.example." });
		}
		const form = await request.formData();
		const title = String(form.get("title") ?? "").trim();
		const notes = String(form.get("notes") ?? "").trim();
		if (!title) {
			return fail(400, { message: "Title is required." });
		}
		// Keyed by each field's output key — `validateFormSubmission` accepts
		// output keys (preferred) or legacy field ids.
		const result = await bd.forms.submit(TODO_FORM_SLUG, {
			title,
			...(notes ? { notes } : {}),
		});
		if (!result.ok) {
			return fail(result.status >= 400 ? result.status : 400, {
				message:
					result.reason === "not_found"
						? 'Couldn\'t add that todo — is the generated "Todo Form" Live?'
						: result.message,
			});
		}
		return { added: true as const };
	},
};
