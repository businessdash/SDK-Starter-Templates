/**
 * BusinessDash quizzes, rendered on this server — the HTMX way, like ./form.
 *
 * The quiz BD's hosted /quiz-invite page shows — one question at a time with
 * lettered choices, "I don't know" when the quiz offers it, the verdict and
 * why after each answer (or all at the end), a timer, the results — driven by
 * the SDK's own quiz engine (`createQuizController` from
 * `@businessdash/sdk/forms`). This file turns the engine's view into HTML with
 * the SDK's `bd-quiz__*` classes; the grading, the clock and the wording are
 * the engine's.
 *
 *   /quiz               BD_QUIZ (a practice quiz), or the bundled sample
 *   /quiz/<slug>        any practice quiz ("Practice on your site" in BD)
 *   /quiz/sample        the sample: graded here, never sent anywhere
 *   /quiz-invite/<t>    an invitation. BD's invite emails link here when the
 *                       quiz's invite domain (in the builder) is this site.
 *
 * A run lives on this server between requests — its controller holds the
 * answers, the verdicts and the clock, and a timed quiz submits itself at
 * zero even if the page is closed. The page carries the run's id. Answers
 * post on change, buttons post their action, and a running clock is re-read
 * once a second. Without JavaScript it's plain form posts (the clock shows
 * the time at each page).
 */

import { BdApiError } from "@businessdash/sdk";
import {
	createQuizController,
	type CreateQuizControllerOptions,
	invitationQuizBackend,
	type QuizAction,
	type QuizController,
	type QuizFeedbackView,
	type QuizField,
	type QuizPageView,
	type QuizQuestionView,
	type QuizView,
	practiceQuizBackend,
	quizInvitationPage,
	quizOptionsFromInvitation,
	quizOptionsFromPractice,
	quizPracticePage,
} from "@businessdash/sdk/forms";

import { getBd } from "./bd";
import sampleQuizJson from "./forms/demo-quiz.json";
import { html, raw, render, type Raw } from "./html";
import { page as documentPage } from "./layout";

// ── Where a quiz comes from ─────────────────────────────────────────

export const SAMPLE_QUIZ = "sample";

export type QuizSource =
	| { kind: "sample" }
	| { kind: "practice"; slug: string }
	| { kind: "invitation"; token: string };

/** `/quiz`: `BD_QUIZ` once BD is connected, else the sample. */
export function defaultQuizSource(): QuizSource {
	const slug = process.env["BD_QUIZ"];
	return getBd() && slug ? { kind: "practice", slug } : { kind: "sample" };
}

/** `/quiz/<slug>`. */
export function practiceSource(slug: string): QuizSource {
	return slug === SAMPLE_QUIZ ? { kind: "sample" } : { kind: "practice", slug };
}

/** Where a source's page and posts live. */
export function quizPath(source: QuizSource): string {
	switch (source.kind) {
		case "sample":
			return `/quiz/${SAMPLE_QUIZ}`;
		case "practice":
			return `/quiz/${encodeURIComponent(source.slug)}`;
		case "invitation":
			return `/quiz-invite/${encodeURIComponent(source.token)}`;
	}
}

function sourceKey(source: QuizSource): string {
	return source.kind === "sample" ? "sample" : source.kind === "practice" ? `practice:${source.slug}` : `invitation:${source.token}`;
}

/** The sample: answer keys and all, graded on this server. */
function sampleQuiz(): { page: QuizPageView; options: CreateQuizControllerOptions } {
	return {
		page: quizPracticePage({
			name: "Sample quiz",
			description:
				"Bundled with the starter and graded on this server. Set BD_QUIZ and your BD keys to take one of your practice quizzes.",
			estimatedMinutes: 2,
			timeLimitMinutes: 5,
		}),
		options: {
			fields: (sampleQuizJson as { fields: unknown[] }).fields as QuizField[],
			feedbackMode: "immediate",
			timeLimitMinutes: 5,
			allowDontKnow: true,
		},
	};
}

/** What the visitor's request brings to a quiz that needs their account. */
export type QuizVisitor = {
	/** The `bd_session` cookie: who's signed in, for invitations that need the invited account. */
	session: string | null;
	/** Where "Sign in" goes, coming back here. */
	signInHref: string;
	/** Where "Sign out and switch account" goes. */
	switchAccountHref: string;
};

