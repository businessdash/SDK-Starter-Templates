<?php

namespace App\Bd\Forms;

/**
 * Which fields are questions, and their order: as written, or a seeded
 * shuffle that's the same for the same seed on every platform (FNV-1a and
 * mulberry32, as forms-core uses).
 */
final class QuizArrange
{
    private const M = 0xFFFFFFFF;

    public const MULTIPLE_CHOICE_TYPES = ['radio', 'checkbox', 'multi_select', 'choice_cards'];

    public static function isMultipleChoice(Field $field): bool
    {
        return in_array($field->type, self::MULTIPLE_CHOICE_TYPES, true) && QuizScoring::optionLabels($field) !== [];
    }

    public static function isMultiSelect(Field $field): bool
    {
        return $field->type === 'checkbox' || $field->type === 'multi_select'
            || ($field->type === 'choice_cards' && $field->config('choiceConfig', 'mode') === 'multi');
    }

    /** A, B, … Z, then 27, 28, … */
    public static function choiceLetter(int $index): string
    {
        return $index < 26 ? chr(65 + $index) : (string) ($index + 1);
    }

    /**
     * The questions: the listed ids, or every field with an answer key.
     *
     * @param  list<Field>  $fields
     * @param  list<string>|null  $ids
     * @return list<Field>
     */
    public static function questionFields(array $fields, ?array $ids): array
    {
        $out = [];
        $walk = function (array $nodes) use (&$walk, &$out, $ids) {
            foreach ($nodes as $field) {
                $id = Json::str($field->raw->id ?? null) ?? '';
                $wanted = $ids !== null ? in_array($id, $ids, true) : Json::truthy($field->raw->quizAnswerKey ?? null);
                if ($id !== '' && $wanted) {
                    $out[] = $field;
                }
                if ($field->children !== null) {
                    $walk($field->children);
                }
            }
        };
        $walk($fields);

        return $out;
    }

    /** 32-bit FNV-1a over the UTF-8 bytes. */
    public static function seedHash(string $text): int
    {
        $hash = 0x811C9DC5;
        foreach (unpack('C*', $text) ?: [] as $byte) {
            $hash = (($hash ^ $byte) * 0x01000193) & self::M;
        }

        return $hash;
    }

    /** `a * b` modulo 2^32, without overflowing PHP's 64-bit ints. */
    private static function mul32(int $a, int $b): int
    {
        return (($a * ($b & 0xFFFF)) + ((($a * ($b >> 16)) & 0xFFFF) << 16)) & self::M;
    }

    /** @return list<int> A Fisher–Yates shuffle of 0..<count, driven by mulberry32. */
    public static function seededOrder(int $count, string $seed): array
    {
        $order = $count > 0 ? range(0, $count - 1) : [];
        $state = self::seedHash($seed);
        $next = function () use (&$state): int {
            $state = ($state + 0x6D2B79F5) & self::M;
            $t = $state;
            $t = self::mul32($t ^ ($t >> 15), $t | 1);
            $t = ($t ^ (($t + self::mul32($t ^ ($t >> 7), $t | 61)) & self::M)) & self::M;

            return ($t ^ ($t >> 14)) & self::M;
        };
        for ($i = $count - 1; $i > 0; $i--) {
            $j = ($next() * ($i + 1)) >> 32;
            [$order[$i], $order[$j]] = [$order[$j], $order[$i]];
        }

        return $order;
    }

    private static function reorder(array $items, array $order): array
    {
        return count($items) === count($order) ? array_map(fn ($i) => $items[$i], $order) : $items;
    }

    /** A multiple-choice question with its choices (and their ids) in the seed's order. */
    public static function shuffledChoices(Field $field, string $seed): Field
    {
        if (! self::isMultipleChoice($field) || ($field->raw->quizKeepChoiceOrder ?? null) === true) {
            return $field;
        }
        $order = self::seededOrder(count(QuizScoring::optionLabels($field)), "{$seed}:{$field->id}");
        $raw = clone $field->raw;
        $config = $raw->choiceConfig ?? null;
        if ($field->type === 'choice_cards' && $config instanceof \stdClass && Json::isList($config->options ?? null)) {
            $config = clone $config;
            $config->options = self::reorder($config->options, $order);
            $raw->choiceConfig = $config;
        } elseif (Json::isList($raw->options ?? null)) {
            $raw->options = self::reorder($raw->options, $order);
        }
        if (Json::isList($raw->quizOptionIds ?? null)) {
            $raw->quizOptionIds = self::reorder($raw->quizOptionIds, $order);
        }

        return new Field($raw);
    }

    public static function randomSeed(): string
    {
        return bin2hex(random_bytes(8));
    }

    /** @return list<Field> The questions in the order this run asks them. */
    public static function questions(QuizOptions $options, string $seed, bool $local): array
    {
        $questions = self::questionFields($options->fields, $options->questionFieldIds);
        if ($options->shuffleQuestions) {
            $questions = array_map(fn ($i) => $questions[$i], self::seededOrder(count($questions), "{$seed}:questions"));
        }
        if ($local && $options->questionLimit !== null && $options->questionLimit > 0) {
            $questions = array_slice($questions, 0, $options->questionLimit);
        }

        return $options->shuffleChoices ? array_map(fn ($q) => self::shuffledChoices($q, $seed), $questions) : $questions;
    }
}
