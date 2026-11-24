/**
 * BusinessDash forms, rendered on this server — the HTMX way.
 *
 * The same forms every BD starter renders (`<BdForm>`, Swift's `BdForm`,
 * Kotlin's `BdForm`, Flutter's `BdForm`), driven by the same engine: each
 * request runs the SDK's own form controller (`@businessdash/sdk/forms`) over
 * what the browser posted, and this file turns its snapshot into HTML. So the
 * rules — required fields, conditions, steps, calculations, the checks BD runs
 * again on submit — are the web form's, not a second copy of them.
 *
 * How it behaves in the browser:
 *   • a change to any field (leaving a text box, picking a choice) re-renders
 *     the form, so conditional fields appear, calculations update and a box
 *     marked wrong clears once it's right;
 *   • Next checks the step, Back and the step dots move between steps, and
 *     Submit checks everything and sends it to BD with the server's key;
 *   • it all works without JavaScript too, as plain form posts.
 *
 * Every step is in the page (the ones you're not on are hidden), so values
 * travel with each post and nothing is kept on the server between requests —
 * except a picked file, which waits here until Submit uploads it (like the web
 * form, an abandoned form never leaves a file behind on BD).
 */

import {
	type BdFormsClient,
	type CollectionOptionsState,
	collectionSelectLayout,
	concurrentRevealCount,
	createFormController,
	evalCondition,
	type FormCoreField,
	type FormFileValue,
	type FormSchema,
	type FormSnapshot,
	formatCalcValue,
	IDLE_COLLECTION_OPTIONS,
	isPendingFileValue,
	pickedCollectionValues,
	resolveFieldAutocomplete,
} from "@businessdash/sdk/forms";

import { getBd } from "./bd";
import demoFormJson from "./forms/demo-form.json";
import { html, raw, render, type Raw } from "./html";

/** The bundled sample form: what `/forms/demo` shows, and the contact section before BD is connected. */
export const DEMO_FORM_SLUG = "demo";
const DEMO_FORM = {
	...(demoFormJson as unknown as FormSchema),
	description:
		"A sample form bundled with the starter, checked here and never sent. Set BD_CONTACT_FORM and your BD keys to show one of your own.",
} as FormSchema;

// ── Where a form comes from ─────────────────────────────────────────

const SCHEMA_TTL_MS = 60_000;
const schemas = new Map<string, { at: number; schema: FormSchema }>();