type Loaded = { page: QuizPageView; options: CreateQuizControllerOptions | null };

const INVALID: QuizPageView = {
	header: null,
	gate: { kind: "invalid", title: null, body: "This quiz doesn't exist or isn't open.", action: null },
};

/** Read the quiz from BD (or the sample). A gate in `page` means there's nothing to take. */
async function loadQuiz(source: QuizSource, visitor: QuizVisitor): Promise<Loaded> {
	if (source.kind === "sample") return sampleQuiz();
	const bd = getBd();
	if (!bd) return { page: INVALID, options: null };
	try {
		if (source.kind === "practice") {
			const practice = await bd.quizzes.practice(source.slug);
			return {
				page: quizPracticePage(practice),
				options: { ...quizOptionsFromPractice(practice), backend: practiceQuizBackend(bd.quizzes, source.slug) },
			};
		}
		const quizzes = bd.quizzes.withSession(visitor.session);
		const invitation = await quizzes.invitation(source.token);
		const page = quizInvitationPage(invitation, {
			signInHref: visitor.signInHref,
			switchAccountHref: visitor.switchAccountHref,
		});
		if (page.gate) return { page, options: null };
		const { options, initial } = quizOptionsFromInvitation(invitation, { signInHref: visitor.signInHref });
		return { page, options: { ...options, initial, backend: invitationQuizBackend(quizzes, source.token) } };
	} catch (err) {
		// A 404 is a quiz that doesn't exist (or isn't open); anything else may pass.
		if (err instanceof BdApiError && err.status === 404) {
			return { page: source.kind === "invitation" ? quizInvitationPage(null) : INVALID, options: null };
		}
		throw err;
	}
}

// ── Runs ────────────────────────────────────────────────────────────

type Run = {
	id: string;
	key: string;
	path: string;
	page: QuizPageView;
	controller: QuizController;
	touched: number;
};

/** Runs in progress, oldest first. A run nobody has touched for 3 hours goes. */
const runs = new Map<string, Run>();
const RUN_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_RUNS = 500;

function sweep(now: number): void {
	for (const [id, run] of runs) {
		if (now - run.touched < RUN_TTL_MS && runs.size < MAX_RUNS) break;
		run.controller.destroy();
		runs.delete(id);
	}
}

function startRun(source: QuizSource, page: QuizPageView, options: CreateQuizControllerOptions): Run {
	const now = Date.now();
	sweep(now);
	const run: Run = {
		id: crypto.randomUUID(),
		key: sourceKey(source),
		path: quizPath(source),
		page,
		controller: createQuizController(options),
		touched: now,
	};
	runs.set(run.id, run);
	return run;
}

function findRun(id: string | null | undefined, source?: QuizSource): Run | null {
	const run = id ? runs.get(id) : undefined;
	if (!run || (source && run.key !== sourceKey(source))) return null;
	// Most recently used last, so the sweep takes the stalest first.
	runs.delete(run.id);
	run.touched = Date.now();
	runs.set(run.id, run);
	return run;
}

/** The cookie that brings a reload back to the same practice run. */
export const QUIZ_RUN_COOKIE = "bd_quiz_run";

export function quizRunCookie(id: string): string {
	return `${QUIZ_RUN_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${RUN_TTL_MS / 1000}`;
}

// ── Requests ────────────────────────────────────────────────────────

export type QuizResult = { body: Raw; title: string; setCookie?: string };

/**
 * The quiz's page content. A practice run or the sample picks up where this
 * browser left off (`runCookie`); an invitation is read from BD each time —
 * BD keeps its answers and clock.
 */
export async function renderQuizPage(source: QuizSource, visitor: QuizVisitor, runCookie: string | null): Promise<QuizResult> {
	if (source.kind !== "invitation") {
		const run = findRun(runCookie, source);
		if (run) return { body: quizHtml(run), title: titleOf(run.page) };
	}
	let loaded: Loaded;
	try {
		loaded = await loadQuiz(source, visitor);
	} catch (err) {
		console.error("[bd] quiz load failed:", err);
		return { body: statusHtml(quizPath(source), "We couldn't load this quiz.", true), title: "Quiz" };
	}
	if (!loaded.options) return { body: gateHtml(loaded.page), title: titleOf(loaded.page) };
	const run = startRun(source, loaded.page, loaded.options);
	return {
		body: quizHtml(run),
		title: titleOf(loaded.page),
		...(source.kind !== "invitation" ? { setCookie: quizRunCookie(run.id) } : {}),
	};
}

