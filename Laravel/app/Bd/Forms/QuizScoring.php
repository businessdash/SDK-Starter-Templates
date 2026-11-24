<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * Quiz grading: answer keys, accepted answers, thresholds, rationale and the
 * score BD records for an attempt. A port of forms-core's `quiz-scoring.ts`
 * (by way of the Swift SDK); `QuizParityTest` replays the TypeScript answers.
 *
 * It grades LOCAL quizzes, ones whose fields carry their answer keys (the
 * bundled sample). An invited or practice quiz from BD arrives without keys,
 * and BD grades every answer.
 *
 * A question's result is a JSON object (`stdClass`), as BD sends one:
 * `{fieldId, label, answer, status, pointsPossible, pointsEarned, accuracyPercent,
 * passingGrade, correctThreshold, partiallyCorrectThreshold, passed,
 * correctAnswers, rationale, reason}`.
 */
final class QuizScoring
{
    public const DEFAULT_PASSING_GRADE = 80.0;

    public const DEFAULT_CORRECT_THRESHOLD = 85.0;

    public const DEFAULT_PARTIAL_THRESHOLD = 50.0;

    public const STATUSES = ['correct', 'partially_correct', 'incorrect', 'pending_ai', 'unscored'];

    public const NON_QUESTION_TYPES = [
        'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'multi_populator',
        'condition_block', 'or_condition', 'image', 'richtext', 'body_text', 'bullet_list',
        'table', 'calculation', 'credit_card',
    ];

    // ── Reading BD's results ────────────────────────────────────────────────

    /** A result from BD, with an unknown status read as incorrect. */
    public static function readResult(mixed $raw): stdClass
    {
        $result = $raw instanceof stdClass ? clone $raw : new stdClass;
        if (! in_array($result->status ?? null, self::STATUSES, true)) {
            $result->status = 'incorrect';
        }

        return $result;
    }

    /** An attempt's completion from BD: its results read as above. */
    public static function readCompletion(mixed $raw): stdClass
    {
        $completion = $raw instanceof stdClass ? clone $raw : new stdClass;
        $completion->status = Json::str($completion->status ?? null) ?? 'scored';
        $completion->results = array_map(self::readResult(...), Json::list($completion->results ?? null) ?? []);

        return $completion;
    }

    // ── Answer keys ─────────────────────────────────────────────────────────

    /** @return array{hasText: bool, text: ?string, optionId: ?string, validateWithAI: bool} */
    private static function accepted(mixed $json): array
    {
        return [
            'hasText' => Json::has($json, 'text'),
            'text' => Json::str(Json::get($json, 'text')),
            'optionId' => Json::str(Json::get($json, 'option_id')),
            'validateWithAI' => Json::get($json, 'validate_with_ai') === true,
        ];
    }

    private static function choiceId(array $accepted): ?string
    {
        return $accepted['optionId'] !== null && $accepted['optionId'] !== '' ? $accepted['optionId'] : null;
    }

    /** The field's answer key, or null for a question nobody grades. */
    public static function answerKey(Field $field): ?array
    {
        $o = $field->raw->quizAnswerKey ?? null;
        if (! Json::truthy($o)) {
            return null;
        }
        $rationale = Json::obj(Json::get($o, 'rationale'));
        $answer = Json::get($o, 'answer');
        $additional = array_map(self::accepted(...), Json::list(Json::get($o, 'additional_accepted_answers')) ?? []);
        $first = Json::truthy($answer) ? self::accepted($answer) : null;

        return [
            'accepted' => $first !== null ? [$first, ...$additional] : $additional,
            'noWrongAnswer' => Json::truthy(Json::get($o, 'no_wrong_answer')),
            'whyRight' => Json::str(Json::get($rationale, 'why_right')),
            'whyWrong' => Json::str(Json::get($rationale, 'why_wrong')),
            'whyWrongByOptionId' => array_filter(Json::toMap(Json::get($rationale, 'why_wrong_by_option_id')), 'is_string'),
            'reason' => Json::str(Json::get($o, 'reason')),
            'points' => Json::num(Json::get($o, 'points')),
            'passingGrade' => Json::num(Json::get($o, 'passing_grade')),
            'correctThreshold' => Json::num(Json::get($o, 'correct_threshold')),
            'partialThreshold' => Json::num(Json::get($o, 'partially_correct_threshold')),
        ];
    }

