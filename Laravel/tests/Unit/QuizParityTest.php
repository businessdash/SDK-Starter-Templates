<?php

namespace Tests\Unit;

use App\Bd\Forms\Field;
use App\Bd\Forms\Js;
use App\Bd\Forms\Json;
use App\Bd\Forms\QuizArrange;
use App\Bd\Forms\QuizConfig;
use App\Bd\Forms\QuizEngine;
use App\Bd\Forms\QuizOptions;
use App\Bd\Forms\QuizPage;
use App\Bd\Forms\QuizScoring;
use App\Bd\Forms\QuizWords;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Replays `quiz-parity.json`: quizzes run through the TypeScript forms-core
 * by `sdk/scripts/quiz-parity.ts`, with every screen and state TypeScript
 * produced. This starter's quiz must show a taker exactly what the web quiz shows.
 */
final class QuizParityTest extends TestCase
{
    private static ?stdClass $fixtures = null;

    private static function fixtures(): stdClass
    {
        return self::$fixtures ??= Json::decode((string) file_get_contents(__DIR__.'/../Fixtures/quiz-parity.json'));
    }

    /** @return list<stdClass> */
    private static function cases(string $key): array
    {
        return self::fixtures()->{$key};
    }

    /** Engine output as JSON: arrays as objects, a question's field as its id. */
    private static function json(mixed $value): mixed
    {
        if ($value instanceof Field) {
            return $value->id;
        }
        if (is_array($value)) {
            $mapped = array_map(self::json(...), $value);

            return array_is_list($value) ? $mapped : Json::objectFrom($mapped);
        }
        if ($value instanceof stdClass) {
            return Json::objectFrom(array_map(self::json(...), get_object_vars($value)));
        }

        return is_int($value) ? (float) $value : $value;
    }

    /**
     * The path of the first difference, or null. A missing key equals null
     * (TypeScript writes null where the ports leave a key out), numbers within 1e-9.
     */
    private static function diff(mixed $a, mixed $b, string $path = '$'): ?string
    {
        if ($a === null && $b === null) {
            return null;
        }
        if (Json::isNumber($a) && Json::isNumber($b)) {
            $x = (float) $a;
            $y = (float) $b;

            return $x === $y || abs($x - $y) <= 1e-9 * max(abs($x), abs($y)) ? null : "{$path}: {$x} ≠ {$y}";
        }
        if (Json::isList($a) && Json::isList($b)) {
            if (count($a) !== count($b)) {
                return "{$path}: ".count($a).' items ≠ '.count($b);
            }
            foreach ($a as $i => $item) {
                if ($d = self::diff($item, $b[$i], "{$path}[{$i}]")) {
                    return $d;
                }
            }

            return null;
        }
        if ($a instanceof stdClass && $b instanceof stdClass) {
            $x = get_object_vars($a);
            $y = get_object_vars($b);
            $keys = array_unique([...array_keys($x), ...array_keys($y)]);
            sort($keys);
            foreach ($keys as $key) {
                if ($d = self::diff($x[$key] ?? null, $y[$key] ?? null, "{$path}.{$key}")) {
                    return $d;
                }
            }

            return null;
        }

        return $a === $b ? null : "{$path}: ".Json::encode($a).' ≠ '.Json::encode($b);
    }

    public function test_diff_catches_differences(): void
    {
        $o = fn (array $m) => Json::normalize($m);
        $this->assertNotNull(self::diff($o(['a' => 1]), $o(['a' => 2])));
        $this->assertNotNull(self::diff($o(['a' => 1]), new stdClass));
        $this->assertNotNull(self::diff([1.0, 2.0], [1.0]));
        $this->assertNotNull(self::diff($o(['a' => ['b' => true]]), $o(['a' => ['b' => false]])));
        $this->assertNull(self::diff($o(['a' => null]), new stdClass));
    }

    public function test_words_match(): void
    {
        $expected = get_object_vars(self::fixtures()->words);
        $mine = get_object_vars(new QuizWords);
        ksort($expected);
        ksort($mine);
        $this->assertSame($expected, $mine);
    }

    public function test_seed_hash(): void
    {
        foreach (self::cases('seedHash') as $c) {
            $this->assertSame((int) $c->hash, QuizArrange::seedHash($c->text), "hash({$c->text})");
        }
    }

    public function test_seeded_order(): void
    {
        foreach (self::cases('seededOrder') as $c) {
            $want = array_map('intval', $c->order);
            $this->assertSame($want, QuizArrange::seededOrder((int) $c->count, $c->seed), "order({$c->count}, {$c->seed})");
        }
    }

    public function test_durations(): void
    {
        foreach (self::cases('durations') as $c) {
            $this->assertSame($c->label, QuizEngine::durationLabel((float) $c->seconds), "duration({$c->seconds})");
        }
    }

    public function test_answer_text(): void
    {
        foreach (self::cases('answerText') as $c) {
            $value = property_exists($c, 'value') ? $c->value : null;
            $this->assertSame($c->text, QuizEngine::answerText($value), 'answerText('.Json::encode($value).')');
        }
    }

    public function test_scoring(): void
    {
        $failures = [];
        foreach (self::cases('scoring') as $c) {
            $score = QuizScoring::score(Field::list($c->fields), Json::toMap($c->answers ?? null), (float) $c->passingScore);
            if ($d = self::diff(self::json($score), $c->score)) {
                $failures[] = "scoring “{$c->name}”: {$d}";
            }
        }
        $this->assertSame([], $failures);
    }

