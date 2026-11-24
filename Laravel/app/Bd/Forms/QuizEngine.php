<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * Quizzes: the forms engine taking a graded assessment. A port of forms-core's
 * `quiz.ts` (by way of the Swift SDK's `BdQuizEngine`).
 *
 * Everything here is pure: a `QuizState` in, a new one out (never changed in
 * place), and `screen` turns it into exactly what a page shows, texts
 * included. `QuizController` adds BD's calls and the clock.
 *
 * A step that needs BD comes back as `['lock', $state, $fieldId, $answer]` or
 * `['submit', $state, $answers]`; one that doesn't as `['none', $state]`.
 */
final class QuizEngine
{
    private const ISO_INSTANT = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\z/';

    /** Epoch ms from BD's number or ISO 8601 instant. */
    public static function timestamp(mixed $value): ?float
    {
        if (Json::isNumber($value)) {
            return is_finite((float) $value) ? (float) $value : null;
        }
        if (! is_string($value) || ! preg_match(self::ISO_INSTANT, $value)) {
            return null;
        }
        $ms = Dates::parseInstant($value);

        return $ms === null ? null : round($ms);
    }

    /**
     * Where a run starts: at the first question not yet locked, with what BD
     * kept (answers, verdicts, the clock).
     *
     * @param  array{answers?: array, results?: list<stdClass>, completion?: ?stdClass, startedAt?: mixed, deadlineAt?: mixed, serverNow?: ?float, dontKnow?: list<string>}  $initial
     */
    public static function initialState(QuizConfig $config, array $initial, float $now): QuizState
    {
        $results = $initial['results'] ?? [];
        $locked = array_map(fn ($r) => $r->fieldId ?? null, $results);
        $count = count($config->questions);
        $firstOpen = null;
        foreach ($config->questions as $i => $q) {
            if (! in_array($q->id, $locked, true)) {
                $firstOpen = $i;
                break;
            }
        }
        $allLocked = $count > 0 && $firstOpen === null;
        $serverNow = $initial['serverNow'] ?? null;

        return new QuizState(
            index: $allLocked ? $count - 1 : ($firstOpen ?? 0),
            answers: $initial['answers'] ?? [],
            dontKnow: $initial['dontKnow'] ?? [],
            results: $results,
            revealed: $config->feedbackMode === 'immediate' && $allLocked,
            completion: $initial['completion'] ?? null,
            startedAt: self::timestamp($initial['startedAt'] ?? null),
            deadlineAt: self::timestamp($initial['deadlineAt'] ?? null),
            clockOffset: $serverNow !== null ? $serverNow - $now : 0.0,
        );
    }

    /** BD's clock: this server's, corrected by the offset BD reported. */
    public static function clock(QuizState $state, float $now): float
    {
        return $now + $state->clockOffset;
    }

    private static function busy(QuizState $state): bool
    {
        return $state->pending !== null || $state->completion !== null;
    }

    private static function isLocked(QuizConfig $config, QuizState $state, string $fieldId): bool
    {
        return $config->feedbackMode === 'immediate' && $state->result($fieldId) !== null;
    }

    private static function emptyAnswer(Field $field): mixed
    {
        return QuizArrange::isMultiSelect($field) ? [] : '';
    }

    public static function setAnswer(QuizConfig $config, QuizState $state, string $fieldId, mixed $value): QuizState
    {
        if (self::busy($state) || self::isLocked($config, $state, $fieldId) || $config->question($fieldId) === null) {
            return $state;
        }
        $next = clone $state;
        $next->answers[$fieldId] = $value;
        $next->dontKnow = array_values(array_filter($state->dontKnow, fn ($id) => $id !== $fieldId));
        unset($next->fieldErrors[$fieldId]);
        $next->error = null;

        return $next;
    }

    public static function offersDontKnow(QuizConfig $config, Field $field): bool
    {
        return $config->allowDontKnow && QuizArrange::isMultipleChoice($field) && ! $field->required;
    }

    public static function chooseDontKnow(QuizConfig $config, QuizState $state, string $fieldId): QuizState
    {
        $field = $config->question($fieldId);
        if ($field === null || ! self::offersDontKnow($config, $field) || self::busy($state) || self::isLocked($config, $state, $fieldId)) {
            return $state;
        }
        $next = clone $state;
        $next->answers[$fieldId] = self::emptyAnswer($field);
        $next->dontKnow = [...array_values(array_filter($state->dontKnow, fn ($id) => $id !== $fieldId)), $fieldId];
        unset($next->fieldErrors[$fieldId]);
        $next->error = null;

        return $next;
    }

    /** @param  list<Field>  $fields  @return array<string, string> */
    public static function missing(QuizConfig $config, QuizState $state, array $fields): array
    {
        $errors = [];
        foreach ($fields as $field) {
            if ($field->required && Rules::isEmpty($field, $state->answers[$field->id] ?? null)) {
                $errors[$field->id] = QuizWords::fill($config->words->required, ['label' => $field->label === '' ? 'This question' : $field->label]);
            }
        }

        return $errors;
    }

    /** The primary button: check (or lock) the answer, move on, or submit. */
    public static function advance(QuizConfig $config, QuizState $state, float $now): array
    {
        if (self::busy($state) || ($config->timerEnabled && $state->startedAt === null)) {
            return ['none', $state];
        }
        $count = count($config->questions);
        if ($state->index < 0 || $state->index >= $count) {
            return ['none', $state];
        }
        $question = $config->questions[$state->index];
        $last = $state->index >= $count - 1;

        if ($config->feedbackMode === 'immediate') {
            if ($state->revealed) {
                $resumed = self::endRevealPause($state, $now);
                if ($last) {
                    $resumed = clone $resumed;
                    $resumed->pending = 'submit';
                    $resumed->error = null;

                    return ['submit', $resumed, $state->answers];
                }
                $resumed = clone $resumed;
                $resumed->index = $state->index + 1;
                $resumed->revealed = false;

                return ['none', $resumed];
            }
            $errors = self::missing($config, $state, [$question]);
            $next = clone $state;
            if ($errors !== []) {
                $next->fieldErrors = $errors;

                return ['none', $next];
            }
            $next->pending = 'lock';
            $next->error = null;
            $next->fieldErrors = [];
            $answer = $state->answers[$question->id] ?? null;

            return ['lock', $next, $question->id, $answer ?? self::emptyAnswer($question)];
        }

        $checking = $config->layout === 'all' ? $config->questions : [$question];
        $errors = self::missing($config, $state, $checking);
        $next = clone $state;
        if ($errors !== []) {
            $next->fieldErrors = $errors;

            return ['none', $next];
        }
        $next->fieldErrors = [];
        $next->error = null;
        if ($config->layout === 'single' && ! $last) {
            $next->index = $state->index + 1;

            return ['none', $next];
        }
        $next->pending = 'submit';

        return ['submit', $next, $state->answers];
    }

    public static function back(QuizConfig $config, QuizState $state): QuizState
    {
        if (self::busy($state) || $config->feedbackMode !== 'end' || $config->layout !== 'single' || $state->index <= 0) {
            return $state;
        }
        $next = clone $state;
        $next->index--;
        $next->fieldErrors = [];
        $next->error = null;

        return $next;
    }

    /** @param  array{startedAt: mixed, deadlineAt: mixed, serverNow: float}  $info */
    public static function started(QuizState $state, array $info, float $now): QuizState
    {
        $next = clone $state;
        $next->pending = null;
        $next->error = null;
        $next->clockOffset = $info['serverNow'] - $now;
        $next->startedAt = self::timestamp($info['startedAt']);
        $next->deadlineAt = self::timestamp($info['deadlineAt'] ?? null);

        return $next;
    }

    /** A start with no BD to ask: the clock starts now. */
    public static function localStart(QuizConfig $config, float $now): array
    {
        return [
            'startedAt' => $now,
            'deadlineAt' => $config->timeLimitMinutes !== null ? $now + $config->timeLimitMinutes * 60_000 : null,
            'serverNow' => $now,
        ];
    }

    public static function locked(QuizConfig $config, QuizState $state, string $fieldId, mixed $answer, stdClass $result, float $now): QuizState
    {
        $next = clone $state;
        $next->pending = null;
        $next->error = null;
        $next->answers[$fieldId] = $answer;
        $next->results = [...array_values(array_filter($state->results, fn ($r) => ($r->fieldId ?? null) !== $fieldId)), $result];
        $next->revealed = true;
        if ($config->local) {
            $next->revealStartedAt = self::clock($state, $now);
        }

        return $next;
    }

    /** A local run's clock stops while a verdict shows: count the pause. */
    public static function endRevealPause(QuizState $state, float $now): QuizState
    {
        if ($state->revealStartedAt === null) {
            return $state;
        }
        $next = clone $state;
        $next->pausedMs += max(0, self::clock($state, $now) - $state->revealStartedAt);
        $next->revealStartedAt = null;

        return $next;
    }

    public static function completed(QuizState $state, stdClass $completion): QuizState
    {
        $next = clone $state;
        $next->pending = null;
        $next->error = null;
        $next->completion = $completion;

        return $next;
    }

    public static function failed(QuizState $state, string $message): QuizState
    {
        $next = clone $state;
        $next->pending = null;
        $next->error = $message;

        return $next;
    }

    /** @return array{bool, ?float} [timed out, duration in seconds] */
    public static function localTiming(QuizState $state, float $now): array
    {
        $clock = self::clock($state, $now);

        return [
            $state->deadlineAt !== null && $clock >= $state->deadlineAt + $state->pausedMs,
            $state->startedAt !== null ? max(0, floor(($clock - $state->startedAt) / 1000 + 0.5)) : null,
        ];
    }

    /** Grade here: a quiz that carries its answer keys (the sample). */
    public static function localCompletion(QuizConfig $config, QuizState $state, array $answers, float $now): stdClass
    {
        $completion = QuizScoring::score($config->questions, $answers, $config->passingScore);
        [$completion->timedOut, $completion->durationSeconds] = self::localTiming($state, $now);

        return $completion;
    }

    public static function localResult(QuizConfig $config, string $fieldId, mixed $answer): ?stdClass
    {
        $field = $config->question($fieldId);
        if ($field === null) {
            return null;
        }

        return QuizScoring::score([$field], [$fieldId => $answer], $config->passingScore)->results[0] ?? null;
    }

    private static function revealPauseNow(QuizConfig $config, QuizState $state, float $now): float
    {
        if (! $config->local || $state->revealStartedAt === null) {
            return 0.0;
        }

        return max(0, self::clock($state, $now) - $state->revealStartedAt);
    }

    /** The deadline, pushed out by a local run's pauses. */
    public static function effectiveDeadline(QuizConfig $config, QuizState $state, float $now): ?float
    {
        if ($state->deadlineAt === null) {
            return null;
        }

        return $config->local ? $state->deadlineAt + $state->pausedMs + self::revealPauseNow($config, $state, $now) : $state->deadlineAt;
    }

    public static function deadlinePassed(QuizConfig $config, QuizState $state, float $now): bool
    {
        $deadline = self::effectiveDeadline($config, $state, $now);

        return $deadline !== null && self::clock($state, $now) >= $deadline
            && $state->completion === null && $state->pending === null && ! $state->timeUp;
    }

    public static function timeUp(QuizState $state): QuizState
    {
        $next = clone $state;
        $next->timeUp = true;
        $next->pending = 'submit';
        $next->error = null;

        return $next;
    }

    // ── Display helpers ─────────────────────────────────────────────────────

    /** 75 → "1:15"; 3725 → "1:02:05". */
    public static function durationLabel(float $totalSeconds): string
    {
        $seconds = max(0, (int) floor($totalSeconds));
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $rest = $seconds % 60;
        $pad = fn (int $n) => $n < 10 ? "0{$n}" : (string) $n;

        return $hours > 0 ? "{$hours}:{$pad($minutes)}:{$pad($rest)}" : "{$minutes}:{$pad($rest)}";
    }

    private const ANSWER_PART_ORDER = [
        'prefix', 'first', 'middle', 'last', 'suffix', 'nicknames', 'full', 'short',
        'line1', 'line2', 'city', 'state', 'zip', 'country', 'value', 'unit', 'url', 'start', 'end',
    ];

    /** An answer as a sentence: "Paris", "7, 11", "Yes", or "No answer". */
    public static function answerText(mixed $value, QuizWords $words = new QuizWords): string
    {
        if (Json::isList($value)) {
            return $value === [] ? $words->noAnswer : implode(', ', array_map(fn ($v) => self::answerText($v, $words), $value));
        }
        if ($value === null || $value === '') {
            return $words->noAnswer;
        }
        if (is_bool($value)) {
            return $value ? $words->yes : $words->no;
        }
        if ($value instanceof stdClass) {
            $o = get_object_vars($value);
            $known = array_values(array_filter(self::ANSWER_PART_ORDER, fn ($k) => array_key_exists($k, $o)));
            $rest = array_values(array_filter(array_map('strval', array_keys($o)), fn ($k) => ! in_array($k, self::ANSWER_PART_ORDER, true)));
            sort($rest, SORT_STRING);
            $parts = [];
            foreach ([...$known, ...$rest] as $key) {
                $v = $o[$key];
                if (is_string($v) && Js::trim($v) !== '') {
                    $parts[] = $v;
                } elseif (Json::isNumber($v)) {
                    $parts[] = Js::string($v);
                }
            }

            return $parts === [] ? $words->noAnswer : implode(', ', $parts);
        }
        $text = Js::trim(Js::stripTags(Js::string($value)));

        return $text === '' ? $words->noAnswer : $text;
    }

    /** A percentage as a whole number, rounded as JavaScript rounds. */
    public static function percent(float $value): int
    {
        return (int) floor($value + 0.5);
    }

    // ── The screen ──────────────────────────────────────────────────────────

    private static function badge(QuizWords $w, stdClass $result, bool $dontKnow): array
    {
        if ($dontKnow && $result->status !== 'correct') {
            return ['label' => $w->dontKnow, 'tone' => 'unsure'];
        }

        return match ($result->status) {
            'correct' => ['label' => $w->correct, 'tone' => 'correct'],
            'partially_correct' => ['label' => $w->partiallyCorrect, 'tone' => 'partial'],
            'pending_ai' => ['label' => $w->pendingAi, 'tone' => 'pending'],
            'unscored' => ['label' => $w->unscored, 'tone' => 'unscored'],
            default => ['label' => $w->incorrect, 'tone' => 'incorrect'],
        };
    }

    /** The verdict card for one question. */
    public static function feedback(QuizWords $w, stdClass $result, bool $dontKnow = false): array
    {
        $answer = $result->answer ?? null;
        $unanswered = $answer === null || $answer === '' || $answer === [];
        $rationale = $result->rationale ?? null;
        $picked = [];
        foreach (Json::list($rationale->selectedOptions ?? null) ?? [] as $o) {
            if (is_string($o->explanation ?? null)) {
                $picked[] = ['option' => $o->option, 'explanation' => $o->explanation];
            }
        }
        $others = [];
        foreach (Json::list($rationale->optionExplanations ?? null) ?? [] as $o) {
            if (($o->accepted ?? false) !== true && is_string($o->explanation ?? null)) {
                $others[] = ['option' => $o->option, 'explanation' => $o->explanation];
            }
        }
        $accuracy = Json::num($result->accuracyPercent ?? null);
        $accepted = Json::strings($result->correctAnswers ?? null);

        return [
            'fieldId' => $result->fieldId,
            'label' => $result->label,
            'badge' => self::badge($w, $result, $dontKnow),
            'accuracy' => $accuracy === null ? null : QuizWords::fill($w->accurate, ['percent' => (string) self::percent($accuracy)]),
            'answerLabel' => $w->yourAnswer,
            'answer' => $dontKnow && $unanswered ? $w->dontKnow : self::answerText($answer, $w),
            'acceptedLabel' => $w->acceptedAnswer,
            'accepted' => $accepted === [] ? null : implode(' · ', $accepted),
            'whyLabel' => $unanswered ? $w->whyAccepted : $w->why,
            'why' => Json::str($rationale->explanation ?? null),
            'selected' => count($picked) > 1 ? $picked : [],
            'others' => $others === [] ? null : ['label' => $w->whyOthers, 'items' => $others],
        ];
    }

    public static function timer(QuizConfig $config, QuizState $state, float $now): ?array
    {
        if (! $config->timerEnabled || $state->startedAt === null) {
            return null;
        }
        $clock = self::clock($state, $now);
        $deadline = self::effectiveDeadline($config, $state, $now);
        $progress = null;
        if ($deadline !== null) {
            $seconds = (int) max(0, ceil(($deadline - $clock) / 1000));
            // Against the time allowed, not the stretched deadline: a local
            // run's pauses push the deadline out, and the bar holds still.
            $allowed = ($state->deadlineAt ?? $state->startedAt) - $state->startedAt;
            $progress = $allowed > 0 ? max(0, min(100, (($deadline - $clock) / $allowed) * 100)) : 0.0;
        } else {
            $seconds = (int) max(0, floor(($clock - $state->startedAt) / 1000));
        }

        return [
            'label' => $deadline !== null ? $config->words->timeRemaining : $config->words->elapsedTime,
            'value' => self::durationLabel($seconds),
            'seconds' => $seconds,
            'countdown' => $deadline !== null,
            'warning' => $deadline !== null && $seconds <= 60,
            'paused' => $config->local && $deadline !== null && $state->revealed,
            'pausedLabel' => $config->words->paused,
            'progress' => $progress,
        ];
    }

    private static function choices(Field $field, mixed $value, ?stdClass $result): array
    {
        $picked = array_map(fn ($v) => Js::string($v), Json::isList($value) ? $value : [$value]);
        $scored = Json::strings($result?->correctAnswers ?? null) !== [];
        $out = [];
        foreach (QuizScoring::optionLabels($field) as $index => $label) {
            $selected = in_array($label, $picked, true);
            $state = $selected ? 'selected' : 'idle';
            if ($result !== null) {
                $state = match (true) {
                    $scored && QuizScoring::isAcceptedLabel($result, $label) => 'correct',
                    $selected => $scored ? 'incorrect' : 'selected',
                    default => 'dimmed',
                };
            }
            $out[] = ['letter' => QuizArrange::choiceLetter($index), 'label' => $label, 'selected' => $selected, 'state' => $state];
        }

        return $out;
    }

    private static function question(QuizConfig $config, QuizState $state, Field $field, int $index): array
    {
        $value = $state->answers[$field->id] ?? null;
        $result = $config->feedbackMode === 'immediate' ? $state->result($field->id) : null;
        $chosen = in_array($field->id, $state->dontKnow, true);

        return [
            'field' => $field,
            'number' => $index + 1,
            'label' => $field->label,
            'value' => $value,
            'error' => $state->fieldErrors[$field->id] ?? null,
            'locked' => $result !== null || self::busy($state),
            'choices' => QuizArrange::isMultipleChoice($field) ? self::choices($field, $value, $result) : null,
            'multiple' => QuizArrange::isMultiSelect($field),
            'dontKnow' => self::offersDontKnow($config, $field) ? [
                'label' => $config->words->dontKnow,
                'selected' => $chosen,
                'state' => $result !== null ? ($chosen ? 'incorrect' : 'dimmed') : ($chosen ? 'selected' : 'idle'),
            ] : null,
        ];
    }

    private static function answered(QuizConfig $config, QuizState $state): int
    {
        return count(array_filter(
            $config->questions,
            fn (Field $q) => ! Rules::isEmpty($q, $state->answers[$q->id] ?? null) || in_array($q->id, $state->dontKnow, true),
        ));
    }

    private static function resultsMessage(QuizWords $w, int $percent): string
    {
        return match (true) {
            $percent >= 90 => $w->messageExcellent,
            $percent >= 75 => $w->messageSolid,
            $percent >= 50 => $w->messageGettingThere,
            default => $w->messageKeepGoing,
        };
    }

    private static function done(QuizConfig $config, QuizState $state, stdClass $completion): array
    {
        $w = $config->words;
        if (! $config->showScore) {
            return ['kind' => 'submitted', 'eyebrow' => $w->submittedEyebrow, 'title' => $w->submittedTitle, 'body' => $w->submittedBody];
        }
        if ($config->resultsLocked) {
            return ['kind' => 'locked', 'eyebrow' => $w->lockedEyebrow, 'title' => $w->lockedTitle, 'body' => $w->lockedBody];
        }
        $results = Json::list($completion->results ?? null) ?? [];
        $score = self::percent(Json::num($completion->scorePercent ?? null) ?? Json::num($completion->provisionalScorePercent ?? null) ?? 0.0);
        $scorable = array_values(array_filter($results, fn ($r) => (Json::num($r->pointsPossible ?? null) ?? 0) > 0));
        $correct = count(array_filter($scorable, fn ($r) => $r->status === 'correct'));
        $pending = ($completion->status ?? null) === 'pending_ai_review';
        $timedOut = ($completion->timedOut ?? null) === true;
        $duration = Json::num($completion->durationSeconds ?? null);
        $timing = null;
        if ($timedOut || $duration !== null) {
            $label = $timedOut ? $w->timeLimitReached : $w->completed;
            $timing = $duration !== null ? QuizWords::fill($w->inDuration, ['label' => $label, 'duration' => self::durationLabel($duration)]) : $label;
        }
        $passed = Json::bool($completion->passed ?? null);
        $items = [];
        foreach ($results as $index => $result) {
            $card = self::feedback($w, $result, in_array($result->fieldId, $state->dontKnow, true));
            $items[] = ['number' => $index + 1, 'label' => $result->label, 'tone' => $card['badge']['tone'], 'feedback' => $card];
        }

        return [
            'kind' => 'results',
            'eyebrow' => $w->resultsEyebrow,
            'score' => "{$score}%",
            'tally' => $scorable === [] ? null : QuizWords::fill($w->tally, ['correct' => (string) $correct, 'total' => (string) count($scorable)]),
            'summary' => $pending ? $w->provisional : ($passed === true ? $w->passed : $w->notPassed),
            'message' => $pending ? null : self::resultsMessage($w, $score),
            'timing' => $timing,
            'passed' => $passed,
            'items' => $items,
        ];
    }

    private static function action(string $id, string $label, bool $enabled, bool $primary, ?string $href = null): array
    {
        return ['id' => $id, 'label' => $label, 'enabled' => $enabled, 'primary' => $primary, 'href' => $href];
    }

    /**
     * Exactly what the quiz shows now: `phase` (empty, ready, question, all,
     * feedback, done) and the parts that phase draws, texts included.
     */
    public static function screen(QuizConfig $config, QuizState $state, float $now): array
    {
        $w = $config->words;
        $view = [
            'phase' => 'empty', 'empty' => null, 'ready' => null, 'timer' => null, 'progress' => null,
            'notice' => null, 'questions' => [], 'feedback' => null, 'done' => null, 'actions' => [],
            'error' => $state->error, 'busy' => $state->pending !== null,
        ];
        $count = count($config->questions);

        if ($state->completion !== null) {
            $done = self::done($config, $state, $state->completion);
            $isLocked = $done['kind'] === 'locked';
            if ($isLocked && $config->signInHref !== null) {
                $view['actions'][] = self::action('signIn', $w->lockedAction, true, true, $config->signInHref);
            }
            if ($config->canRestart) {
                $view['actions'][] = self::action('retake', $w->retake, true, ! $isLocked);
            }
            $view['phase'] = 'done';
            $view['done'] = $done;

            return $view;
        }

        if ($count === 0) {
            $view['empty'] = $w->empty;

            return $view;
        }

        if ($config->timerEnabled && $state->startedAt === null) {
            $body = match ($config->timeLimitMinutes) {
                null => $w->readyElapsed,
                1 => $w->readyLimitOne,
                default => QuizWords::fill($w->readyLimitMany, ['minutes' => (string) $config->timeLimitMinutes]),
            };
            $view['phase'] = 'ready';
            $view['ready'] = ['icon' => $config->timeLimitMinutes !== null ? 'hourglass' : 'clock', 'title' => $w->readyTitle, 'body' => $body];
            $view['actions'] = [self::action('start', $state->pending === 'start' ? $w->starting : $w->start, $state->pending === null, true)];

            return $view;
        }

        $view['timer'] = self::timer($config, $state, $now);
        $idle = $state->pending === null;
        $submit = self::action('submit', $state->pending === 'submit' ? $w->submitting : $w->submit, $idle, true);

        if ($config->feedbackMode === 'end' && $config->layout === 'all') {
            $done = self::answered($config, $state);
            $view['phase'] = 'all';
            $view['progress'] = [
                'position' => QuizWords::fill($w->answeredOf, ['answered' => (string) $done, 'total' => (string) $count]),
                'note' => null,
                'percent' => $done / $count * 100,
            ];
            $view['notice'] = $config->showScore ? $w->endNotice : $w->endNoticeHidden;
            foreach ($config->questions as $i => $q) {
                $view['questions'][] = self::question($config, $state, $q, $i);
            }
            $view['actions'] = [$submit];

            return $view;
        }

        $index = min(max($state->index, 0), $count - 1);
        $field = $config->questions[$index];
        $last = $state->index >= $count - 1;
        $position = QuizWords::fill($w->questionOf, ['number' => (string) ($state->index + 1), 'total' => (string) $count]);

        if ($config->feedbackMode === 'immediate') {
            $result = $state->result($field->id);
            $showing = $state->revealed && $result !== null;
            $percent = max(($state->revealed ? count($state->results) : $state->index) / $count * 100, 4);
            $finishLabel = $config->showScore && ! $config->resultsLocked ? $w->seeResults : $w->finish;
            $view['phase'] = $showing ? 'feedback' : 'question';
            $view['progress'] = ['position' => $position, 'note' => $w->locksWhenChecked, 'percent' => (float) $percent];
            $view['questions'] = [self::question($config, $state, $field, $state->index)];
            $view['feedback'] = $showing ? self::feedback($w, $result, in_array($field->id, $state->dontKnow, true)) : null;
            $view['actions'] = $showing
                ? [self::action(
                    $last ? 'finish' : 'next',
                    $state->pending === 'submit' ? $w->submitting : ($last ? $finishLabel : $w->nextQuestion),
                    $idle, true,
                )]
                : [self::action(
                    'lock',
                    $state->pending === 'lock' ? $w->checking : ($config->local ? $w->checkAnswer : $w->lockAnswer),
                    $idle, true,
                )];

            return $view;
        }

        if ($state->index > 0) {
            $view['actions'][] = self::action('back', $w->back, $idle, false);
        }
        $view['actions'][] = $last ? $submit : self::action('next', $w->next, $idle, true);
        $view['phase'] = 'question';
        $view['progress'] = ['position' => $position, 'note' => null, 'percent' => (float) max($state->index / $count * 100, 4)];
        $view['notice'] = $config->showScore ? $w->endNotice : $w->endNoticeHidden;
        $view['questions'] = [self::question($config, $state, $field, $state->index)];

        return $view;
    }
}