    /** @return list<string> */
    public static function optionIds(Field $field): array
    {
        return array_map(
            fn ($id) => is_string($id) ? $id : Js::string($id),
            Json::list($field->raw->quizOptionIds ?? null) ?? [],
        );
    }

    // ── Text ────────────────────────────────────────────────────────────────

    public static function isBlank(mixed $value): bool
    {
        return match (true) {
            $value === null, $value instanceof Undefined => true,
            Json::isList($value) => $value === [],
            is_string($value) => $value === '' || Js::trim(Js::stripTags($value)) === '',
            default => false,
        };
    }

    /** Tags dropped, whitespace collapsed, lower-cased: how answers compare. */
    public static function normalizedText(mixed $value): string
    {
        $text = Js::trim(Js::stripTags(Js::string($value)));

        return Js::lower(preg_replace('/['.Js::WHITESPACE.']+/u', ' ', $text) ?? $text);
    }

    /** @return list<string> */
    public static function optionLabels(Field $field): array
    {
        if ($field->type === 'choice_cards') {
            return array_map(fn ($o) => $o->label, $field->cards());
        }

        return $field->options() ?? [];
    }

    private static function cleanRationale(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $cleaned = Js::trim($value);
        if ($cleaned === '') {
            return null;
        }

        return Js::length($cleaned) <= 2000 ? $cleaned : Js::slice($cleaned, 0, 2000);
    }

    private static function acceptedLabel(Field $field, array $answer): ?string
    {
        if ($answer['hasText']) {
            return self::cleanRationale($answer['text']);
        }
        if ($answer['optionId'] === null) {
            return null;
        }
        $labels = self::optionLabels($field);
        $index = array_search($answer['optionId'], self::optionIds($field), true);
        if ($index !== false && $index < count($labels)) {
            return self::cleanRationale($labels[$index]);
        }

        return self::cleanRationale($answer['optionId']);
    }

    /** @return list<string> What counts as right, for showing. */
    public static function correctAnswers(Field $field): array
    {
        $key = self::answerKey($field);
        if ($key === null) {
            return [];
        }
        if ($key['noWrongAnswer']) {
            return ['Any non-empty response'];
        }

        return array_values(array_filter(
            array_map(fn ($a) => self::acceptedLabel($field, $a), $key['accepted']),
            fn ($label) => $label !== null,
        ));
    }

    /** @return list<array{string, string}> [option id, label] of each choice picked. */
    private static function selectedOptions(Field $field, mixed $value): array
    {
        $labels = self::optionLabels($field);
        $ids = self::optionIds($field);
        $out = [];
        foreach (Json::isList($value) ? $value : [$value] as $selected) {
            $normalized = self::normalizedText($selected);
            foreach ($labels as $i => $label) {
                if (self::normalizedText($label) === $normalized || self::normalizedText($ids[$i] ?? null) === $normalized) {
                    $optionId = $ids[$i] ?? '';
                    if ($optionId !== '' && $label !== '') {
                        $out[] = [$optionId, $label];
                    }
                    break;
                }
            }
        }

        return $out;
    }

    private static function resultRationale(Field $field, array $key, mixed $value, string $outcome): ?stdClass
    {
        $whyRight = self::cleanRationale($key['whyRight'] ?? $key['reason']);
        $whyWrong = self::cleanRationale($key['whyWrong']);
        $accepted = array_values(array_filter(array_map(self::choiceId(...), $key['accepted'])));
        $explain = fn (string $optionId, bool $isAccepted) => self::cleanRationale(
            $isAccepted ? $whyRight : ($key['whyWrongByOptionId'][$optionId] ?? $whyWrong)
        );
        $note = fn (string $id, string $option, bool $isAccepted, ?string $explanation) => Json::objectFrom([
            'optionId' => $id, 'option' => $option, 'accepted' => $isAccepted, 'explanation' => $explanation,
        ]);
        $selections = array_map(function ($s) use ($accepted, $explain, $note) {
            $isAccepted = in_array($s[0], $accepted, true);

            return $note($s[0], $s[1], $isAccepted, $explain($s[0], $isAccepted));
        }, self::selectedOptions($field, $value));
        $selectedExplanation = count($selections) === 1 ? $selections[0]->explanation : null;
        $ids = self::optionIds($field);
        $optionExplanations = [];
        foreach (self::optionLabels($field) as $index => $option) {
            $optionId = $ids[$index] ?? '';
            if ($optionId === '') {
                continue;
            }
            $isAccepted = in_array($optionId, $accepted, true);
            $explanation = $explain($optionId, $isAccepted);
            if ($explanation !== null) {
                $optionExplanations[] = $note($optionId, $option, $isAccepted, $explanation);
            }
        }
        $explanation = self::isBlank($value) || $outcome === 'correct' ? $whyRight : ($selectedExplanation ?? $whyWrong);
        $anySelected = array_filter($selections, fn ($s) => $s->explanation !== null) !== [];
        if ($explanation === null && ! $anySelected && $optionExplanations === []) {
            return null;
        }

        return Json::objectFrom([
            'outcome' => $outcome,
            'explanation' => $explanation,
            'selectedOptions' => $selections === [] ? null : $selections,
            'optionExplanations' => $optionExplanations === [] ? null : $optionExplanations,
        ]);
    }