/** A post from the quiz: answers, and a button's action. */
export async function handleQuizPost(source: QuizSource, req: Request, visitor: QuizVisitor): Promise<QuizResult> {
	const form = await req.formData();
	const run = findRun(stringOf(form.get("_run")), source);
	// The run is gone (the server restarted, or it sat for hours): start again.
	if (!run) return renderQuizPage(source, visitor, null);
	applyAnswers(run.controller, form);
	const action = stringOf(form.get("_action"));
	if (action) await perform(run.controller, action);
	return { body: quizHtml(run), title: titleOf(run.page) };
}

/**
 * The clock, re-read: `/quiz-timer/<run>`, polled once a second while it
 * runs. Once the time is up the run submits itself, and this answers with the
 * whole quiz instead — sending, then the results (or why it couldn't send) —
 * morphed into the page. Status 286 tells htmx to stop asking: the run is gone.
 */
export function quizTimer(runId: string): Response {
	const run = findRun(runId);
	if (!run) return new Response(null, { status: 286 });
	run.controller.tick();
	const view = run.controller.getView();
	const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
	if (!view.timer || view.phase === "done" || run.controller.getState().timeUp) {
		return new Response(render(quizHtml(run)), {
			headers: { ...headers, "HX-Retarget": `#bd-quiz-${run.id}`, "HX-Reswap": "morph:{ignoreActiveValue:true}" },
		});
	}
	return new Response(render(html`${timerHtml(run, view)}`), { headers });
}

/** A quiz on a page of its own (also what a post returns without JavaScript). */
export function quizDocument(origin: string, result: QuizResult): Promise<string> {
	return documentPage({ origin, title: result.title, body: html`<div class="quiz-page">${result.body}</div>` });
}

function stringOf(value: FormDataEntryValue | null): string | null {
	return typeof value === "string" && value !== "" ? value : null;
}

/** "I don't know" on a single-answer question: a choice in the same group. */
const DONT_KNOW = "~dont-know";

/** Each answer the page showed (and didn't lock) → the controller, when it changed. */
function applyAnswers(controller: QuizController, form: FormData): void {
	for (const question of controller.getView().questions) {
		if (question.locked) continue;
		const id = question.field.id;
		if (form.get(`q.${id}.~`) === null) continue;
		const state = controller.getState();
		const wasDontKnow = state.dontKnow.includes(id);
		const current = state.answers[id];
		if (question.choices && question.multiple) {
			const picked = form.getAll(`q.${id}`).filter((v): v is string => typeof v === "string");
			const dontKnow = form.get(`q.${id}.dk`) !== null;
			const before = Array.isArray(current) ? current.map(String) : [];
			if (dontKnow && !wasDontKnow) controller.chooseDontKnow(id);
			else if (wasDontKnow && (picked.length > 0 || !dontKnow)) controller.setAnswer(id, picked);
			else if (!wasDontKnow && !sameMembers(picked, before)) controller.setAnswer(id, picked);
		} else if (question.choices) {
			const picked = stringOf(form.get(`q.${id}`));
			if (picked === DONT_KNOW) {
				if (!wasDontKnow) controller.chooseDontKnow(id);
			} else if (picked !== null && (wasDontKnow || picked !== current)) {
				controller.setAnswer(id, picked);
			}
		} else {
			const typed = form.get(`q.${id}`);
			const value = typeof typed === "string" ? typed : "";
			if (value !== (current == null ? "" : String(current))) controller.setAnswer(id, value);
		}
	}
}

function sameMembers(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((v) => b.includes(v));
}

/** A button: one of the view's actions, or "primary" (Enter in a box). */
async function perform(controller: QuizController, action: string): Promise<void> {
	const view = controller.getView();
	const chosen =
		action === "primary"
			? view.actions.find((a) => a.primary && a.enabled && !a.href)
			: view.actions.find((a) => a.id === action && a.enabled && !a.href);
	if (chosen) await controller.perform(chosen.id);
}

// ── Rendering ───────────────────────────────────────────────────────

