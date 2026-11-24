<?php

namespace App\Bd\Forms;

/** A quiz's options resolved for one run: its questions in order, its rules settled. */
final class QuizConfig
{
    /** @var list<Field> */
    public readonly array $questions;

    public readonly string $feedbackMode;

    public readonly float $passingScore;

    public readonly bool $timerEnabled;

    public readonly ?int $timeLimitMinutes;

    public readonly bool $showScore;

    public readonly bool $resultsLocked;

    public readonly ?string $signInHref;

    public readonly bool $allowDontKnow;

    public readonly string $layout;

    public readonly bool $local;

    public readonly bool $canRestart;

    public readonly QuizWords $words;

    public function __construct(QuizOptions $options, string $seed)
    {
        $limit = $options->timeLimitMinutes;
        $limit = $limit !== null && is_finite($limit) && $limit > 0 ? (int) floor($limit) : null;
        $this->local = $options->local ?? false;
        $this->questions = QuizArrange::questions($options, $seed, $this->local);
        $this->feedbackMode = $options->feedbackMode;
        $this->passingScore = $options->passingScore !== null && is_finite($options->passingScore)
            ? $options->passingScore : QuizScoring::DEFAULT_PASSING_GRADE;
        $this->timerEnabled = $options->showTimer || $limit !== null;
        $this->timeLimitMinutes = $limit;
        $this->showScore = $options->showScore;
        $this->resultsLocked = $options->resultsLocked;
        $this->signInHref = $options->signInHref;
        $this->allowDontKnow = $options->allowDontKnow;
        $this->layout = $options->feedbackMode === 'end' && $options->layout === 'all' ? 'all' : 'single';
        $this->canRestart = $options->canRestart ?? false;
        $this->words = $options->words;
    }

    public function question(string $fieldId): ?Field
    {
        foreach ($this->questions as $q) {
            if ($q->id === $fieldId) {
                return $q;
            }
        }

        return null;
    }
}