    private static function matches(Field $field, array $accepted, mixed $value): bool
    {
        $optionId = self::choiceId($accepted);
        if ($optionId !== null) {
            $labels = self::optionLabels($field);
            $index = array_search($optionId, self::optionIds($field), true);
            $wantLabel = self::normalizedText($index !== false ? ($labels[$index] ?? null) : null);
            $wantId = self::normalizedText($optionId);
            $hit = function (mixed $item) use ($wantLabel, $wantId) {
                $got = self::normalizedText($item);

                return $got === $wantLabel || $got === $wantId;
            };
            if (Json::isList($value)) {
                foreach ($value as $item) {
                    if ($hit($item)) {
                        return true;
                    }
                }

                return false;
            }

            return $hit($value);
        }

        return self::normalizedText($value) === self::normalizedText($accepted['text']);
    }

    /** The label is one of the result's accepted answers. */
    public static function isAcceptedLabel(stdClass $result, string $label): bool
    {
        $wanted = self::normalizedText($label);
        foreach (Json::list($result->correctAnswers ?? null) ?? [] as $answer) {
            if (self::normalizedText($answer) === $wanted) {
                return true;
            }
        }

        return false;
    }

    private static function conditionMatches(Field $field, array $data): bool
    {
        $rule = $field->rule();
        $fieldId = Json::str($rule?->fieldId ?? null);
        if ($fieldId === null || $fieldId === '') {
            return true;
        }
        $current = Undefined::in($data, $fieldId);
        $listed = Json::list($rule->clauses ?? null) ?? [];
        $clauses = $listed !== []
            ? array_map(fn ($c) => [$c->operator, Json::str($c->value ?? null) ?? ''], $listed)
            : [[Json::str($rule->operator ?? null) ?? 'eq', Json::str($rule->value ?? null) ?? '']];
        foreach ($clauses as [$op, $value]) {
            $ok = match ($op) {
                'eq' => Js::string($current) === $value,
                'neq' => Js::string($current) !== $value,
                'contains' => str_contains(self::normalizedText($current), self::normalizedText($value)),
                'gt' => Js::number($current) > Js::number($value),
                'lt' => Js::number($current) < Js::number($value),
                'is_empty' => self::isBlank($current),
                'is_not_empty' => ! self::isBlank($current),
                default => true,
            };
            if (! $ok) {
                return false;
            }
        }

        return true;
    }

    private static function safePoints(?float $value): float
    {
        return $value === null || ! is_finite($value) ? 1.0 : min(1000.0, max(0.0, $value));
    }

    private static function safePercent(?float $value, float $fallback): float
    {
        return $value === null || ! is_finite($value) ? $fallback : min(100.0, max(0.0, $value));
    }

    // ── Grading ─────────────────────────────────────────────────────────────

