<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * BD's formula language, as `calculation` fields and business functions use
 * it: a port of forms-core's `formula.ts`.
 *
 * Values are numbers, strings, booleans and objects (`addr.city`). Errors are
 * values too: a formula that divides by zero gives a result with a message,
 * never an exception, and the message matches the TypeScript engine's, so the
 * same formula reports the same problem everywhere.
 *
 * A result is `['ok' => true, 'value' => …]` or `['ok' => false, 'error' => '…']`.
 * The syntax tree is plain arrays: `['num', 1.0]`, `['var', 'x']`,
 * `['binary', '+', $left, $right]`, `['call', 'SUM', [$args]]`, …
 */
final class Formula
{
    /** @return array{ok: bool, value?: mixed, error?: string} */
    public static function run(string $src, array $vars, array $functions = []): array
    {
        try {
            $ast = self::parse($src);
        } catch (FormulaError $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }

        return self::evaluate($ast, $vars, $functions);
    }

    /** @return array{ok: bool, value?: mixed, error?: string} */
    public static function evaluate(array $ast, array $vars, array $functions = []): array
    {
        try {
            return ['ok' => true, 'value' => self::eval($ast, $vars, $functions, [])];
        } catch (FormulaError $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Formula error.'];
        }
    }

    /**
     * Business functions as formula functions, keyed by upper-cased slug. Each
     * evaluates its first output; one whose formula doesn't parse is left out.
     *
     * @param  array<string, stdClass>  $defs
     * @return array<string, array{params: list<string>, ast: array}>
     */
    public static function userFunctions(array $defs): array
    {
        $out = [];
        foreach ($defs as $name => $def) {
            $first = (Json::list($def->outputs ?? null) ?? [])[0] ?? null;
            if (! $first instanceof stdClass || ! is_string($first->formula ?? null)) {
                continue;
            }
            try {
                $ast = self::parse($first->formula);
            } catch (FormulaError) {
                continue;
            }
            $out[(string) $name] = [
                'params' => array_map(fn ($input) => (string) ($input->key ?? ''), Json::list($def->inputs ?? null) ?? []),
                'ast' => $ast,
            ];
        }

        return $out;
    }

    // ── Tokenizer ───────────────────────────────────────────────────────────

    private const MULTI_OPS = ['<=', '>=', '<>', '==', '!=', '&&', '||'];

    private const SINGLE_OPS = ['+', '-', '*', '/', '%', '^', '&', '<', '>', '=', '!'];

    /** @return list<array{string, mixed}> */
    public static function tokenize(string $src): array
    {
        $s = mb_str_split($src, 1, 'UTF-8');
        $n = count($s);
        $tokens = [];
        $digit = fn (?string $c) => $c !== null && $c >= '0' && $c <= '9' && strlen($c) === 1;
        $identStart = fn (string $c) => strlen($c) === 1 && (ctype_alpha($c) || $c === '_');
        $identPart = fn (string $c) => strlen($c) === 1 && (ctype_alnum($c) || $c === '_');

        $i = 0;
        while ($i < $n) {
            $c = $s[$i];
            if ($c === ' ' || $c === "\t" || $c === "\n" || $c === "\r") {
                $i++;

                continue;
            }
            if ($c === '"') {
                $str = '';
                $i++;
                while ($i < $n && $s[$i] !== '"') {
                    if ($s[$i] === '\\' && $i + 1 < $n) {
                        $str .= $s[$i + 1];
                        $i += 2;
                    } else {
                        $str .= $s[$i];
                        $i++;
                    }
                }
                if ($i >= $n) {
                    throw new FormulaError('Unterminated string literal.');
                }
                $i++;
                $tokens[] = ['str', $str];

                continue;
            }
            if ($digit($c) || ($c === '.' && $digit($s[$i + 1] ?? null))) {
                $j = $i;
                while ($j < $n && ($digit($s[$j]) || $s[$j] === '.')) {
                    $j++;
                }
                if ($j < $n && ($s[$j] === 'e' || $s[$j] === 'E') && $j + 1 < $n) {
                    $j++;
                    if ($s[$j] === '+' || $s[$j] === '-') {
                        $j++;
                    }
                    while ($j < $n && $digit($s[$j])) {
                        $j++;
                    }
                }
                $raw = implode('', array_slice($s, $i, $j - $i));
                $value = Js::parseNumber($raw);
                if (is_nan($value)) {
                    throw new FormulaError("Invalid number \"{$raw}\".");
                }
                $tokens[] = ['num', $value];
                $i = $j;

                continue;
            }
            if ($identStart($c)) {
                $j = $i;
                while ($j < $n && $identPart($s[$j])) {
                    $j++;
                }
                $tokens[] = ['ident', implode('', array_slice($s, $i, $j - $i))];
                $i = $j;

                continue;
            }
            $punctuation = ['(' => 'lparen', ')' => 'rparen', ',' => 'comma', '.' => 'dot'];
            if (isset($punctuation[$c])) {
                $tokens[] = [$punctuation[$c], null];
                $i++;

                continue;
            }
            $pair = $c.($s[$i + 1] ?? '');
            if ($i + 1 < $n && in_array($pair, self::MULTI_OPS, true)) {
                $tokens[] = ['op', $pair];
                $i += 2;

                continue;
            }
            if (in_array($c, self::SINGLE_OPS, true)) {
                $tokens[] = ['op', $c];
                $i++;

                continue;
            }
            throw new FormulaError("Unexpected character \"{$c}\".");
        }

        return $tokens;
    }