/** The form's schema: the bundled sample, or BD's (cached for a minute). */
export async function loadFormSchema(slug: string): Promise<FormSchema> {
	if (slug === DEMO_FORM_SLUG) return DEMO_FORM;
	const bd = getBd();
	if (!bd) throw new Error("BD isn't configured (BD_API_KEY / BD_SITE_ID / BD_PACKAGE_API_BASE_URL).");
	const hit = schemas.get(slug);
	if (hit && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.schema;
	const schema = await bd.forms.schema(slug);
	schemas.set(slug, { at: Date.now(), schema });
	return schema;
}

/** The sample's stand-in for BD: everything checks, nothing is sent. */
const demoClient: BdFormsClient = {
	forms: {
		schema: async () => DEMO_FORM,
		submit: async (slug) => ({ ok: true, status: 200, submissionId: null, slug, dryRun: true }),
		uploadFile: async (_slug, _fieldId, file, opts) => ({
			storageId: `demo-${crypto.randomUUID()}`,
			url: "",
			name: opts?.filename ?? "file",
			mimeType: (file as Blob).type || "application/octet-stream",
			size: (file as Blob).size,
		}),
	},
};

function clientFor(slug: string): BdFormsClient {
	if (slug === DEMO_FORM_SLUG) return demoClient;
	const bd = getBd();
	if (!bd) throw new Error("BD isn't configured.");
	return bd as unknown as BdFormsClient;
}

// ── Picked files, held until Submit ─────────────────────────────────

const FILE_TTL_MS = 60 * 60 * 1000;
const MAX_HELD_FILES = 200;
const heldFiles = new Map<string, { file: File; at: number }>();

function holdFile(file: File): string {
	const now = Date.now();
	for (const [token, held] of heldFiles) {
		if (now - held.at > FILE_TTL_MS || heldFiles.size >= MAX_HELD_FILES) heldFiles.delete(token);
	}
	const token = crypto.randomUUID();
	heldFiles.set(token, { file, at: now });
	return token;
}

/** A picked file in a field's value: the controller's `PendingFileValue`, plus our token. */
type HeldFile = { pending: true; file: File; name: string; size: number; token: string };

// ── Field keys and names ────────────────────────────────────────────
//
// Every value-bearing field posts under `f.<key>`, where the key is its id, or
// `<repeater key>.<row>.<child id>` inside a repeater. Composite fields add a
// part (`f.<key>.first`). `f.<key>.~` marks a field as rendered, so "nothing
// ticked" reads as empty rather than "not on the page".

const name = (key: string, part?: string) => `f.${key}${part ? `.${part}` : ""}`;
const idFor = (formId: string, key: string, part?: string) =>
	`bd-${formId}-${key}${part ? `-${part}` : ""}`.replace(/[^A-Za-z0-9_-]/g, "-");

const LAYOUT_TYPES = new Set(["input_group", "condition_block", "or_condition", "flex_row"]);
const STATIC_TYPES = new Set(["title", "subtitle", "separator", "richtext", "image", "bullet_list", "table"]);

function children(field: FormCoreField): FormCoreField[] {
	return (field.children ?? []) as FormCoreField[];
}

// ── Reading a post ──────────────────────────────────────────────────

type Posted = FormData;

function text(form: Posted, key: string, part?: string): string {
	const v = form.get(name(key, part));
	return typeof v === "string" ? v : "";
}

function texts(form: Posted, key: string): string[] {
	return form.getAll(name(key)).filter((v): v is string => typeof v === "string" && v !== "");
}

function numberOrEmpty(raw: string): number | "" {
	if (raw.trim() === "") return "";
	const n = Number(raw);
	return Number.isFinite(n) ? n : "";
}

/** One field's value from the post, or `undefined` when it wasn't on the page. */
function readValue(field: FormCoreField, form: Posted, key: string, notices: string[]): unknown {
	if (form.get(name(key, "~")) === null) return undefined;
	switch (field.type) {
		case "checkbox":
			return texts(form, key);
		case "boolean":
			return form.getAll(name(key)).includes("true");
		case "number":
		case "currency":
		case "stepper":
			return numberOrEmpty(text(form, key));
		case "slider": {
			const v = numberOrEmpty(text(form, key));
			return v === "" ? undefined : v;
		}
		case "star_rating":
		case "happiness_rating": {
			const v = numberOrEmpty(text(form, key));
			return v === "" ? undefined : v;
		}
		case "choice_cards":
			return field.choiceConfig?.mode === "multi" ? texts(form, key) : text(form, key);
		case "collection_select":
			return field.collectionSelectConfig?.multi ? texts(form, key) : text(form, key);
		case "tags":
			return text(form, key)
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
		case "url":
			return { url: text(form, key) };
		case "measurement": {
			const v = numberOrEmpty(text(form, key, "value"));
			const unit = text(form, key, "unit");
			return v === "" ? undefined : { value: v, unit };
		}
		case "name": {
			const out: Record<string, string> = {};
			for (const part of ["prefix", "first", "middle", "last", "suffix", "nicknames"]) {
				const v = form.get(name(key, part));
				if (typeof v === "string") out[part] = v;
			}
			return out;
		}
		case "address":
			return Object.fromEntries(
				["line1", "line2", "city", "state", "zip"].map((p) => [p, text(form, key, p)]),
			);
		case "date_range":
			return { start: text(form, key, "start"), end: text(form, key, "end") };
		case "time_picker": {
			const mode = field.timeConfig?.mode ?? "simple";
			if (mode === "time_block") return { start: text(form, key, "start"), end: text(form, key, "end") };
			if (mode === "appointment") return { date: text(form, key, "date"), time: text(form, key, "time") };
			return text(form, key);
		}
		case "file_upload": {
			const max = field.fileConfig?.maxFiles ?? 1;
			let kept: Array<FormFileValue | HeldFile> = [];
			try {
				const parsed = JSON.parse(text(form, key) || "[]") as Array<
					FormFileValue | { pending: true; token: string; name: string; size: number }
				>;
				for (const entry of parsed) {
					if ("pending" in entry && entry.pending) {
						const held = heldFiles.get(entry.token);
						if (held) kept.push({ pending: true, file: held.file, name: entry.name, size: entry.size, token: entry.token });
						else notices.push(`${entry.name} was waiting too long; pick it again.`);
					} else {
						kept.push(entry as FormFileValue);
					}
				}
			} catch {
				kept = [];
			}
			for (const picked of form.getAll(name(key, "add"))) {
				if (!(picked instanceof File) || picked.size === 0) continue;
				if (kept.length >= max) break;
				kept.push({ pending: true, file: picked, name: picked.name, size: picked.size, token: holdFile(picked) });
			}
			return kept;
		}
		case "multi_populator": {
			const rows = Number(text(form, key, "rows")) || 0;
			const out: Array<Record<string, unknown>> = [];
			for (let row = 0; row < rows; row += 1) {
				const record: Record<string, unknown> = {};
				for (const child of valueFields(children(field))) {
					const v = readValue(child, form, `${key}.${row}.${child.id}`, notices);
					if (v !== undefined) record[child.id] = v;
				}
				out.push(record);
			}
			return out;
		}
		default:
			return text(form, key);
	}
}

/** The fields that hold a value, through layout nodes but not into repeaters. */
function valueFields(fields: FormCoreField[]): FormCoreField[] {
	const out: FormCoreField[] = [];
	for (const field of fields) {
		if (LAYOUT_TYPES.has(field.type)) out.push(...valueFields(children(field)));
		else if (!STATIC_TYPES.has(field.type) && field.type !== "calculation") out.push(field);
	}
	return out;
}

// ── What a request asks for ─────────────────────────────────────────

type Action =
	| { kind: "refresh" }
	| { kind: "default" }
	| { kind: "next" }
	| { kind: "back" }
	| { kind: "submit" }
	| { kind: "step"; index: number }
	| { kind: "add-row"; key: string }
	| { kind: "remove-row"; key: string; index: number }
	| { kind: "remove-file"; key: string; index: number };

function readAction(form: Posted): Action {
	const raw = form.get("_action");
	if (typeof raw !== "string" || raw === "") return { kind: "refresh" };
	if (raw === "next" || raw === "back" || raw === "submit" || raw === "default") return { kind: raw };
	const [kind, ...rest] = raw.split(":");
	if (kind === "step") return { kind: "step", index: Number(rest[0]) || 0 };
	if (kind === "add-row" && rest[0]) return { kind: "add-row", key: rest[0] };
	if ((kind === "remove-row" || kind === "remove-file") && rest[0]) {
		return { kind, key: rest[0], index: Number(rest[1]) || 0 };
	}
	return { kind: "refresh" };
}

// ── Running the controller ──────────────────────────────────────────

/** What one render needs beyond the controller's snapshot. */
type View = {
	slug: string;
	snapshot: FormSnapshot;
	/** The errors to show (the controller checks everything; we show what the visitor has met). */
	errors: Record<string, string>;
	/** Form-level messages (a failed submit, a file to pick again). */
	notices: string[];
	submitLabel: string;
	action: string;
};

export type FormOptions = {
	/** Where the form posts. Default `/forms/<slug>`. */
	action?: string;
	submitLabel?: string;
};

/** A form as it first appears. */
export async function renderForm(slug: string, options: FormOptions = {}): Promise<Raw> {
	return run(slug, null, options);
}

/** A post from the form: apply it, do what it asked, and render the result. */
export async function handleFormPost(slug: string, req: Request, options: FormOptions = {}): Promise<Raw> {
	const form = await req.formData();
	const label = form.get("_label");
	const submitLabel = options.submitLabel ?? (typeof label === "string" && label ? label.slice(0, 60) : undefined);
	return run(slug, form, { ...options, ...(submitLabel ? { submitLabel } : {}) });
}

async function run(slug: string, form: Posted | null, options: FormOptions): Promise<Raw> {
	let schema: FormSchema;
	try {
		schema = await loadFormSchema(slug);
	} catch (err) {
		return html`<div class="bd-form" data-bd-status="error"><div class="bd-form__error">${
			err instanceof Error ? err.message : "Could not load this form."
		}</div></div>`;
	}
	const controller = createFormController({ slug, schema, client: clientFor(slug) });
	await controller.load();

	const notices: string[] = [];
	const action = form ? readAction(form) : ({ kind: "refresh" } as Action);
	let shown = new Set<string>();

	if (form) {
		shown = new Set(String(form.get("_errors") ?? "").split(",").filter(Boolean));
		for (const field of valueFields(controller.snapshot().fields)) {
			const value = readValue(field, form, field.id, notices);
			if (value === undefined) continue;
			controller.setValue(field.id, editValue(field, field.id, value, action));
		}
		controller.goToStep(Number(form.get("_step")) || 0);
	}

	// collection_select options load here, before the render needs them.
	for (const field of valueFields(controller.snapshot().fields)) {
		if (field.type === "collection_select") await controller.loadCollectionOptions(field.id);
	}

	const snap = () => controller.snapshot();
	let errors: Record<string, string> = {};
	const allErrors = () =>
		Object.fromEntries(Object.values(snap().errors).map((e) => [e.id, e.message]));

	switch (action.kind) {
		case "back":
			controller.back();
			break;
		case "step":
			if (action.index < snap().step) controller.goToStep(action.index);
			break;
		case "next":
		case "submit":
		case "default": {
			const last = snap().isLastStep;
			if (action.kind === "next" || (action.kind === "default" && !last)) {
				controller.next();
				errors = allErrors();
			} else {
				const result = await controller.submit();
				errors = allErrors();
				if (!result.ok && Object.keys(errors).length === 0) notices.push(result.message);
			}
			break;
		}
		default:
			// A change: re-check only what's already marked, so a fixed box clears
			// and an untouched one isn't scolded.
			if (shown.size > 0) {
				controller.validate();
				errors = Object.fromEntries(Object.entries(allErrors()).filter(([id]) => shown.has(id)));
			}
	}

	return renderView({
		slug,
		snapshot: snap(),
		errors,
		notices,
		submitLabel: options.submitLabel ?? "Submit",
		action: options.action ?? `/forms/${encodeURIComponent(slug)}`,
	});
}

/** Apply a repeater or file edit this post asked for to the field it names. */
function editValue(
	field: FormCoreField,
	key: string,
	value: unknown,
	action: Action,
): unknown {
	if (field.type === "multi_populator" && Array.isArray(value)) {
		let next = value as Array<Record<string, unknown>>;
		const max = field.populatorConfig?.maxInstances ?? 10;
		if (action.kind === "add-row" && action.key === key && next.length < max) next = [...next, {}];
		if (action.kind === "remove-row" && action.key === key) next = next.filter((_, i) => i !== action.index);
		return next;
	}
	if (field.type === "file_upload" && Array.isArray(value)) {
		if (action.kind === "remove-file" && action.key === key) return value.filter((_, i) => i !== action.index);
	}
	return value;
}

// ── Rendering ───────────────────────────────────────────────────────

/** Every type `renderInput` draws (anything else is a plain text box). */
const KNOWN_TYPES = new Set([
	"title", "subtitle", "separator", "richtext", "image", "textarea", "rich_text_input", "select", "radio",
	"checkbox", "boolean", "date", "email", "phone", "number", "currency", "stepper", "slider", "star_rating",
	"happiness_rating", "color_picker", "choice_cards", "date_range", "time_picker", "name", "address", "url",
	"tags", "measurement", "calculation", "collection_select", "multi_populator", "file_upload",
]);

const NO_LABEL_TYPES = new Set(["title", "subtitle", "separator", "richtext", "image", "boolean"]);
/** Fields drawn as one form control, which a `<label for>` can name. The rest are groups. */
const SINGLE_CONTROL_TYPES = new Set([
	"text", "textarea", "rich_text_input", "select", "date", "email", "phone", "number", "currency",
	"stepper", "slider", "url", "tags", "measurement",
]);
function singleControl(field: FormCoreField): boolean {
	if (field.type === "time_picker") return (field.timeConfig?.mode ?? "simple") === "simple";
	return SINGLE_CONTROL_TYPES.has(field.type) || !KNOWN_TYPES.has(field.type);
}
const cls = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
const attr = (on: boolean, word: string) => (on ? raw(` ${word}`) : "");

type Ctx = { view: View; formId: string; values: Record<string, unknown> };

function renderView(view: View): Raw {
	const { snapshot: s, slug } = view;
	const formId = slug.replace(/[^A-Za-z0-9_-]/g, "-");

	if (s.submitted) {
		const demo = slug === DEMO_FORM_SLUG;
		return html`<div class="bd-form" id="bd-form-${formId}" data-bd-status="submitted">
			<div class="bd-form__success" role="status">
				<p class="bd-form__success-title">Thanks — we got it.</p>
				${demo ? html`<p class="bd-form__success-note">This is the bundled sample, so nothing was sent.</p>` : ""}
				<a class="bd-btn bd-btn--ghost" href="${view.action}">Fill it in again</a>
			</div>
		</div>`;
	}

	const ctx: Ctx = { view, formId, values: s.values };
	const errorIds = Object.keys(view.errors);
	const labels = s.errorList.filter((e) => view.errors[e.id]).map((e) => e.label);
	const stepped = s.settings.isConsecutive && s.stepCount > 1;

	// The form posts its buttons; the div inside posts each change. Two
	// elements because htmx remembers the last button clicked on a form and
	// sends its value with that form's later posts — the morph swap keeps the
	// button, so a change after "Add a row" would add another. The div's posts
	// never carry it. Both swap into the form and share one queue, where a
	// newer post cancels an older one still on its way.
	return html`<form
		class="bd-form"
		id="bd-form-${formId}"
		data-bd-status="${s.status}"
		method="post"
		action="${view.action}"
		enctype="multipart/form-data"
		novalidate
		hx-post="${view.action}"
		hx-encoding="multipart/form-data"
		hx-trigger="submit"
		hx-target="this"
		hx-ext="morph"
		hx-swap="morph:{ignoreActiveValue:true}"
		hx-sync="this:replace"
	>
		<button class="bd-form__default" type="submit" name="_action" value="default" tabindex="-1" aria-hidden="true">Continue</button>
		<input type="hidden" name="_step" value="${s.step}" />
		<input type="hidden" name="_errors" value="${errorIds.join(",")}" />
		<input type="hidden" name="_label" value="${view.submitLabel}" />
		<div class="bd-form__live" hx-post="${view.action}" hx-trigger="change" hx-target="closest form" hx-sync="closest form:replace">
		${s.orgIcon ? html`<img class="bd-form__org-icon" src="${s.orgIcon}" alt="" />` : ""}
		${
			s.title || s.description
				? html`<div class="bd-form__header">
						${s.title ? html`<h2 class="bd-form__title">${s.title}</h2>` : ""}
						${s.description ? html`<p class="bd-form__description">${s.description}</p>` : ""}
					</div>`
				: ""
		}
		${stepped ? renderProgress(s) : ""}
		${view.notices.map((n) => html`<div class="bd-form__error" role="alert">${n}</div>`)}
		${
			labels.length > 0
				? html`<div class="bd-form__error-summary" role="alert">
						<div class="bd-form__error-summary-title">Please complete the highlighted field${labels.length === 1 ? "" : "s"}.</div>
						<div class="bd-form__error-summary-list">${labels.join(", ")}</div>
					</div>`
				: ""
		}
		${
			stepped
				? s.steps.map(
						(step, i) =>
							html`<div class="bd-step" data-bd-step="${i}"${attr(i !== s.step, "hidden")}>${renderTree(step, ctx, "", true)}</div>`,
					)
				: renderTree(s.fields, ctx, "", false)
		}
		${renderNav(view, stepped)}
		</div>
	</form>`;
}

function renderProgress(s: FormSnapshot): Raw | "" {
	if (!s.settings.showProgress) return "";
	if (s.settings.progressStyle === "bar") {
		return html`<div class="bd-progress bd-progress--bar">
			<span class="bd-progress__count">${s.step + 1} / ${s.stepCount}</span>
			<div class="bd-progress__track"><div class="bd-progress__fill" style="width:${s.progressPercent}%"></div></div>
		</div>`;
	}
	return html`<div class="bd-progress bd-progress--steps">
		<div class="bd-progress__steps">${s.steps.map((step, i) => {
			const first = step[0];
			const title = (typeof first?.stepTitle === "string" && first.stepTitle) || first?.label || `Step ${i + 1}`;
			const done = i < s.step;
			const current = i === s.step;
			return html`${i > 0 ? html`<div class="${cls("bd-progress__line", i <= s.step && "bd-progress__line--done")}"></div>` : ""}<button
				class="${cls("bd-progress__step", current && "bd-progress__step--current", done && "bd-progress__step--done")}"
				type="submit" name="_action" value="step:${i}"${attr(!done, "disabled")}${current ? raw(' aria-current="step"') : ""}
			><span class="${cls("bd-progress__dot", current && "bd-progress__dot--current", done && "bd-progress__dot--done")}">${done ? "✓" : String(i + 1)}</span><span class="bd-progress__title">${title}</span></button>`;
		})}</div>
	</div>`;
}

function renderNav(view: View, stepped: boolean): Raw {
	const s = view.snapshot;
	const primary =
		stepped && !s.isLastStep
			? html`<button class="bd-btn bd-btn--next" type="submit" name="_action" value="next">Next</button>`
			: html`<button class="bd-btn bd-btn--submit" type="submit" name="_action" value="submit"><span class="bd-btn__label">${view.submitLabel}</span><span class="bd-btn__busy">Sending…</span></button>`;
	return html`<div class="bd-nav">
		${stepped ? html`<button class="bd-btn bd-btn--ghost bd-btn--back" type="submit" name="_action" value="back"${attr(s.isFirstStep, "disabled")}>Back</button>` : ""}
		${primary}
	</div>`;
}

/** The field tree. `prefix` is the repeater row's key prefix ("" at the top). */
function renderTree(fields: FormCoreField[], ctx: Ctx, prefix: string, flat: boolean, values = ctx.values): Raw {
	const out: Raw[] = [];
	for (const field of fields) {
		switch (field.type) {
			case "input_group": {
				const kids = children(field);
				const count = field.concurrentReveal
					? concurrentRevealCount(kids, values, ctx.view.snapshot.collectionOptions)
					: kids.length;
				out.push(html`<div class="${cls("bd-group", flat ? "bd-group--flat" : "bd-group--card")}" data-bd-group="${cssKey(field)}">
					${field.label && field.showGroupLabel === true ? html`<div class="bd-group__label">${field.label}</div>` : ""}
					${renderTree(kids.slice(0, count), ctx, prefix, flat, values)}
					${count < kids.length ? html`<div hidden>${renderTree(kids.slice(count), ctx, prefix, flat, values)}</div>` : ""}
				</div>`);
				break;
			}
			case "condition_block": {
				const on = evalCondition(field.conditionRule, values, ctx.view.snapshot.collectionOptions);
				// Hidden, not dropped: what's typed there comes back if the condition does.
				out.push(html`<div class="bd-condition"${attr(!on, "hidden")}>${renderTree(children(field), ctx, prefix, flat, values)}</div>`);
				break;
			}
			case "or_condition": {
				const [left, right] = children(field);
				const errored = Boolean(ctx.view.errors[field.id]);
				out.push(html`<div class="${cls("bd-or", errored && "bd-or--error")}">
					${field.label ? html`<div class="bd-or__label">${field.label}<span class="bd-or__hint"> Fill at least one side</span></div>` : ""}
					<div class="bd-or__grid">
						<div class="bd-or__side"><div class="bd-or__side-label">${field.orConditionConfig?.leftLabel || "Option A"}</div>${left ? renderTree([left], ctx, prefix, flat, values) : ""}</div>
						<div class="bd-or__divider"><span class="bd-or__badge">OR</span></div>
						<div class="bd-or__side"><div class="bd-or__side-label">${field.orConditionConfig?.rightLabel || "Option B"}</div>${right ? renderTree([right], ctx, prefix, flat, values) : ""}</div>
					</div>
					${errored ? html`<p class="bd-or__error">${ctx.view.errors[field.id]}</p>` : ""}
				</div>`);
				break;
			}
			case "flex_row":
				out.push(html`<div class="bd-flex-row">${children(field).map(
					(child) => html`<div class="bd-flex-row__cell">${renderTree([child], ctx, prefix, flat, values)}</div>`,
				)}</div>`);
				break;
			default:
				out.push(renderRow(field, ctx, prefix, values));
		}
	}
	return html`<div class="bd-tree">${out}</div>`;
}

function cssKey(field: FormCoreField): string {
	const explicit = (typeof field.outputKey === "string" && field.outputKey.trim()) || (typeof field.key === "string" && field.key.trim());
	return explicit || field.id;
}

function renderRow(field: FormCoreField, ctx: Ctx, prefix: string, values: Record<string, unknown>): Raw {
	const key = `${prefix}${field.id}`;
	// Errors are keyed by field id; inside a repeater row they belong to the repeater.
	const error = prefix ? undefined : ctx.view.errors[field.id];
	const inputId = idFor(ctx.formId, key);
	const showLabel = !NO_LABEL_TYPES.has(field.type) && Boolean(field.label);
	const valueBearing = !STATIC_TYPES.has(field.type) && field.type !== "calculation";
	const helpId = field.helpText ? `${inputId}-help` : null;
	const errorId = error ? `${inputId}-error` : null;
	const describedBy = [errorId, helpId].filter(Boolean).join(" ");
	const labelId = `${inputId}-label`;
	const single = singleControl(field);
	return html`<div
		class="${cls("bd-field", `bd-field--${field.type}`, field.required && "bd-field--required", error && "bd-field--error")}"
		data-field-id="${field.id}"
		data-bd-field="${cssKey(field)}"
		data-bd-type="${field.type}"
	>
		${
			showLabel
				? single
					? html`<label class="bd-field__label" id="${labelId}" for="${inputId}">${field.label}${field.required ? html`<span class="bd-field__required" aria-hidden="true"> *</span>` : ""}</label>`
					: html`<span class="bd-field__label" id="${labelId}">${field.label}${field.required ? html`<span class="bd-field__required" aria-hidden="true"> *</span>` : ""}</span>`
				: ""
		}
		${valueBearing ? html`<input type="hidden" name="${name(key, "~")}" value="1" />` : ""}
		${renderInput(field, ctx, key, values[field.id], inputId, describedBy, Boolean(error), showLabel && !single ? labelId : null)}
		${error ? html`<p class="bd-field__error" id="${errorId}">${error}</p>` : ""}
		${field.helpText ? html`<p class="bd-field__help" id="${helpId}">${field.helpText}</p>` : ""}
	</div>`;
}

function described(describedBy: string, invalid: boolean): Raw {
	return raw(`${describedBy ? ` aria-describedby="${describedBy}"` : ""}${invalid ? ' aria-invalid="true"' : ""}`);
}

function autocomplete(field: FormCoreField): Raw | "" {
	const token = resolveFieldAutocomplete(field, {});
	return token === undefined ? "" : html` autocomplete="${token}"`;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function renderInput(
	field: FormCoreField,
	ctx: Ctx,
	key: string,
	value: unknown,
	id: string,
	describedBy: string,
	invalid: boolean,
	labelledBy: string | null,
): Raw | "" {
	const aria = described(describedBy, invalid);
	// On a group's container: what names it, what describes it.
	const group = raw(`${labelledBy ? ` aria-labelledby="${labelledBy}"` : ""}`);
	const n = name(key);
	switch (field.type) {
		case "title":
			return html`<h2 class="bd-field__title">${field.label || ""}</h2>`;
		case "subtitle":
			return html`<h3 class="bd-field__subtitle">${field.label || ""}</h3>`;
		case "separator":
			return html`<hr class="bd-field__separator" />`;
		case "richtext":
			// BD publishes `content` already sanitized.
			return field.content ? html`<div class="bd-field__richtext bd-prose">${raw(field.content)}</div>` : "";
		case "image": {
			const cfg = (field["imageConfig"] ?? {}) as { src?: string; alt?: string };
			return cfg.src ? html`<img class="bd-field__image" src="${cfg.src}" alt="${cfg.alt ?? ""}" />` : "";
		}
		case "textarea":
		case "rich_text_input": {
			const cfg = (field["textareaConfig"] ?? {}) as { rows?: number };
			return html`<textarea class="bd-textarea" id="${id}" name="${n}" rows="${cfg.rows ?? 4}" placeholder="${field.placeholder ?? ""}"${autocomplete(field)}${aria}>${str(value)}</textarea>`;
		}
		case "select":
			return html`<select class="bd-select" id="${id}" name="${n}"${aria}>
				<option value="">${field.placeholder || "Select…"}</option>
				${(field.options ?? []).map((o) => html`<option value="${o}"${attr(str(value) === o, "selected")}>${o}</option>`)}
			</select>`;
		case "radio":
			return choiceList(field.options ?? [], "radio", n, id, (o) => str(value) === o, raw(`${render(aria)}${render(group)}`));
		case "checkbox": {
			const picked = Array.isArray(value) ? (value as string[]) : [];
			return choiceList(field.options ?? [], "checkbox", n, id, (o) => picked.includes(o), raw(`${render(aria)}${render(group)}`));
		}
		case "boolean":
			return html`<label class="bd-boolean" for="${id}">
				<input type="hidden" name="${n}" value="false" />
				<input class="bd-switch" type="checkbox" id="${id}" name="${n}" value="true"${attr(value === true, "checked")}${aria} />
				<span class="bd-boolean__label">${field.placeholder || field.label || "Yes"}${field.required || field.mustBeTrue ? html`<span class="bd-field__required" aria-hidden="true"> *</span>` : ""}</span>
			</label>`;
		case "date":
			return html`<input class="bd-input" type="date" id="${id}" name="${n}" value="${str(value)}"${aria} />`;
		case "email":
			return html`<input class="bd-input" type="email" id="${id}" name="${n}" value="${str(value)}" placeholder="${field.placeholder || "you@example.com"}"${autocomplete(field)}${aria} />`;
		case "phone":
			return html`<div class="bd-phone">
				${field.phoneConfig?.showFlags ? html`<span class="bd-phone__flag" aria-hidden="true">🇺🇸</span>` : ""}
				<input class="bd-input" type="tel" id="${id}" name="${n}" value="${str(value)}" placeholder="${field.placeholder || (field.phoneConfig?.international ? "+1 (555) 000-0000" : "(555) 000-0000")}"${autocomplete(field)}${aria} />
			</div>`;
		case "number":
		case "currency":
		case "stepper": {
			const decimals = field.allowDecimal !== false && field.type !== "stepper";
			return html`<input class="bd-input" type="number" id="${id}" name="${n}" value="${str(value)}" placeholder="${field.placeholder ?? ""}"
				${field.validation?.min !== undefined ? html`min="${field.validation.min}"` : field.allowNegative === false ? raw('min="0"') : ""}
				${field.validation?.max !== undefined ? html`max="${field.validation.max}"` : ""}
				step="${decimals ? "any" : "1"}" inputmode="${decimals ? "decimal" : "numeric"}"${aria} />`;
		}
		case "slider": {
			const min = field.sliderConfig?.min ?? 0;
			const max = field.sliderConfig?.max ?? 100;
			const step = field.sliderConfig?.step ?? 1;
			const unit = field.sliderConfig?.unit;
			const fmt = (v: number) => (unit === "currency" ? `$${v}` : unit === "percent" ? `${v}%` : `${v}`);
			const v = typeof value === "number" ? value : min;
			return html`<div class="bd-slider-wrap">
				<div class="bd-slider__scale"><span>${fmt(min)}</span><output class="bd-slider__value" for="${id}">${fmt(v)}</output><span>${fmt(max)}</span></div>
				<input class="bd-slider" type="range" id="${id}" name="${n}" min="${min}" max="${max}" step="${step}" value="${v}"${aria} />
			</div>`;
		}
		case "star_rating": {
			const max = field.starRatingConfig?.maxStars ?? 5;
			const v = typeof value === "number" ? value : 0;
			return html`<div class="bd-stars" role="radiogroup" id="${id}"${aria}${group}>${Array.from({ length: max }, (_, i) =>
				html`<label class="${cls("bd-star", i < v && "bd-star--filled")}"><input class="bd-visually-hidden" type="radio" name="${n}" value="${i + 1}"${attr(v === i + 1, "checked")} /><span aria-hidden="true">★</span><span class="bd-visually-hidden">${i + 1} star${i === 0 ? "" : "s"}</span></label>`,
			)}</div>`;
		}
		case "happiness_rating": {
			const v = typeof value === "number" ? value : -1;
			const faces: Array<[string, string]> = [["😞", "Very unhappy"], ["😕", "Unhappy"], ["😐", "Neutral"], ["🙂", "Happy"], ["😄", "Very happy"]];
			return html`<div class="bd-happiness" role="radiogroup" id="${id}"${aria}${group}>${faces.map(
				([face, label], i) =>
					html`<label class="${cls("bd-happiness__face", i === v && "bd-happiness__face--active")}" title="${label}"><input class="bd-visually-hidden" type="radio" name="${n}" value="${i}"${attr(v === i, "checked")} /><span aria-hidden="true">${face}</span><span class="bd-visually-hidden">${label}</span></label>`,
			)}</div>`;
		}
		case "color_picker":
			return html`<div class="bd-colors" role="radiogroup" id="${id}"${aria}${group}>${(field.options ?? []).map(
				(color) =>
					html`<label class="${cls("bd-color", str(value) === color && "bd-color--selected")}" style="background-color:${color}" title="${color}"><input class="bd-visually-hidden" type="radio" name="${n}" value="${color}"${attr(str(value) === color, "checked")} /><span class="bd-visually-hidden">${color}</span></label>`,
			)}</div>`;
		case "choice_cards": {
			const multi = field.choiceConfig?.mode === "multi";
			const picked = multi ? (Array.isArray(value) ? (value as string[]) : []) : [str(value)];
			return html`<div class="bd-cards" role="${multi ? "group" : "radiogroup"}" id="${id}"${aria}${group}>${(field.choiceConfig?.options ?? []).map(
				(o, i) =>
					html`<label class="${cls("bd-card-choice", picked.includes(o.label) && "bd-card-choice--on")}" for="${id}-${i}">
						<input class="bd-card-choice__input" type="${multi ? "checkbox" : "radio"}" id="${id}-${i}" name="${n}" value="${o.label}"${attr(picked.includes(o.label), "checked")} />
						${o.imageUrl ? html`<img class="bd-card-choice__image" src="${o.imageUrl}" alt="" />` : ""}
						<span class="bd-card-choice__label">${o.label}</span>
						${o.description ? html`<span class="bd-card-choice__description">${o.description}</span>` : ""}
						${o.price ? html`<span class="bd-card-choice__price">${o.price}</span>` : ""}
					</label>`,
			)}</div>`;
		}
		case "date_range": {
			const v = obj(value);
			return pair(id, n, group, ["start", "Start", "date", str(v["start"])], ["end", "End", "date", str(v["end"])]);
		}
		case "time_picker": {
			const mode = field.timeConfig?.mode ?? "simple";
			const v = obj(value);
			if (mode === "time_block") return pair(id, n, group, ["start", "Start", "time", str(v["start"])], ["end", "End", "time", str(v["end"])]);
			if (mode === "appointment") return pair(id, n, group, ["date", "Date", "date", str(v["date"])], ["time", "Time", "time", str(v["time"])]);
			const format = field.timeConfig?.format ?? "12h";
			const step = Math.max(field.timeConfig?.stepMinutes ?? 30, 1);
			const options: Raw[] = [];
			for (let h = 0; h < 24; h += 1) {
				for (let m = 0; m < 60; m += step) {
					const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
					const label = format === "24h" ? t : `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
					options.push(html`<option value="${t}"${attr(str(value) === t, "selected")}>${label}</option>`);
				}
			}
			return html`<select class="bd-select" id="${id}" name="${n}"${aria}><option value="">${field.placeholder || "Select time"}</option>${options}</select>`;
		}
		case "name": {
			const v = obj(value);
			const cfg = field.nameConfig ?? {};
			const part = (p: string, label: string, token: string, placeholder: string, full = false) =>
				html`<label class="${cls("bd-name__field", full && "bd-name__field--full")}"><span class="bd-name__label">${label}</span><input class="bd-input" id="${idFor(ctx.formId, key, p)}" name="${name(key, p)}" value="${str(v[p])}" placeholder="${placeholder}" autocomplete="${token}"${aria} /></label>`;
			return html`<div class="bd-name" role="group" id="${id}"${group}>
				${cfg.prefix ? part("prefix", "Title", "honorific-prefix", "Dr.", true) : ""}
				${part("first", "First name", "given-name", "Jane")}
				${cfg.middle ? part("middle", "Middle name", "additional-name", "Quinn") : ""}
				${part("last", "Last name", "family-name", "Doe", cfg.middle === true && cfg.suffix !== true)}
				${cfg.suffix ? part("suffix", "Suffix", "honorific-suffix", "Jr.", cfg.middle !== true) : ""}
				${cfg.nicknames ? html`<label class="bd-name__field bd-name__field--full"><span class="bd-name__label">Nicknames</span><input class="bd-input" name="${name(key, "nicknames")}" value="${Array.isArray(v["nicknames"]) ? (v["nicknames"] as string[]).join(", ") : str(v["nicknames"])}" placeholder="Johnny, JM — separate with commas" /></label>` : ""}
			</div>`;
		}
		case "address": {
			const v = obj(value);
			const part = (p: string, label: string, token: string, full = false) =>
				html`<label class="${cls("bd-address__field", full && "bd-address__field--full")}"><span class="bd-address__label">${label}</span><input class="bd-input" id="${idFor(ctx.formId, key, p)}" name="${name(key, p)}" value="${str(v[p])}" autocomplete="${token}"${aria} /></label>`;
			return html`<div class="bd-address" role="group" id="${id}"${group}>
				${part("line1", "Address line 1", "address-line1", true)}
				${part("line2", "Address line 2", "address-line2", true)}
				${part("city", "City", "address-level2")}
				${part("state", "State", "address-level1")}
				${part("zip", "ZIP", "postal-code", true)}
			</div>`;
		}
		case "url":
			return html`<input class="bd-input" type="url" id="${id}" name="${n}" value="${str(obj(value)["url"])}" placeholder="${field.placeholder || "https://"}"${aria} />`;
		case "tags":
			return html`<input class="bd-input" id="${id}" name="${n}" value="${Array.isArray(value) ? (value as string[]).join(", ") : ""}" placeholder="${field.placeholder || "Separate with commas"}"${aria} />`;
		case "measurement": {
			const v = obj(value);
			const units = field.unitConfig?.units ?? [];
			const unit = str(v["unit"]) || field.unitConfig?.defaultUnit || units[0] || "";
			return html`<div class="bd-measurement">
				<input class="bd-input" type="number" step="any" id="${id}" name="${name(key, "value")}" value="${str(v["value"])}"${aria} />
				${field.unitConfig?.mode === "fixed" || units.length <= 1
					? html`<input type="hidden" name="${name(key, "unit")}" value="${unit}" /><span class="bd-measurement__unit">${unit}</span>`
					: html`<select class="bd-select" name="${name(key, "unit")}" aria-label="Unit">${units.map((u) => html`<option value="${u}"${attr(u === unit, "selected")}>${u}</option>`)}</select>`}
			</div>`;
		}
		case "calculation": {
			const cfg = field.calculationConfig as { display?: { show?: boolean; prefix?: string; suffix?: string; decimals?: number } } | undefined;
			if (cfg?.display?.show === false) return "";
			const shown = formatCalcValue((value ?? null) as Parameters<typeof formatCalcValue>[0], cfg?.display);
			return html`<output class="bd-calc" id="${id}" aria-live="polite">${shown || "—"}</output>`;
		}
		case "collection_select":
			return collectionSelect(field, ctx, n, id, value, aria, group);
		case "multi_populator":
			return html`<div role="group"${group}>${repeater(field, ctx, key, value)}</div>`;
		case "file_upload":
			return files(field, ctx, key, value, id, aria, labelledBy);
		default:
			if (["schedule", "signature", "payment", "icon_picker", "image_input"].includes(field.type)) {
				return html`<p class="bd-field__unsupported">${field.label || "This field"} can't be filled in on this page yet.</p>`;
			}
			return html`<input class="bd-input" type="text" id="${id}" name="${n}" value="${str(value)}" placeholder="${field.placeholder ?? ""}"${autocomplete(field)}${aria} />`;
	}
}

function choiceList(
	options: string[],
	type: "radio" | "checkbox",
	n: string,
	id: string,
	on: (option: string) => boolean,
	aria: Raw,
): Raw {
	return html`<div class="${type === "radio" ? "bd-radio-group" : "bd-checkbox-group"}" role="${type === "radio" ? "radiogroup" : "group"}" id="${id}"${aria}>${options.map(
		(o, i) =>
			html`<label class="${type === "radio" ? "bd-radio-option" : "bd-checkbox-option"}" for="${id}-${i}"><input class="${type === "radio" ? "bd-radio" : "bd-checkbox"}" type="${type}" id="${id}-${i}" name="${n}" value="${o}"${attr(on(o), "checked")} /><span>${o}</span></label>`,
	)}</div>`;
}

function pair(
	id: string,
	n: string,
	group: Raw,
	left: [string, string, string, string],
	right: [string, string, string, string],
): Raw {
	const cell = ([part, label, type, value]: [string, string, string, string]) =>
		html`<label class="bd-grid__cell"><span class="bd-grid__label">${label}</span><input class="bd-input" type="${type}" id="${id}-${part}" name="${n}.${part}" value="${value}" /></label>`;
	return html`<div class="bd-grid bd-grid--2" role="group" id="${id}"${group}>${cell(left)}${cell(right)}</div>`;
}

function collectionSelect(field: FormCoreField, ctx: Ctx, n: string, id: string, value: unknown, aria: Raw, group: Raw): Raw {
	const state: CollectionOptionsState = ctx.view.snapshot.collectionOptions[field.id] ?? IDLE_COLLECTION_OPTIONS;
	if (state.status !== "ready") {
		const message =
			state.status === "empty" ? "Nothing to choose from yet." : state.error ?? "Couldn't load the choices.";
		return html`<div class="bd-field__collection" data-status="${state.status}"><p class="bd-field__collection-status" role="${state.status === "empty" ? "status" : "alert"}">${message}</p></div>`;
	}
	const layout = collectionSelectLayout(field, state.options);
	if (layout.native) {
		return html`<div class="bd-field__collection" data-status="ready"><select class="bd-select bd-field__collection-select" id="${id}" name="${n}"${aria}>
			<option value="">${field.placeholder || "Choose…"}</option>
			${state.options.map((o) => html`<option value="${o.value}"${attr(str(value) === o.value, "selected")}>${o.label}</option>`)}
		</select></div>`;
	}
	const picked = pickedCollectionValues(value, layout.multi);
	return html`<div class="bd-field__collection" data-status="ready"><div class="bd-field__collection-options" role="${layout.multi ? "group" : "radiogroup"}" id="${id}"${aria}${group}>${state.options.map(
		(o, i) =>
			html`<label class="bd-field__collection-option"${picked.includes(o.value) ? raw(' data-selected="true"') : ""} for="${id}-${i}"><input type="${layout.multi ? "checkbox" : "radio"}" id="${id}-${i}" name="${n}" value="${o.value}"${attr(picked.includes(o.value), "checked")} /><span class="bd-field__collection-label">${o.label}</span></label>`,
	)}</div></div>`;
}

function repeater(field: FormCoreField, ctx: Ctx, key: string, value: unknown): Raw {
	const cfg = field.populatorConfig ?? {};
	const max = cfg.maxInstances ?? 10;
	const min = Math.max(cfg.minInstances ?? 1, 1);
	const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
	const count = Math.max(rows.length, min);
	const item = cfg.itemLabel || "Item";
	return html`<div class="bd-repeater">
		<input type="hidden" name="${name(key, "rows")}" value="${count}" />
		${Array.from({ length: count }, (_, row) => {
			const record = rows[row] ?? {};
			return html`<fieldset class="bd-repeater__row">
				<legend class="bd-repeater__legend">${item} ${row + 1}</legend>
				${renderTree(children(field), ctx, `${key}.${row}.`, true, record)}
				${count > min ? html`<button class="bd-btn bd-btn--ghost bd-btn--sm bd-repeater__remove" type="submit" name="_action" value="remove-row:${key}:${row}">Remove ${item.toLowerCase()} ${row + 1}</button>` : ""}
			</fieldset>`;
		})}
		${count < max ? html`<button class="bd-btn bd-btn--ghost bd-repeater__add" type="submit" name="_action" value="add-row:${key}">${cfg.addButtonLabel || `Add ${item.toLowerCase()}`}</button>` : ""}
	</div>`;
}

function files(
	field: FormCoreField,
	_ctx: Ctx,
	key: string,
	value: unknown,
	id: string,
	aria: Raw,
	labelledBy: string | null,
): Raw {
	const list = Array.isArray(value) ? (value as Array<FormFileValue | HeldFile>) : [];
	const max = field.fileConfig?.maxFiles ?? 1;
	const allowed = field.fileConfig?.allowedTypes ?? [];
	const kept = list.map((f) =>
		isPendingFileValue(f) ? { pending: true, token: (f as HeldFile).token, name: f.name, size: f.size } : f,
	);
	const remaining = Math.max(max - list.length, 0);
	// A new picker on every render: a picked file is held here once it's
	// posted, and the morph swap would otherwise keep it in the old picker and
	// send it again with the next post.
	const pickerId = `${id}-${crypto.randomUUID().slice(0, 8)}`;
	const named = labelledBy ? raw(` aria-labelledby="${labelledBy} ${pickerId}-text"`) : raw("");
	const grouped = labelledBy ? raw(` aria-labelledby="${labelledBy}"`) : raw("");
	return html`<div class="bd-file" role="group" id="${id}"${grouped}>
		<input type="hidden" name="${name(key)}" value="${JSON.stringify(kept)}" />
		${remaining > 0
			? html`<label class="bd-file__trigger" for="${pickerId}"><span id="${pickerId}-text">${list.length === 0 ? "Choose a file" : "Add another"}${max > 1 ? ` (up to ${remaining} more)` : ""}</span><input class="bd-file__input" type="file" id="${pickerId}" name="${name(key, "add")}"${attr(remaining > 1, "multiple")}${allowed.length > 0 ? html` accept="${allowed.join(",")}"` : ""}${aria}${named} /></label>`
			: html`<p class="bd-field__help">That's the most files this takes (${max}).</p>`}
		${list.length > 0
			? html`<ul class="bd-file__list">${list.map(
					(f, i) =>
						html`<li class="bd-file__item"><span class="bd-file__name">${f.name}</span><span class="bd-file__size">${Math.max(1, Math.round(f.size / 1024))} KB${isPendingFileValue(f) ? " · sends with the form" : ""}</span><button class="bd-file__remove" type="submit" name="_action" value="remove-file:${key}:${i}" aria-label="Remove ${f.name}">✕</button></li>`,
				)}</ul>`
			: ""}
	</div>`;
}

/** For callers that want a string. */
export function renderFormString(node: Raw): string {
	return render(node);
}