    /**
     * Grade an attempt: `{status, results, pointsEarned, pointsPossible,
     * scorePercent, provisionalScorePercent, passed}`.
     *
     * @param  list<Field>  $fields
     * @param  array<string, mixed>  $answers
     */
    public static function score(array $fields, array $answers, float $passingScore): stdClass
    {
        $results = [];
        $grade = function (Field $field, mixed $value, string $resultId) use (&$results) {
            if (in_array($field->type, self::NON_QUESTION_TYPES, true)) {
                return;
            }
            $label = $field->label === '' ? 'Untitled question' : $field->label;
            $key = self::answerKey($field);
            if ($key === null) {
                $results[] = Json::objectFrom([
                    'fieldId' => $resultId, 'label' => $label, 'answer' => $value, 'status' => 'unscored',
                    'pointsPossible' => 0.0, 'pointsEarned' => 0.0,
                ]);

                return;
            }
            $points = self::safePoints($key['points']);
            $correctThreshold = self::safePercent($key['correctThreshold'], self::DEFAULT_CORRECT_THRESHOLD);
            $passingGrade = self::safePercent($key['passingGrade'], self::DEFAULT_PASSING_GRADE);
            $partialThreshold = min($correctThreshold, self::safePercent($key['partialThreshold'], self::DEFAULT_PARTIAL_THRESHOLD));
            $correct = false;
            if ($key['noWrongAnswer']) {
                $correct = ! self::isBlank($value);
            } else {
                foreach ($key['accepted'] as $accepted) {
                    if (self::matches($field, $accepted, $value)) {
                        $correct = true;
                        break;
                    }
                }
            }
            $pendingAi = false;
            if (! $correct && ! self::isBlank($value)) {
                foreach ($key['accepted'] as $accepted) {
                    if ($accepted['hasText'] && $accepted['validateWithAI']) {
                        $pendingAi = true;
                        break;
                    }
                }
            }
            $accuracy = $pendingAi ? null : ($correct ? 100.0 : 0.0);
            $status = match (true) {
                $accuracy === null => 'pending_ai',
                $accuracy >= $correctThreshold => 'correct',
                $accuracy >= $partialThreshold => 'partially_correct',
                default => 'incorrect',
            };
            $correctAnswers = self::correctAnswers($field);
            $reason = $key['reason'] === null ? null : Js::trim($key['reason']);
            $results[] = Json::objectFrom([
                'fieldId' => $resultId,
                'label' => $label,
                'answer' => $value,
                'status' => $status,
                'pointsPossible' => $points,
                'pointsEarned' => $accuracy === null ? 0.0 : $points * ($accuracy / 100),
                'accuracyPercent' => $accuracy,
                'passingGrade' => $passingGrade,
                'correctThreshold' => $correctThreshold,
                'partiallyCorrectThreshold' => $partialThreshold,
                'passed' => $accuracy === null ? null : $accuracy >= $passingGrade,
                'correctAnswers' => $correctAnswers === [] ? null : $correctAnswers,
                'rationale' => $status === 'pending_ai' ? null : self::resultRationale($field, $key, $value, $status),
                'reason' => $reason === '' ? null : $reason,
            ]);
        };
        $walk = function (array $nodes, array $scope, string $prefix) use (&$walk, $grade) {
            foreach ($nodes as $field) {
                switch ($field->type) {
                    case 'condition_block':
                        if (self::conditionMatches($field, $scope)) {
                            $walk($field->children ?? [], $scope, $prefix);
                        }
                        break;
                    case 'input_group':
                    case 'flex_row':
                    case 'or_condition':
                        $walk($field->children ?? [], $scope, $prefix);
                        break;
                    case 'multi_populator':
                        foreach (Json::list($scope[$field->id] ?? null) ?? [] as $index => $instance) {
                            if ($instance instanceof stdClass) {
                                $walk($field->children ?? [], get_object_vars($instance), "{$prefix}{$field->id}[{$index}].");
                            }
                        }
                        break;
                    default:
                        $grade($field, $scope[$field->id] ?? null, $prefix.$field->id);
                }
            }
        };
        $walk($fields, $answers, '');

        $scorable = array_filter($results, fn ($r) => $r->pointsPossible > 0);
        $possible = array_sum(array_map(fn ($r) => $r->pointsPossible, $scorable)) + 0.0;
        $earned = array_sum(array_map(fn ($r) => $r->pointsEarned, $scorable)) + 0.0;
        $provisional = $possible == 0 ? 0.0 : ($earned / $possible) * 100;
        $pending = array_filter($scorable, fn ($r) => $r->status === 'pending_ai') !== [];
        $percent = $pending ? null : $provisional;

        return Json::objectFrom([
            'status' => $pending ? 'pending_ai_review' : 'scored',
            'results' => $results,
            'pointsEarned' => $earned,
            'pointsPossible' => $possible,
            'scorePercent' => $percent,
            'provisionalScorePercent' => $provisional,
            'passed' => $percent === null ? null : $percent >= $passingScore,
        ]);
    }
}
