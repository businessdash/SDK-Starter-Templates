<?php

namespace Tests\Unit;

use App\Bd\Forms\Calculation;
use App\Bd\Forms\Field;
use App\Bd\Forms\Formula;
use App\Bd\Forms\Js;
use App\Bd\Forms\Json;
use App\Bd\Forms\Rules;
use App\Bd\Forms\Units;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Replays `forms-parity.json`: inputs run through the TypeScript forms-core by
 * `sdk/scripts/gen-native-forms.ts`, with the answers TypeScript gave. Every
 * case here must agree, or this starter's forms would tell a visitor something
 * the web renderer and the server don't.
 */
final class FormsParityTest extends TestCase
{
    private static ?stdClass $fixtures = null;

    /** @return list<stdClass> */
    private static function cases(string $key): array
    {
        self::$fixtures ??= Json::decode((string) file_get_contents(__DIR__.'/../Fixtures/forms-parity.json'));

        return self::$fixtures->{$key};
    }

    /** Undo the generator's `{"$number": "NaN"}` tagging. */
    public static function untag(mixed $v): mixed
    {
        if ($v instanceof stdClass) {
            if (is_string($v->{'$number'} ?? null)) {
                return match ($v->{'$number'}) {
                    'NaN' => NAN,
                    'Infinity' => INF,
                    default => -INF,
                };
            }
            $out = new stdClass;
            foreach (get_object_vars($v) as $k => $item) {
                $out->{$k} = self::untag($item);
            }

            return $out;
        }

        return is_array($v) ? array_map(self::untag(...), $v) : $v;
    }

    /** JSON equality with float tolerance (libm can differ in the last ulp); missing equals null. */
    public static function same(mixed $a, mixed $b, float $tolerance = 1e-12): bool
    {
        if (is_array($a) && ! array_is_list($a)) {
            $a = Json::objectFrom($a);
        }
        if (is_array($b) && ! array_is_list($b)) {
            $b = Json::objectFrom($b);
        }
        if (Json::isNumber($a) && Json::isNumber($b)) {
            $x = (float) $a;
            $y = (float) $b;
            if (is_nan($x) || is_nan($y)) {
                return is_nan($x) && is_nan($y);
            }

            return $x === $y || abs($x - $y) <= $tolerance * max(abs($x), abs($y));
        }
        if (is_array($a) && is_array($b)) {
            if (count($a) !== count($b)) {
                return false;
            }
            foreach ($a as $i => $item) {
                if (! self::same($item, $b[$i], $tolerance)) {
                    return false;
                }
            }

            return true;
        }
        if ($a instanceof stdClass && $b instanceof stdClass) {
            $x = get_object_vars($a);
            $y = get_object_vars($b);
            foreach (array_unique([...array_keys($x), ...array_keys($y)]) as $k) {
                if (! self::same($x[$k] ?? null, $y[$k] ?? null, $tolerance)) {
                    return false;
                }
            }

            return true;
        }

        return $a === $b;
    }

    public static function show(mixed $v): string
    {
        if (is_float($v) && ! is_finite($v)) {
            return Js::numberString($v);
        }

        return Json::encode($v);
    }

    /** @param list<string> $failures */
    private function assertNone(array $failures): void
    {
        $this->assertSame([], array_slice($failures, 0, 40), count($failures).' mismatch(es)');
    }

    public function test_number_to_string(): void
    {
        $failures = [];
        foreach (self::cases('numberStrings') as $c) {
            $n = (float) self::untag($c->input);
            $got = Js::string($n);
            if ($got !== $c->output) {
                $failures[] = "String({$c->output}) gave {$got}";
            }
        }
        $this->assertNone($failures);
    }

    public function test_string_to_number(): void
    {
        $failures = [];
        foreach (self::cases('numberParses') as $c) {
            $got = Js::number($c->input);
            if (! self::same($got, self::untag($c->output))) {
                $failures[] = 'Number('.json_encode($c->input).') gave '.self::show($got);
            }
        }
        $this->assertNone($failures);
    }

    public function test_to_fixed(): void
    {
        $failures = [];
        foreach (self::cases('toFixed') as $c) {
            $got = Js::toFixed((float) $c->input, (int) $c->decimals);
            if ($got !== $c->output) {
                $failures[] = "({$c->input}).toFixed({$c->decimals}) gave {$got}, want {$c->output}";
            }
        }
        $this->assertNone($failures);
    }

    public function test_formulas(): void
    {
        $failures = [];
        foreach (self::cases('formula') as $c) {
            $vars = Json::toMap($c->vars ?? null);
            $functions = Formula::userFunctions(Json::toMap($c->functions ?? null));
            $r = Formula::run($c->src, $vars, $functions);
            $want = $c->result;
            if ($want->ok === true) {
                if (! $r['ok'] || ! self::same($r['value'], self::untag($want->value ?? null))) {
                    $failures[] = "{$c->src} gave ".($r['ok'] ? self::show($r['value']) : 'error '.$r['error']).', want '.self::show(self::untag($want->value ?? null));
                }
            } elseif ($r['ok'] || $r['error'] !== $want->error) {
                $failures[] = "{$c->src} gave ".($r['ok'] ? self::show($r['value']) : 'error '.$r['error']).", want error {$want->error}";
            }
        }
        $this->assertNone($failures);
    }