function titleOf(page: QuizPageView): string {
	return page.header?.title || "Quiz";
}

function headerHtml(page: QuizPageView): Raw | "" {
	const h = page.header;
	if (!h) return "";
	return html`<header class="bd-quiz__header">
		<p class="bd-quiz__eyebrow">${h.eyebrow}</p>
		<h2 class="bd-quiz__title">${h.title}</h2>
		${h.description ? html`<p class="bd-quiz__description">${h.description}</p>` : ""}
		${h.facts.length ? html`<ul class="bd-quiz__facts">${h.facts.map((f) => html`<li>${f}</li>`)}</ul>` : ""}
	</header>`;
}

/** A quiz that can't be taken here and now: invalid, expired, closed, or needs another account. */
function gateHtml(page: QuizPageView): Raw {
	const gate = page.gate;
	return html`<div class="bd-quiz">
		${headerHtml(page)}
		${
			gate
				? html`<div class="bd-quiz__gate" data-kind="${gate.kind}">
						${gate.title ? html`<h3>${gate.title}</h3>` : ""}
						<p>${gate.body}</p>
						${
							gate.action?.href
								? html`<div class="bd-quiz__actions"><a class="bd-quiz__button bd-quiz__button--primary" href="${gate.action.href}">${gate.action.label}</a></div>`
								: ""
						}
					</div>`
				: ""
		}
	</div>`;
}

function statusHtml(path: string, text: string, retry: boolean): Raw {
	return html`<div class="bd-quiz"><div class="bd-quiz__status">
		<p>${text}</p>
		${retry ? html`<div class="bd-quiz__actions"><a class="bd-quiz__button" href="${path}">Try again</a></div>` : ""}
	</div></div>`;
}

/** The quiz: a form that posts its answers and buttons back here. */
function quizHtml(run: Run): Raw {
	const view = run.controller.getView();
	const primary = view.actions.find((a) => a.primary && a.enabled && !a.href);
	// The form posts its buttons and the div inside posts each change, as in
	// ./form: a change post never carries the last button clicked.
	return html`<form
		class="bd-quiz"
		id="bd-quiz-${run.id}"
		data-phase="${view.phase}"
		${view.busy ? raw(`aria-busy="true"`) : ""}
		method="post"
		action="${run.path}"
		novalidate
		hx-post="${run.path}"
		hx-trigger="submit"
		hx-target="this"
		hx-ext="morph"
		hx-swap="morph:{ignoreActiveValue:true}"
		hx-sync="this:replace"
	>
		<input type="hidden" name="_run" value="${run.id}" />
		${primary ? html`<button class="bd-quiz__default" type="submit" name="_action" value="primary" tabindex="-1" aria-hidden="true">${primary.label}</button>` : ""}
		${headerHtml(run.page)}
		<div class="bd-quiz__live" hx-post="${run.path}" hx-trigger="change" hx-target="closest form" hx-sync="closest form:replace">
			${bodyHtml(run, view)}
		</div>
	</form>`;
}