    // ── Parser ──────────────────────────────────────────────────────────────

    public static function parse(string $src): array
    {
        $parser = new FormulaParser(self::tokenize($src));

        return $parser->parse();
    }

    // ── Coercion ────────────────────────────────────────────────────────────

    public static function toNum(mixed $v): float
    {
        return match (true) {
            Json::isNumber($v) => (float) $v,
            is_bool($v) => $v ? 1.0 : 0.0,
            $v === null => 0.0,
            is_string($v) => is_nan($n = Js::parseNumber($v)) ? throw new FormulaError("\"{$v}\" is not a number.") : $n,
            default => throw new FormulaError('Cannot use an object as a number.'),
        };
    }

    public static function toBool(mixed $v): bool
    {
        return match (true) {
            is_bool($v) => $v,
            Json::isNumber($v) => $v != 0,
            $v === null => false,
            is_string($v) => $v !== '' && Js::lower($v) !== 'false',
            default => throw new FormulaError('Cannot use an object as a boolean.'),
        };
    }

    public static function toStr(mixed $v): string
    {
        return match (true) {
            is_string($v) => $v,
            is_array($v), $v instanceof stdClass => throw new FormulaError('Cannot use an object as text.'),
            default => Js::string($v),
        };
    }

    /** `**`: like pow, except `1 ** NaN` and `(±1) ** ±∞` are NaN. */
    public static function pow(float $base, float $exp): float
    {
        if (is_nan($exp)) {
            return NAN;
        }
        if (abs($base) == 1.0 && is_infinite($exp)) {
            return NAN;
        }

        return (float) ($base ** $exp);
    }

    private static function date(mixed $v): float
    {
        return Dates::parse($v) ?? throw new FormulaError('Invalid date.');
    }

    /** Whole milliseconds, as `Date.getTime()`. */
    private static function ms(float $ms): float
    {
        return round($ms);
    }

    private static function monthsBetween(float $s, float $e): float
    {
        [$ay, $am, $ad] = Dates::utcParts($s);
        [$by, $bm, $bd] = Dates::utcParts($e);
        $m = ($by - $ay) * 12 + ($bm - $am);
        if ($bd < $ad) {
            $m--;
        }

        return (float) $m;
    }

    private static function yearsBetween(float $s, float $e): float
    {
        [$ay, $am, $ad] = Dates::utcParts($s);
        [$by] = Dates::utcParts($e);
        $y = $by - $ay;
        if (self::ms($e) < Dates::utc($by, $am, $ad)) {
            $y--;
        }

        return (float) $y;
    }

    private const FILE_TYPES = [
        'image' => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic'],
        'video' => ['mp4', 'mov', 'webm', 'mkv', 'avi'],
        'audio' => ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'],
        'pdf' => ['pdf'],
        'doc' => ['doc', 'docx', 'txt', 'rtf', 'md', 'pages'],
        'spreadsheet' => ['xls', 'xlsx', 'csv', 'numbers'],
        'archive' => ['zip', 'rar', '7z', 'tar', 'gz'],
    ];

    public static function fileType(string $url): string
    {
        $path = Js::trim(preg_split('/[?#]/', $url)[0] ?? '');
        $dot = strrpos($path, '.');
        if ($dot === false) {
            return 'other';
        }
        $ext = Js::lower(substr($path, $dot + 1));
        foreach (self::FILE_TYPES as $type => $extensions) {
            if (in_array($ext, $extensions, true)) {
                return $type;
            }
        }

        return 'other';
    }

