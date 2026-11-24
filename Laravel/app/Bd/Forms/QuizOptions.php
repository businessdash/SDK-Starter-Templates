<?php

namespace App\Bd\Forms;

use stdClass;

/** How a quiz is taken: its questions, feedback, timer, order and wording. */
final class QuizOptions
{
    /**
     * @param  list<Field>  $fields
     * @param  list<string>|null  $questionFieldIds
     * @param  'immediate'|'end'  $feedbackMode
     * @param  'single'|'all'  $layout
     */
    public function __construct(
        public array $fields,
        public ?array $questionFieldIds = null,
        public string $feedbackMode = 'end',
        public ?float $passingScore = null,
        public bool $showTimer = false,
        public ?float $timeLimitMinutes = null,
        public bool $showScore = true,
        public bool $resultsLocked = false,
        public ?string $signInHref = null,
        public bool $shuffleChoices = false,
        public bool $shuffleQuestions = false,
        public ?string $seed = null,
        public ?int $questionLimit = null,
        public bool $allowDontKnow = false,
        public string $layout = 'single',
        public ?bool $local = null,
        public ?bool $canRestart = null,
        public QuizWords $words = new QuizWords,
    ) {}

    /** Options as JSON (forms-core's `QuizOptions`), read leniently. */
    public static function fromJson(stdClass $o): self
    {
        $limit = Json::num($o->questionLimit ?? null);
        $ids = $o->questionFieldIds ?? null;

        return new self(
            fields: Field::list($o->fields ?? null),
            questionFieldIds: Field::fits($ids, 's*') ? $ids : null,
            feedbackMode: ($o->feedbackMode ?? null) === 'immediate' ? 'immediate' : 'end',
            passingScore: Json::num($o->passingScore ?? null),
            showTimer: Json::bool($o->showTimer ?? null) ?? false,
            timeLimitMinutes: Json::num($o->timeLimitMinutes ?? null),
            showScore: Json::bool($o->showScore ?? null) ?? true,
            resultsLocked: Json::bool($o->resultsLocked ?? null) ?? false,
            signInHref: Json::str($o->signInHref ?? null),
            shuffleChoices: Json::bool($o->shuffleChoices ?? null) ?? false,
            shuffleQuestions: Json::bool($o->shuffleQuestions ?? null) ?? false,
            seed: Json::str($o->seed ?? null),
            questionLimit: $limit !== null && is_finite($limit) ? (int) floor($limit) : null,
            allowDontKnow: Json::bool($o->allowDontKnow ?? null) ?? false,
            layout: ($o->layout ?? null) === 'all' ? 'all' : 'single',
            local: Json::bool($o->local ?? null),
            canRestart: Json::bool($o->canRestart ?? null),
        );
    }

    /** An invitation from BD: BD grades it, keeps its answers and runs its clock. */
    public static function fromInvitation(stdClass $invitation, ?string $signInHref = null): self
    {
        $taking = Json::obj(Json::get($invitation->settings ?? null, 'quiz'));

        return new self(
            fields: Field::list($invitation->fields ?? null),
            questionFieldIds: Json::strings($invitation->questionFieldIds ?? null),
            feedbackMode: ($invitation->feedbackMode ?? null) === 'immediate' ? 'immediate' : 'end',
            passingScore: Json::num($invitation->passingScore ?? null),
            showTimer: ($invitation->showTimer ?? null) === true,
            timeLimitMinutes: Json::num($invitation->timeLimitMinutes ?? null),
            showScore: ($invitation->showScore ?? true) !== false,
            resultsLocked: ($invitation->resultsRequireAccount ?? null) === true && ($invitation->resultsUnlocked ?? null) !== true,
            signInHref: $signInHref,
            shuffleChoices: ($taking->shuffleChoices ?? null) === true,
            shuffleQuestions: ($taking->shuffleQuestions ?? null) === true,
            seed: Json::str($invitation->id ?? null),
            allowDontKnow: ($taking->allowDontKnow ?? null) === true,
            local: false,
            canRestart: false,
        );
    }

    /** A practice quiz from BD: graded by BD, timed here, nothing recorded. */
    public static function fromPractice(stdClass $practice, ?string $seed = null, ?int $questionLimit = null): self
    {
        $taking = Json::obj(Json::get($practice->settings ?? null, 'quiz'));

        return new self(
            fields: Field::list($practice->fields ?? null),
            questionFieldIds: Json::strings($practice->questionFieldIds ?? null),
            feedbackMode: ($practice->feedbackMode ?? null) === 'immediate' ? 'immediate' : 'end',
            passingScore: Json::num($practice->passingScore ?? null),
            showTimer: ($practice->showTimer ?? null) === true,
            timeLimitMinutes: Json::num($practice->timeLimitMinutes ?? null),
            shuffleChoices: ($taking->shuffleChoices ?? null) === true,
            shuffleQuestions: ($taking->shuffleQuestions ?? null) === true,
            seed: $seed,
            questionLimit: $questionLimit,
            allowDontKnow: ($taking->allowDontKnow ?? null) === true,
            local: true,
            canRestart: true,
        );
    }
}