function bodyHtml(run: Run, view: QuizView): Raw {
	if (view.phase === "empty") return html`<p class="bd-quiz__status">${view.empty ?? ""}</p>`;
	if (view.phase === "ready" && view.ready) {
		return html`<div class="bd-quiz__ready" data-icon="${view.ready.icon}">
			<h3>${view.ready.title}</h3>
			<p>${view.ready.body}</p>
			${actionsHtml(view)}
			${view.error ? html`<p class="bd-quiz__error" role="alert">${view.error}</p>` : ""}
		</div>`;
	}
	if (view.phase === "done" && view.done) {
		const done = view.done;
		if (done.kind !== "results") {
			return html`<div class="bd-quiz__done" data-kind="${done.kind}">
				<p class="bd-quiz__eyebrow">${done.eyebrow}</p>
				<h3>${done.title}</h3>
				<p>${done.body}</p>
				${actionsHtml(view)}
			</div>`;
		}
		return html`<section class="bd-quiz__results"${done.passed === true ? raw(" data-passed") : ""}>
				<p class="bd-quiz__eyebrow">${done.eyebrow}</p>
				<p class="bd-quiz__score">${done.score}</p>
				${done.tally ? html`<p class="bd-quiz__tally">${done.tally}</p>` : ""}
				<p class="bd-quiz__summary">${done.summary}</p>
				${done.message ? html`<p class="bd-quiz__message">${done.message}</p>` : ""}
				${done.timing ? html`<p class="bd-quiz__timing">${done.timing}</p>` : ""}
			</section>
			<ol class="bd-quiz__review">${done.items.map(
				(item) => html`<li data-tone="${item.tone}">
					<details class="bd-quiz__review-item">
						<summary class="bd-quiz__review-label"><span class="bd-quiz__number">${item.number}.</span>${item.label}<span class="bd-quiz__badge" data-tone="${item.feedback.badge.tone}">${item.feedback.badge.label}</span></summary>
						${feedbackHtml(item.feedback)}
					</details>
				</li>`,
			)}</ol>
			${actionsHtml(view)}`;
	}
	return html`${view.timer ? timerHtml(run, view) : ""}
		${
			view.progress
				? html`<div class="bd-quiz__progress">
					<div class="bd-quiz__progress-row"><span>${view.progress.position}</span>${view.progress.note ? html`<span>${view.progress.note}</span>` : ""}</div>
					<div class="bd-quiz__progress-bar" aria-hidden="true"><span style="width:${view.progress.percent}%"></span></div>
				</div>`
				: ""
		}
		${view.notice ? html`<p class="bd-quiz__notice">${view.notice}</p>` : ""}
		${view.questions.map((q) => questionHtml(q, view))}
		${view.feedback ? feedbackHtml(view.feedback) : ""}
		${view.error ? html`<p class="bd-quiz__error" role="alert">${view.error}</p>` : ""}
		${actionsHtml(view)}`;
}

/**
 * The clock. While it runs — and after time's up, until the quiz has sent —
 * htmx re-reads it once a second (`quizTimer`).
 */
function timerHtml(run: Run, view: QuizView): Raw | "" {
	const timer = view.timer;
	if (!timer) return "";
	const state = run.controller.getState();
	const polling = !state.timeUp || state.pending !== null;
	return html`<div
		class="bd-quiz__timer"
		id="bd-quiz-timer-${run.id}"
		${timer.warning ? raw("data-warning") : ""}
		${timer.paused ? raw("data-paused") : ""}
		role="timer"
		${polling ? raw(`hx-get="/quiz-timer/${run.id}" hx-trigger="every 1s" hx-target="this" hx-swap="outerHTML" hx-sync="this:drop"`) : ""}
	>
		<span class="bd-quiz__timer-label">${timer.label}${timer.paused ? html`<span class="bd-quiz__paused">${timer.pausedLabel}</span>` : ""}</span>
		<span class="bd-quiz__timer-value">${timer.value}</span>
		${timer.progress !== null ? html`<span class="bd-quiz__timer-bar" style="width:${timer.progress}%"></span>` : ""}
	</div>`;
}

function actionsHtml(view: QuizView): Raw | "" {
	if (!view.actions.length) return "";
	return html`<div class="bd-quiz__actions">${view.actions.map(actionHtml)}</div>`;
}

function actionHtml(action: QuizAction): Raw {
	const cls = `bd-quiz__button${action.primary ? " bd-quiz__button--primary" : ""}`;
	if (action.href) return html`<a class="${cls}" href="${action.href}" data-quiz-action="${action.id}">${action.label}</a>`;
	return html`<button class="${cls}" type="submit" name="_action" value="${action.id}"${action.enabled ? "" : raw(" disabled")} data-quiz-action="${action.id}">${action.label}</button>`;
}

const INPUT_TYPES: Record<string, string> = {
	email: "email",
	url: "url",
	phone: "tel",
	tel: "tel",
	number: "number",
	date: "date",
	time: "time",
};