    public function test_pages(): void
    {
        $failures = [];
        foreach (self::cases('pages') as $c) {
            if (property_exists($c, 'practice')) {
                $page = QuizPage::practice($c->practice);
            } else {
                $links = $c->links ?? new stdClass;
                $page = QuizPage::invitation(
                    ($c->invitation ?? null) instanceof stdClass ? $c->invitation : null,
                    signInHref: Json::str($links->signInHref ?? null),
                    switchAccountHref: Json::str($links->switchAccountHref ?? null),
                );
            }
            if ($d = self::diff(self::json($page), $c->page)) {
                $failures[] = "page “{$c->name}”: {$d}";
            }
        }
        $this->assertSame([], $failures);
    }

    private static function initial(?stdClass $o): array
    {
        if ($o === null) {
            return [];
        }
        $initial = [];
        if (property_exists($o, 'answers') && $o->answers !== null) {
            $initial['answers'] = Json::toMap($o->answers);
        }
        if (Json::isList($o->results ?? null)) {
            $initial['results'] = array_map(QuizScoring::readResult(...), $o->results);
        }
        if (($o->completion ?? null) instanceof stdClass) {
            $initial['completion'] = QuizScoring::readCompletion($o->completion);
        }
        foreach (['startedAt', 'deadlineAt'] as $k) {
            if (property_exists($o, $k)) {
                $initial[$k] = $o->{$k};
            }
        }
        if (Json::isNumber($o->serverNow ?? null)) {
            $initial['serverNow'] = (float) $o->serverNow;
        }
        if (Json::isList($o->dontKnow ?? null)) {
            $initial['dontKnow'] = Json::strings($o->dontKnow);
        }

        return $initial;
    }

    private static function startInfo(stdClass $o): array
    {
        return ['startedAt' => $o->startedAt ?? null, 'deadlineAt' => $o->deadlineAt ?? null, 'serverNow' => (float) $o->serverNow];
    }

    public function test_runs(): void
    {
        $failures = [];
        foreach (self::cases('runs') as $run) {
            $config = new QuizConfig(QuizOptions::fromJson($run->options), $run->seed);
            $start = (float) $run->start;
            $state = QuizEngine::initialState($config, self::initial($run->initial ?? null), $start);
            $check = function (int $i, float $at) use (&$state, $config, $run, &$failures): bool {
                if ($d = self::diff(self::json(QuizEngine::screen($config, $state, $at)), $run->views[$i])) {
                    $failures[] = "run “{$run->name}”, view {$i}: {$d}";

                    return false;
                }
                if ($d = self::diff(self::json($state->toJson()), $run->states[$i])) {
                    $failures[] = "run “{$run->name}”, state {$i}: {$d}";

                    return false;
                }

                return true;
            };
            if (! $check(0, $start)) {
                continue;
            }
            foreach ($run->events as $i => $e) {
                $at = (float) $e->at;
                switch ($e->do) {
                    case 'answer':
                        $state = QuizEngine::setAnswer($config, $state, $e->fieldId, $e->value ?? null);
                        break;
                    case 'dontKnow':
                        $state = QuizEngine::chooseDontKnow($config, $state, $e->fieldId);
                        break;
                    case 'back':
                        $state = QuizEngine::back($config, $state);
                        break;
                    case 'start':
                        $info = ($e->info ?? null) instanceof stdClass ? self::startInfo($e->info) : QuizEngine::localStart($config, $at);
                        $state = QuizEngine::started($state, $info, $at);
                        break;
                    case 'fail':
                        $state = QuizEngine::failed($state, $e->message);
                        break;
                    case 'view':
                        break;
                    case 'advance':
                        $step = QuizEngine::advance($config, $state, $at);
                        $state = $step[1];
                        if ($step[0] === 'lock') {
                            [, , $fieldId, $answer] = $step;
                            $result = ($e->result ?? null) instanceof stdClass
                                ? QuizScoring::readResult($e->result)
                                : QuizEngine::localResult($config, $fieldId, $answer);
                            $state = $result !== null
                                ? QuizEngine::locked($config, $state, $fieldId, $answer, $result, $at)
                                : QuizEngine::failed($state, $config->words->unscorable);
                        } elseif ($step[0] === 'submit') {
                            $completion = ($e->completion ?? null) instanceof stdClass
                                ? QuizScoring::readCompletion($e->completion)
                                : QuizEngine::localCompletion($config, $state, $step[2], $at);
                            $state = QuizEngine::completed($state, $completion);
                        }
                        break;
                    case 'tick':
                        if (QuizEngine::deadlinePassed($config, $state, $at)) {
                            $answers = $state->answers;
                            $state = QuizEngine::timeUp($state);
                            $completion = ($e->completion ?? null) instanceof stdClass
                                ? QuizScoring::readCompletion($e->completion)
                                : QuizEngine::localCompletion($config, $state, $answers, $at);
                            $state = QuizEngine::completed($state, $completion);
                        }
                        break;
                    default:
                        $failures[] = "run “{$run->name}”: unknown event {$e->do}";
                }
                if (! $check($i + 1, $at)) {
                    break;
                }
            }
        }
        $this->assertSame([], $failures);
        $this->assertCount(9, self::cases('runs'));
        unset($failures);
        $this->assertSame('1,2', Js::string([1.0, 2.0]));
    }
}
