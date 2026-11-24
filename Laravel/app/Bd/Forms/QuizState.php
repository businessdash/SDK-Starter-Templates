<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * Where a run is: the question, the answers, the verdicts, the clock. Times
 * are epoch milliseconds, as in JavaScript, so a state travels to and from
 * JSON unchanged (it's kept in the cache between requests that way).
 */
final class QuizState
{
    /**
     * @param  array<string, mixed>  $answers
     * @param  list<string>  $dontKnow
     * @param  list<stdClass>  $results
     * @param  'start'|'lock'|'submit'|null  $pending
     * @param  array<string, string>  $fieldErrors
     */
    public function __construct(
        public int $index = 0,
        public array $answers = [],
        public array $dontKnow = [],
        public array $results = [],
        public bool $revealed = false,
        public ?stdClass $completion = null,
        public ?float $startedAt = null,
        public ?float $deadlineAt = null,
        public float $clockOffset = 0.0,
        public float $pausedMs = 0.0,
        public ?float $revealStartedAt = null,
        public ?string $pending = null,
        public ?string $error = null,
        public array $fieldErrors = [],
        public bool $timeUp = false,
    ) {}

    public function toJson(): stdClass
    {
        return Json::objectFrom([
            'index' => (float) $this->index,
            'answers' => Json::objectFrom($this->answers),
            'dontKnow' => $this->dontKnow,
            'results' => $this->results,
            'revealed' => $this->revealed,
            'completion' => $this->completion,
            'startedAt' => $this->startedAt,
            'deadlineAt' => $this->deadlineAt,
            'clockOffset' => $this->clockOffset,
            'pausedMs' => $this->pausedMs,
            'revealStartedAt' => $this->revealStartedAt,
            'pending' => $this->pending,
            'error' => $this->error,
            'fieldErrors' => Json::objectFrom($this->fieldErrors),
            'timeUp' => $this->timeUp,
        ]);
    }

    public static function fromJson(stdClass $o): self
    {
        return new self(
            index: (int) (Json::num($o->index ?? null) ?? 0),
            answers: Json::toMap($o->answers ?? null),
            dontKnow: Json::strings($o->dontKnow ?? null),
            results: array_map(QuizScoring::readResult(...), Json::list($o->results ?? null) ?? []),
            revealed: ($o->revealed ?? null) === true,
            completion: ($o->completion ?? null) instanceof stdClass ? QuizScoring::readCompletion($o->completion) : null,
            startedAt: Json::num($o->startedAt ?? null),
            deadlineAt: Json::num($o->deadlineAt ?? null),
            clockOffset: Json::num($o->clockOffset ?? null) ?? 0.0,
            pausedMs: Json::num($o->pausedMs ?? null) ?? 0.0,
            revealStartedAt: Json::num($o->revealStartedAt ?? null),
            pending: Json::str($o->pending ?? null),
            error: Json::str($o->error ?? null),
            fieldErrors: array_filter(Json::toMap($o->fieldErrors ?? null), 'is_string'),
            timeUp: ($o->timeUp ?? null) === true,
        );
    }

    public function equals(self $other): bool
    {
        return Json::equal($this->toJson(), $other->toJson());
    }

    public function result(string $fieldId): ?stdClass
    {
        foreach ($this->results as $result) {
            if (($result->fieldId ?? null) === $fieldId) {
                return $result;
            }
        }

        return null;
    }
}