function questionHtml(question: QuizQuestionView, view: QuizView): Raw {
	const field = question.field;
	const base = `bd-quiz-${field.id}`;
	const labelId = `${base}-label`;
	const errorId = `${base}-error`;
	const locked = question.locked ? raw(" disabled") : "";
	const invalid = question.error ? raw(` aria-invalid="true" aria-describedby="${errorId}"`) : "";
	let answer: Raw;
	if (question.choices) {
		const type = question.multiple ? "checkbox" : "radio";
		const choice = (state: string, selected: boolean, letter: string, label: string, name: string, value: string, extra = "") =>
			html`<label class="bd-quiz__choice${extra}" data-state="${state}"${question.locked ? raw(" data-locked") : ""}>
				<input class="bd-visually-hidden" type="${type}" name="${name}" value="${value}"${selected ? raw(" checked") : ""}${locked} />
				<span class="bd-quiz__letter" aria-hidden="true">${letter}</span>
				<span class="bd-quiz__choice-label">${label}</span>
			</label>`;
		const dk = question.dontKnow;
		answer = html`<div class="bd-quiz__choices" role="${question.multiple ? "group" : "radiogroup"}" aria-labelledby="${labelId}"${invalid}>
			${question.choices.map((c) => choice(c.state, c.selected, c.letter, c.label, `q.${field.id}`, c.label))}
			${
				dk
					? choice(
							dk.state,
							dk.selected,
							"?",
							dk.label,
							question.multiple ? `q.${field.id}.dk` : `q.${field.id}`,
							question.multiple ? "1" : DONT_KNOW,
							" bd-quiz__choice--dont-know",
						)
					: ""
			}
		</div>`;
	} else {
		const value = question.value == null ? "" : String(question.value);
		const common = raw(`class="bd-quiz__input" id="${base}" name="q.${field.id}"`);
		if (field.type === "textarea" || field.type === "long_text") {
			answer = html`<textarea ${common} aria-labelledby="${labelId}"${invalid}${locked}>${value}</textarea>`;
		} else if (field.type === "select") {
			answer = html`<select ${common} aria-labelledby="${labelId}"${invalid}${locked}>
				<option value="">${field.placeholder || "Choose…"}</option>
				${(field.options ?? []).map((o) => html`<option value="${o}"${o === value ? raw(" selected") : ""}>${o}</option>`)}
			</select>`;
		} else {
			answer = html`<input ${common} type="${INPUT_TYPES[field.type] ?? "text"}" value="${value}"${field.placeholder ? html` placeholder="${field.placeholder}"` : ""} aria-labelledby="${labelId}"${invalid}${locked} />`;
		}
	}
	return html`<fieldset class="bd-quiz__question" data-field-id="${field.id}" data-bd-type="${field.type}">
		<legend class="bd-quiz__label" id="${labelId}">${view.phase === "all" ? html`<span class="bd-quiz__number">${question.number}.</span>` : ""}${question.label}</legend>
		<input type="hidden" name="q.${field.id}.~" value="1" />
		${answer}
		${question.error ? html`<p class="bd-quiz__field-error" id="${errorId}" role="alert">${question.error}</p>` : ""}
	</fieldset>`;
}

function explainedHtml(items: Array<{ option: string; explanation: string }>): Raw {
	return html`<ul class="bd-quiz__explained">${items.map((i) => html`<li><strong>${i.option}</strong><span>${i.explanation}</span></li>`)}</ul>`;
}

function feedbackHtml(feedback: QuizFeedbackView): Raw {
	return html`<div class="bd-quiz__feedback" data-field-id="${feedback.fieldId}" role="status">
		<div class="bd-quiz__feedback-row">
			<span class="bd-quiz__badge" data-tone="${feedback.badge.tone}">${feedback.badge.label}</span>
			${feedback.accuracy ? html`<span class="bd-quiz__accuracy">${feedback.accuracy}</span>` : ""}
		</div>
		<div class="bd-quiz__answers">
			<div class="bd-quiz__answer"><p class="bd-quiz__small">${feedback.answerLabel}</p><p>${feedback.answer}</p></div>
			${
				feedback.accepted
					? html`<div class="bd-quiz__answer bd-quiz__answer--accepted"><p class="bd-quiz__small">${feedback.acceptedLabel}</p><p>${feedback.accepted}</p></div>`
					: ""
			}
		</div>
		${feedback.why ? html`<div class="bd-quiz__why"><p class="bd-quiz__small">${feedback.whyLabel}</p><p>${feedback.why}</p></div>` : ""}
		${feedback.selected.length ? explainedHtml(feedback.selected) : ""}
		${
			feedback.others
				? html`<details class="bd-quiz__others"><summary>${feedback.others.label}</summary>${explainedHtml(feedback.others.items)}</details>`
				: ""
		}
	</div>`;
}