    public function test_conditions(): void
    {
        $failures = [];
        foreach (self::cases('conditions') as $c) {
            $rule = Field::fits($c->rule, ['fieldId' => 's', 'operator' => 's', 'value' => 's', 'match' => 's', 'matchField' => 's',
                'clauses' => ['*', ['operator' => 's!', 'value' => 's']]]) ? $c->rule : null;
            $data = property_exists($c, 'value') ? ['a' => $c->value] : [];
            $got = Rules::evalConditionOn($rule, $data);
            if ($got !== $c->result) {
                $failures[] = Json::encode($c->rule).' on '.(property_exists($c, 'value') ? Json::encode($c->value) : 'missing').' gave '.json_encode($got);
            }
        }
        $this->assertNone($failures);
    }

    public function test_validation(): void
    {
        $failures = [];
        foreach (self::cases('validation') as $c) {
            $field = new Field($c->field);
            $value = $c->value ?? null;
            $label = $field->type.' '.(property_exists($c, 'value') ? Json::encode($c->value) : 'missing');
            if (Rules::isEmpty($field, $value) !== $c->empty) {
                $failures[] = "isEmpty {$label}: want ".json_encode($c->empty);
            }
            $reason = Rules::validateValue($field, $value);
            if ($reason !== ($c->reason ?? null)) {
                $failures[] = "validate {$label} ".Json::encode($c->field).': gave '.json_encode($reason).', want '.json_encode($c->reason ?? null);
            }
        }
        $this->assertNone($failures);
    }

    public function test_trees(): void
    {
        $failures = [];
        foreach (self::cases('trees') as $c) {
            $fields = Field::list($c->fields);
            $data = Json::toMap($c->data);
            $missing = array_map(fn ($m) => $m['id'], Rules::findMissingRequired($fields, $data));
            if ($missing !== $c->missing) {
                $failures[] = "missing {$c->name}: gave ".json_encode($missing).', want '.json_encode($c->missing);
            }
            $seed = Json::objectFrom(Rules::seedInitialData($fields));
            if (! self::same($seed, $c->seed)) {
                $failures[] = "seed {$c->name}: gave ".Json::encode($seed).', want '.Json::encode($c->seed);
            }
            $payload = Rules::toSubmissionPayload($fields, $data);
            if (! self::same($payload, $c->payload)) {
                $failures[] = "payload {$c->name}: gave ".Json::encode($payload).', want '.Json::encode($c->payload);
            }
        }
        $this->assertNone($failures);
    }

    public function test_units(): void
    {
        $failures = [];
        foreach (self::cases('units') as $c) {
            $category = Units::category($c->category);
            $base = Units::toBase((float) $c->value, $c->unit, $category);
            if (! self::same($base, $c->base ?? null)) {
                $failures[] = "base {$c->value} {$c->unit}: gave ".self::show($base);
            }
            $back = $base === null ? null : Units::fromBase($base, $c->unit, $category);
            if (! self::same($back, $c->back ?? null)) {
                $failures[] = "back {$c->value} {$c->unit}: gave ".self::show($back);
            }
            $formatted = Units::format((float) $c->value, $c->unit, $category);
            if ($formatted !== $c->formatted) {
                $failures[] = "format {$c->value} {$c->unit}: gave {$formatted}, want {$c->formatted}";
            }
        }
        $this->assertNone($failures);
    }

    private static function fnDef(): stdClass
    {
        $def = clone self::$fixtures->fnDef;
        $def->id = 'fn1';
        $def->slug = 'quote';

        return $def;
    }

    public function test_calculations(): void
    {
        $failures = [];
        foreach (self::cases('calculations') as $c) {
            $config = Field::fits($c->config, Field::CALCULATION) ? $c->config : new stdClass;
            $values = Json::toMap($c->values);
            $r = Calculation::compute($config, fn (string $id) => $values[$id] ?? null, ['fn1' => self::fnDef()]);
            $want = $c->result;
            $label = Json::encode($c->config);
            if ($r['ok'] !== $want->ok) {
                $failures[] = "ok {$label}";
            }
            if (! self::same($r['value'], $want->value ?? null)) {
                $failures[] = "value {$label}: gave ".self::show($r['value']);
            }
            if ($r['error'] !== ($want->error ?? null)) {
                $failures[] = "error {$label}: gave ".json_encode($r['error']).', want '.json_encode($want->error ?? null);
            }
            if (property_exists($want, 'outputs') && ! self::same($r['outputs'], $want->outputs)) {
                $failures[] = "outputs {$label}: gave ".self::show($r['outputs']);
            }
        }
        $this->assertNone($failures);
    }

    public function test_business_functions(): void
    {
        $failures = [];
        foreach (self::cases('businessFunctions') as $c) {
            $r = Calculation::runFunction(self::fnDef(), Json::toMap($c->inputs));
            $want = $c->result;
            $label = Json::encode($c->inputs);
            if ($r['ok'] !== $want->ok) {
                $failures[] = "ok {$label}";
            }
            if (! self::same(Json::objectFrom($r['outputs']), $want->outputs)) {
                $failures[] = "outputs {$label}: gave ".Json::encode(Json::objectFrom($r['outputs']));
            }
            $issues = array_map(fn ($i) => "{$i->scope}/{$i->key}: {$i->reason}", $want->issues);
            if ($r['issues'] !== $issues) {
                $failures[] = "issues {$label}: gave ".json_encode($r['issues']).', want '.json_encode($issues);
            }
        }
        $this->assertNone($failures);
    }

    public function test_calc_format(): void
    {
        $failures = [];
        foreach (self::cases('calcFormat') as $c) {
            $display = Field::fits($c->display, Field::DISPLAY) ? $c->display : null;
            $got = Calculation::format($c->value ?? null, $display);
            if ($got !== $c->output) {
                $failures[] = Json::encode($c->value ?? null).' '.Json::encode($c->display).": gave {$got}, want {$c->output}";
            }
        }
        $this->assertNone($failures);
    }
}