    /** One left-to-right pass, longest find first, so a replacement is never re-matched. */
    public static function substituteAll(string $text, array $pairs): string
    {
        $active = [];
        foreach ($pairs as $i => [$find, $replace]) {
            if ($find !== '') {
                $active[] = [Js::toUtf16($find), Js::toUtf16($replace), $i];
            }
        }
        if (! $active) {
            return $text;
        }
        usort($active, fn ($a, $b) => strlen($a[0]) !== strlen($b[0]) ? strlen($b[0]) <=> strlen($a[0]) : $a[2] <=> $b[2]);
        $units = Js::toUtf16($text);
        $length = strlen($units);
        $out = '';
        $i = 0;
        while ($i < $length) {
            foreach ($active as [$find, $replace]) {
                if (substr_compare($units, $find, $i, strlen($find)) === 0) {
                    $out .= $replace;
                    $i += strlen($find);

                    continue 2;
                }
            }
            $out .= substr($units, $i, 2);
            $i += 2;
        }

        return Js::fromUtf16($out);
    }

    /** @var array<int, string>|null */
    private static ?array $folds = null;

    /**
     * NFKD, combining marks dropped, lower-cased, runs of anything else as one
     * dash. Code points NFKD folds to ASCII come from the generated table, so
     * this needs no intl extension.
     */
    public static function slugify(string $text): string
    {
        if (self::$folds === null) {
            self::$folds = [];
            foreach (explode(',', FormsData::SLUG_FOLD) as $pair) {
                $colon = strpos($pair, ':');
                if ($colon > 0) {
                    self::$folds[hexdec(substr($pair, 0, $colon))] = substr($pair, $colon + 1);
                }
            }
        }
        $out = '';
        foreach (mb_str_split($text, 1, 'UTF-8') as $char) {
            $cp = mb_ord($char, 'UTF-8');
            if ($cp >= 0x300 && $cp <= 0x36F) {
                continue;
            }
            $out .= self::$folds[$cp] ?? Js::lower($char);
        }
        $out = preg_replace('/[^a-z0-9]+/', '-', $out) ?? $out;

        return preg_replace('/^-+|-+$/', '', $out) ?? $out;
    }

    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2, bool $miles): float
    {
        $rad = fn (float $d) => $d * M_PI / 180;
        $dLat = $rad($lat2 - $lat1);
        $dLng = $rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos($rad($lat1)) * cos($rad($lat2)) * sin($dLng / 2) ** 2;
        $km = 2 * 6371 * asin(min(1.0, sqrt($a)));

        return $miles ? $km * 0.621371 : $km;
    }

    // ── Functions ───────────────────────────────────────────────────────────

    private static function nums(array $a): array
    {
        return array_map(self::toNum(...), $a);
    }

    /** ROUND and friends: `$how(x × 10^digits) / 10^digits`. */
    private static function scaled(array $a, \Closure $how): float
    {
        $f = self::pow(10, count($a) > 1 ? self::toNum($a[1]) : 0);

        return $how(self::toNum($a[0]) * $f) / $f;
    }

    /** Strict equality for SWITCH. */
    private static function strictEq(mixed $a, mixed $b): bool
    {
        return Json::equal($a, $b);
    }

    /** @var array<string, array{int, int|null, \Closure}>|null */
    private static ?array $functions = null;

    /** @return array<string, array{int, int|null, \Closure}> name → [min args, max args, fn] */
    private static function functions(): array
    {
        if (self::$functions !== null) {
            return self::$functions;
        }

        return self::$functions = [
            'SUM' => [1, null, fn ($a) => array_sum(self::nums($a)) + 0.0],
            'PRODUCT' => [1, null, fn ($a) => array_product(self::nums($a)) + 0.0],
            'ABS' => [1, 1, fn ($a) => abs(self::toNum($a[0]))],
            'ROUND' => [1, 2, fn ($a) => self::scaled($a, Js::round(...))],
            'ROUNDUP' => [1, 2, fn ($a) => self::scaled($a, fn ($x) => ceil($x))],
            'ROUNDDOWN' => [1, 2, fn ($a) => self::scaled($a, Js::trunc(...))],
            'CEILING' => [1, 1, fn ($a) => ceil(self::toNum($a[0]))],
            'FLOOR' => [1, 1, fn ($a) => floor(self::toNum($a[0]))],
            'INT' => [1, 1, fn ($a) => Js::trunc(self::toNum($a[0]))],
            'MOD' => [2, 2, fn ($a) => fmod(self::toNum($a[0]), self::toNum($a[1]))],
            'POWER' => [2, 2, fn ($a) => self::pow(self::toNum($a[0]), self::toNum($a[1]))],
            'SQRT' => [1, 1, fn ($a) => sqrt(self::toNum($a[0]))],
            'SIGN' => [1, 1, function ($a) {
                $x = self::toNum($a[0]);

                return is_nan($x) ? NAN : ($x > 0 ? 1.0 : ($x < 0 ? -1.0 : $x));
            }],
            'EXP' => [1, 1, fn ($a) => exp(self::toNum($a[0]))],
            'LN' => [1, 1, fn ($a) => log(self::toNum($a[0]))],
            'LOG10' => [1, 1, fn ($a) => log10(self::toNum($a[0]))],
            'AVERAGE' => [1, null, fn ($a) => array_sum(self::nums($a)) / count($a)],
            'MIN' => [1, null, function ($a) {
                $xs = self::nums($a);
                foreach ($xs as $x) {
                    if (is_nan($x)) {
                        return NAN;
                    }
                }

                return min($xs);
            }],
            'MAX' => [1, null, function ($a) {
                $xs = self::nums($a);
                foreach ($xs as $x) {
                    if (is_nan($x)) {
                        return NAN;
                    }
                }

                return max($xs);
            }],
            'MEDIAN' => [1, null, function ($a) {
                $s = self::nums($a);
                sort($s);
                $m = intdiv(count($s), 2);

                return count($s) % 2 === 1 ? $s[$m] : ($s[$m - 1] + $s[$m]) / 2;
            }],
            'COUNT' => [1, null, fn ($a) => (float) count(array_filter($a, fn ($x) => Json::isNumber($x)
                || (is_string($x) && Js::trim($x) !== '' && ! is_nan(Js::parseNumber($x)))))],
            'COUNTA' => [1, null, fn ($a) => (float) count(array_filter($a, fn ($x) => $x !== '' && $x !== null))],
            'IF' => [2, 3, fn ($a) => self::toBool($a[0]) ? $a[1] : (count($a) > 2 ? $a[2] : false)],
            'AND' => [1, null, function ($a) {
                foreach ($a as $x) {
                    if (! self::toBool($x)) {
                        return false;
                    }
                }

                return true;
            }],
            'OR' => [1, null, function ($a) {
                foreach ($a as $x) {
                    if (self::toBool($x)) {
                        return true;
                    }
                }

                return false;
            }],
            'NOT' => [1, 1, fn ($a) => ! self::toBool($a[0])],
            'XOR' => [1, null, fn ($a) => count(array_filter(array_map(self::toBool(...), $a))) % 2 === 1],
            'TRUE' => [0, 0, fn () => true],
            'FALSE' => [0, 0, fn () => false],
            'IFS' => [2, null, function ($a) {
                for ($i = 0; $i + 1 < count($a); $i += 2) {
                    if (self::toBool($a[$i])) {
                        return $a[$i + 1];
                    }
                }
                throw new FormulaError('No IFS condition matched.');
            }],
            'CHOOSE' => [2, null, function ($a) {
                $index = Js::trunc(self::toNum($a[0]));
                if (! ($index >= 0 && $index < count($a))) {
                    throw new FormulaError('CHOOSE index out of range.');
                }

                return $a[(int) $index];
            }],
            'SWITCH' => [3, null, function ($a) {
                $i = 1;
                for (; $i + 1 < count($a); $i += 2) {
                    if (self::strictEq($a[$i], $a[0])) {
                        return $a[$i + 1];
                    }
                }

                return $i < count($a) ? $a[$i] : false;
            }],
            'CONCATENATE' => [1, null, fn ($a) => implode('', array_map(self::toStr(...), $a))],
            'LEN' => [1, 1, fn ($a) => (float) Js::length(self::toStr($a[0]))],
            'LOWER' => [1, 1, fn ($a) => Js::lower(self::toStr($a[0]))],
            'UPPER' => [1, 1, fn ($a) => Js::upper(self::toStr($a[0]))],
            'SUBSTITUTE' => [3, null, function ($a) {
                $text = self::toStr($a[0]);
                $rest = array_slice($a, 1);
                if (count($rest) % 2 !== 0) {
                    throw new FormulaError('SUBSTITUTE needs find/replace in pairs — it got an odd number of arguments after the text.');
                }
                $pairs = [];
                for ($i = 0; $i < count($rest); $i += 2) {
                    $pairs[] = [self::toStr($rest[$i]), self::toStr($rest[$i + 1])];
                }

                return self::substituteAll($text, $pairs);
            }],
            'SLUGIFY' => [1, 1, fn ($a) => self::slugify(self::toStr($a[0]))],
            'TRIM' => [1, 1, fn ($a) => Js::trim(self::toStr($a[0]))],
            'LEFT' => [1, 2, fn ($a) => Js::slice(self::toStr($a[0]), 0, count($a) > 1 ? self::toNum($a[1]) : 1)],
            'RIGHT' => [1, 2, fn ($a) => Js::slice(self::toStr($a[0]), -(count($a) > 1 ? self::toNum($a[1]) : 1))],
            'MID' => [3, 3, function ($a) {
                $start = self::toNum($a[1]) - 1;

                return Js::slice(self::toStr($a[0]), $start, $start + self::toNum($a[2]));
            }],
            'FILETYPE' => [1, 1, fn ($a) => self::fileType(self::toStr($a[0]))],
            'TODAY' => [0, 0, fn () => gmdate('Y-m-d')],
            'YEAR' => [1, 1, fn ($a) => (float) Dates::utcParts(self::date($a[0]))[0]],
            'MONTH' => [1, 1, fn ($a) => (float) Dates::utcParts(self::date($a[0]))[1]],
            'DAY' => [1, 1, fn ($a) => (float) Dates::utcParts(self::date($a[0]))[2]],
            'DAYS' => [2, 2, fn ($a) => Js::round((self::ms(self::date($a[0])) - self::ms(self::date($a[1]))) / 86_400_000)],
            'NOW' => [0, 0, fn () => Dates::isoString(microtime(true) * 1000)],
            'MINUTES' => [2, 2, fn ($a) => Js::round((self::ms(self::date($a[1])) - self::ms(self::date($a[0]))) / 60_000)],
            'HOURS' => [2, 3, function ($a) {
                $f = self::pow(10, count($a) > 2 ? self::toNum($a[2]) : 2);
                $h = (self::ms(self::date($a[1])) - self::ms(self::date($a[0]))) / 3_600_000;

                return Js::round($h * $f) / $f;
            }],
            'WEEKS' => [2, 2, fn ($a) => Js::trunc((self::ms(self::date($a[1])) - self::ms(self::date($a[0]))) / 604_800_000)],
            'MONTHS' => [2, 2, fn ($a) => self::monthsBetween(self::date($a[0]), self::date($a[1]))],
            'YEARS' => [2, 2, fn ($a) => self::yearsBetween(self::date($a[0]), self::date($a[1]))],
            'DATEDIFF' => [3, 3, function ($a) {
                $unit = Js::lower(self::toStr($a[0]));
                $s = self::date($a[1]);
                $e = self::date($a[2]);
                $d = self::ms($e) - self::ms($s);

                return match ($unit) {
                    'minutes' => Js::round($d / 60_000),
                    'hours' => Js::round($d / 3_600_000 * 100) / 100,
                    'days' => Js::round($d / 86_400_000),
                    'weeks' => Js::trunc($d / 604_800_000),
                    'months' => self::monthsBetween($s, $e),
                    'years' => self::yearsBetween($s, $e),
                    default => throw new FormulaError("Unknown DATEDIFF unit \"{$unit}\"."),
                };
            }],
            'DISTANCE' => [4, 5, function ($a) {
                $miles = count($a) > 4 && Js::lower(self::toStr($a[4])) === 'mi';

                return self::haversine(self::toNum($a[0]), self::toNum($a[1]), self::toNum($a[2]), self::toNum($a[3]), $miles);
            }],
        ];
    }

    // ── Evaluator ───────────────────────────────────────────────────────────

    private static function eval(array $node, array $vars, array $fns, array $stack): mixed
    {
        switch ($node[0]) {
            case 'num':
            case 'str':
            case 'bool':
                return $node[1];
            case 'var':
                $v = $vars[$node[1]] ?? null;
                if ($v === null) {
                    throw new FormulaError("Variable \"{$node[1]}\" has no value.");
                }

                return $v;
            case 'member':
                $obj = self::eval($node[1], $vars, $fns, $stack);
                if (! $obj instanceof stdClass) {
                    throw new FormulaError("Cannot read field \"{$node[2]}\" of a non-object value.");
                }
                $v = Json::get($obj, $node[2]);
                if ($v === null) {
                    throw new FormulaError("Field \"{$node[2]}\" has no value.");
                }

                return $v;
            case 'unary':
                if ($node[1] === 'NOT') {
                    return ! self::toBool(self::eval($node[2], $vars, $fns, $stack));
                }
                $x = self::toNum(self::eval($node[2], $vars, $fns, $stack));

                return $node[1] === '-' ? -$x : $x;
            case 'binary':
                return self::binary($node[1], $node[2], $node[3], $vars, $fns, $stack);
            case 'call':
                [, $name, $argNodes] = $node;
                $def = self::functions()[$name] ?? null;
                if ($def !== null) {
                    $args = array_map(fn ($n) => self::eval($n, $vars, $fns, $stack), $argNodes);
                    if (count($args) < $def[0] || ($def[1] !== null && count($args) > $def[1])) {
                        throw new FormulaError("{$name} got the wrong number of arguments.");
                    }

                    return self::number(($def[2])($args));
                }
                $user = $fns[$name] ?? null;
                if ($user === null) {
                    throw new FormulaError("Unknown function \"{$name}\".");
                }
                if (in_array($name, $stack, true)) {
                    throw new FormulaError("Circular function reference: \"{$name}\".");
                }
                if (count($argNodes) !== count($user['params'])) {
                    throw new FormulaError("{$name} expects ".count($user['params']).' argument(s).');
                }
                $args = array_map(fn ($n) => self::eval($n, $vars, $fns, $stack), $argNodes);
                $scope = [];
                foreach ($user['params'] as $i => $param) {
                    $scope[$param] = $args[$i];
                }

                return self::eval($user['ast'], $scope, $fns, [...$stack, $name]);
        }
        throw new FormulaError('Formula error.');
    }

    /** A function's ints (count, array_sum of ints) as JSON numbers. */
    private static function number(mixed $v): mixed
    {
        return is_int($v) ? (float) $v : $v;
    }

    private static function binary(string $op, array $ln, array $rn, array $vars, array $fns, array $stack): mixed
    {
        if ($op === 'AND') {
            return self::toBool(self::eval($ln, $vars, $fns, $stack)) && self::toBool(self::eval($rn, $vars, $fns, $stack));
        }
        if ($op === 'OR') {
            return self::toBool(self::eval($ln, $vars, $fns, $stack)) || self::toBool(self::eval($rn, $vars, $fns, $stack));
        }
        $l = self::eval($ln, $vars, $fns, $stack);
        $r = self::eval($rn, $vars, $fns, $stack);

        return match ($op) {
            '+' => self::toNum($l) + self::toNum($r),
            '-' => self::toNum($l) - self::toNum($r),
            '*' => self::toNum($l) * self::toNum($r),
            '/' => (($d = self::toNum($r)) == 0 ? throw new FormulaError('Division by zero.') : self::toNum($l) / $d),
            '%' => (($d = self::toNum($r)) == 0 ? throw new FormulaError('Division by zero.') : fmod(self::toNum($l), $d)),
            '^' => self::pow(self::toNum($l), self::toNum($r)),
            '&' => self::toStr($l).self::toStr($r),
            '=', '==' => self::looseEq($l, $r),
            '<>', '!=' => ! self::looseEq($l, $r),
            '<' => self::cmp($l, $r) < 0,
            '>' => self::cmp($l, $r) > 0,
            '<=' => self::cmp($l, $r) <= 0,
            '>=' => self::cmp($l, $r) >= 0,
            default => throw new FormulaError("Unknown operator \"{$op}\"."),
        };
    }

    private static function looseEq(mixed $l, mixed $r): bool
    {
        if (Json::isNumber($l) || Json::isNumber($r)) {
            $a = Js::number($l);
            $b = Js::number($r);
            if (! is_nan($a) && ! is_nan($b)) {
                return $a == $b;
            }
        }

        return self::toStr($l) === self::toStr($r);
    }

    private static function cmp(mixed $l, mixed $r): float
    {
        if (Json::isNumber($l) || Json::isNumber($r)) {
            return self::toNum($l) - self::toNum($r);
        }

        // UTF-16 code-unit order, as JavaScript compares strings.
        return (float) (strcmp(Js::toUtf16BigEndian(self::toStr($l)), Js::toUtf16BigEndian(self::toStr($r))) <=> 0);
    }
}
