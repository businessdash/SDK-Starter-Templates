<?php

namespace App\Bd\Forms;

use Closure;
use stdClass;
use Throwable;

/**
 * A quiz run: the engine (`QuizEngine`) plus BD's calls and the clock. A
 * port of the Swift SDK's `BdQuizController`, run once per request: the
 * Livewire component rebuilds it from the run's seed and saved state, does
 * what the taker asked, and saves the state again.
 *
 * PHP has no clock of its own between requests, so the page's once-a-second
 * poll calls `tick`, which submits a timed quiz at zero. A closed page stops
 * the poll: an invitation's deadline is still BD's to enforce, and a practice
 * run simply ends unsent.
 */
final class QuizController
{
    public QuizConfig $config;

    public QuizState $state;

    public string $seed;

    public float $now;

    /** The answers BD last saved as a draft. */
    public array $lastDraft;

    private readonly bool $local;

    private readonly QuizOptions $options;

    private readonly Closure $clock;

    public function __construct(
        QuizOptions $options,
        private readonly ?QuizBackend $backend = null,
        array $initial = [],
        ?string $seed = null,
        ?QuizState $state = null,
        ?array $lastDraft = null,
        ?Closure $clock = null,
    ) {
        $this->local = $options->local ?? ($backend === null);
        $resolved = clone $options;
        $resolved->local = $this->local;
        $resolved->canRestart = $options->canRestart ?? $this->local;
        $this->options = $resolved;
        $this->clock = $clock ?? fn () => microtime(true) * 1000;
        $this->now = ($this->clock)();
        $this->seed = $seed ?? $options->seed ?? QuizArrange::randomSeed();
        $this->config = new QuizConfig($resolved, $this->seed);
        $this->state = $state ?? QuizEngine::initialState($this->config, $initial, $this->now);
        $this->lastDraft = $lastDraft ?? $this->state->answers;
    }

    public function screen(): array
    {
        return QuizEngine::screen($this->config, $this->state, $this->now);
    }

    // ── Taking the quiz ─────────────────────────────────────────────────────

    public function setAnswer(string $fieldId, mixed $value): void
    {
        $this->set(QuizEngine::setAnswer($this->config, $this->state, $fieldId, $value));
        $this->saveDraft();
    }

    public function chooseDontKnow(string $fieldId): void
    {
        $this->set(QuizEngine::chooseDontKnow($this->config, $this->state, $fieldId));
        $this->saveDraft();
    }

    /** One of the screen's actions: start, lock, next, back, submit, finish, retake. */
    public function perform(string $action): void
    {
        match ($action) {
            'start' => $this->start(),
            'lock', 'next', 'submit', 'finish' => $this->advance(),
            'back' => $this->set(QuizEngine::back($this->config, $this->state)),
            'retake' => $this->restart(),
            default => null,
        };
    }

    public function start(): void
    {
        if ($this->state->startedAt !== null || $this->state->pending !== null) {
            return;
        }
        try {
            $info = $this->backend?->start !== null
                ? ($this->backend->start)()
                : QuizEngine::localStart($this->config, ($this->clock)());
            $this->set(QuizEngine::started($this->state, $info, ($this->clock)()));
        } catch (Throwable $e) {
            $this->set(QuizEngine::failed($this->state, self::message($e, $this->config->words->startFailed)));
        }
    }

    public function advance(): void
    {
        $step = QuizEngine::advance($this->config, $this->state, ($this->clock)());
        $this->set($step[1]);
        if ($step[0] === 'lock') {
            $this->lock($step[2], $step[3]);
        } elseif ($step[0] === 'submit') {
            $this->submit($step[2], $this->config->words->submitFailed);
        }
    }

    /** Take a local quiz again: a fresh seed, so a shuffled quiz comes out in a new order. */
    public function restart(): void
    {
        if (! $this->local) {
            return;
        }
        $this->seed = QuizArrange::randomSeed();
        $this->config = new QuizConfig($this->options, $this->seed);
        $this->now = ($this->clock)();
        $this->state = QuizEngine::initialState($this->config, [], $this->now);
        $this->lastDraft = [];
    }

    /** The clock, re-read: at zero the quiz submits what it has. */
    public function tick(): void
    {
        $this->now = ($this->clock)();
        if (! QuizEngine::deadlinePassed($this->config, $this->state, $this->now)) {
            return;
        }
        $answers = $this->state->answers;
        $this->set(QuizEngine::timeUp($this->state));
        // The submission carries the answers anyway; the draft is a backstop.
        if ($this->config->feedbackMode === 'end' && $this->backend?->saveDraft !== null) {
            try {
                ($this->backend->saveDraft)($answers);
            } catch (Throwable) {
            }
        }
        $this->submit($answers, $this->config->words->timedSubmitFailed);
    }

    /** Whether the page should keep re-reading the clock. */
    public function clockRunning(): bool
    {
        return $this->config->timerEnabled && $this->state->startedAt !== null
            && ($this->state->completion === null);
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private function set(QuizState $next): void
    {
        $this->now = ($this->clock)();
        $this->state = $next;
    }

    /** An end-of-quiz invitation keeps a draft on BD as answers change. */
    private function saveDraft(): void
    {
        if ($this->backend?->saveDraft === null || $this->config->feedbackMode !== 'end') {
            return;
        }
        if ($this->config->timerEnabled && $this->state->startedAt === null) {
            return;
        }
        $answers = $this->state->answers;
        if (Json::sameMap($answers, $this->lastDraft)) {
            return;
        }
        $this->lastDraft = $answers;
        try {
            ($this->backend->saveDraft)($answers);
        } catch (Throwable $e) {
            $failed = clone $this->state;
            $failed->error = self::message($e, $this->config->words->draftFailed);
            $this->set($failed);
        }
    }

    private function submit(array $answers, string $failure): void
    {
        try {
            if ($this->backend !== null) {
                $completion = ($this->backend->submit)($answers, array_map(fn ($q) => $q->id, $this->config->questions));
                // Graded by BD but timed here (a practice run): add the timing.
                if ($this->config->local) {
                    [$timedOut, $duration] = QuizEngine::localTiming($this->state, ($this->clock)());
                    $completion->timedOut ??= $timedOut;
                    $completion->durationSeconds ??= $duration;
                }
            } else {
                $completion = QuizEngine::localCompletion($this->config, $this->state, $answers, ($this->clock)());
            }
            $this->set(QuizEngine::completed($this->state, $completion));
        } catch (Throwable $e) {
            $this->set(QuizEngine::failed($this->state, self::message($e, $failure)));
        }
    }

    private function lock(string $fieldId, mixed $answer): void
    {
        try {
            if ($this->backend !== null) {
                if ($this->backend->lockAnswer === null) {
                    throw new FormsError($this->config->words->unscorable);
                }
                $result = ($this->backend->lockAnswer)($fieldId, $answer);
            } else {
                $result = QuizEngine::localResult($this->config, $fieldId, $answer);
            }
            if (! $result instanceof stdClass) {
                throw new FormsError($this->config->words->unscorable);
            }
            $this->set(QuizEngine::locked($this->config, $this->state, $fieldId, $answer, $result, ($this->clock)()));
        } catch (Throwable $e) {
            $this->set(QuizEngine::failed($this->state, self::message($e, $this->config->words->lockFailed)));
        }
    }

    private static function message(Throwable $e, string $fallback): string
    {
        return $e instanceof FormsError && $e->getMessage() !== '' ? $e->getMessage() : $fallback;
    }
}
