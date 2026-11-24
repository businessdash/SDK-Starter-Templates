<?php

namespace App\Bd\Forms;

use Closure;

/**
 * BD's side of a quiz run: an invitation (BD starts the clock, keeps a
 * draft, locks and grades each answer) or a practice quiz (BD grades, this
 * server times). Each closure throws `FormsError` with a message for the taker.
 */
final class QuizBackend
{
    /**
     * @param  Closure(array<string, mixed>, list<string>): \stdClass  $submit  Answers, question ids → the completion.
     * @param  (Closure(): array{startedAt: mixed, deadlineAt: mixed, serverNow: float})|null  $start
     * @param  (Closure(array<string, mixed>): void)|null  $saveDraft
     * @param  (Closure(string, mixed): \stdClass)|null  $lockAnswer  Field id, answer → its result.
     */
    public function __construct(
        public readonly Closure $submit,
        public readonly ?Closure $start = null,
        public readonly ?Closure $saveDraft = null,
        public readonly ?Closure $lockAnswer = null,
    ) {}
}
