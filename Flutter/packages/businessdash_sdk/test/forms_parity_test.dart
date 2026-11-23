// Replays `fixtures/forms-parity.json`: inputs run through the TypeScript
// forms-core by `sdk/scripts/gen-native-forms.ts`, with the answers TS gave.
// Every case here must agree, or the Dart renderer would tell a visitor
// something the web renderer and the server don't.
//
// Each test collects every disagreement before failing, so one run shows
// the whole picture rather than the first miss.

import 'dart:io';

import 'package:businessdash_sdk/forms.dart';
import 'package:test/test.dart';

final Map<String, BdJson> fixtures =
    BdJson.parse(File('test/fixtures/forms-parity.json').readAsStringSync()).objectValue!;

List<Map<String, BdJson>> cases(String key) {
  final list = [for (final c in fixtures[key]!.arrayValue!) c.objectValue!];
  if (list.isEmpty) throw StateError('no $key cases');
  return list;
}

/// Undo the generator's `{ "$number": "NaN" }` tagging.
BdJson? untag(BdJson? v) => switch (v) {
      null => null,
      BdObj(:final fields) => switch (fields[r'$number']?.stringValue) {
          'NaN' => const BdNum(double.nan),
          'Infinity' => const BdNum(double.infinity),
          final String _ => const BdNum(double.negativeInfinity),
          null => BdObj({for (final e in fields.entries) e.key: untag(e.value)!}),
        },
      BdArr(:final items) => BdArr([for (final i in items) untag(i)!]),
      _ => v,
    };

/// JSON equality with float tolerance (libm can differ in the last ulp).
bool same(BdJson? a, BdJson? b) {
  if (a is BdNum && b is BdNum) {
    final x = a.value;
    final y = b.value;
    if (x.isNaN || y.isNaN) return x.isNaN && y.isNaN;
    return x == y || (x - y).abs() <= 1e-12 * [x.abs(), y.abs()].reduce((p, q) => p > q ? p : q);
  }
  if (a is BdArr && b is BdArr) {
    if (a.items.length != b.items.length) return false;
    for (var i = 0; i < a.items.length; i++) {
      if (!same(a.items[i], b.items[i])) return false;
    }
    return true;
  }
  if (a is BdObj && b is BdObj) {
    if (a.fields.length != b.fields.length) return false;
    return a.fields.entries.every((e) => b.fields.containsKey(e.key) && same(e.value, b.fields[e.key]));
  }
  if ((a == null || a.isNull) && (b == null || b.isNull)) return true;
  return a == b;
}

Map<String, Object?> plain(BdJson json) => json.toPlain()! as Map<String, Object?>;

BdBusinessFunction businessFunction(String id, String slug, BdJson raw) =>
    BdBusinessFunction.fromJson({...plain(raw), 'id': id, 'slug': slug});

Map<String, BdUserFunction> userFunctions(BdJson? raw) {
  final defs = raw?.objectValue;
  if (defs == null) return const {};
  return BdFormula.userFunctions({
    for (final e in defs.entries) e.key: businessFunction(e.key, e.key, e.value),
  });
}

final BdBusinessFunction fnDef = businessFunction('fn1', 'quote', fixtures['fnDef']!);

String show(BdJson? v) => v?.toJsonString() ?? '(absent)';

class Misses {
  final lines = <String>[];

  void expectThat(bool ok, String Function() what) {
    if (!ok) lines.add(what());
  }

  void check(String name) {
    if (lines.isNotEmpty) fail('$name: ${lines.length} mismatch(es)\n  ${lines.join('\n  ')}');
  }
}

void main() {
  test('number to string', () {
    final m = Misses();
    for (final c in cases('numberStrings')) {
      final n = untag(c['input'])!.doubleValue!;
      final got = BdJS.formatNumber(n);
      m.expectThat(got == c['output']!.stringValue, () => 'String($n) = $got, TS ${c['output']}');
    }
    m.check('numberStrings');
  });

  test('string to number', () {
    final m = Misses();
    for (final c in cases('numberParses')) {
      final input = c['input']!.stringValue!;
      final got = BdNum(BdJS.parseNumber(input));
      m.expectThat(same(got, untag(c['output'])), () => 'Number("$input") = ${got.value}, TS ${show(c['output'])}');
    }
    m.check('numberParses');
  });

  test('toFixed', () {
    final m = Misses();
    for (final c in cases('toFixed')) {
      final n = c['input']!.doubleValue!;
      final d = c['decimals']!.doubleValue!.toInt();
      final got = BdJS.toFixed(n, d);
      m.expectThat(got == c['output']!.stringValue, () => '($n).toFixed($d) = $got, TS ${c['output']}');
    }
    m.check('toFixed');
  });

  test('formulas', () {
    final m = Misses();
    for (final c in cases('formula')) {
      final src = c['src']!.stringValue!;
      final vars = c['vars']?.objectValue ?? const <String, BdJson>{};
      final r = BdFormula.run(src, vars, userFunctions(c['functions']));
      final expected = c['result']!.objectValue!;
      if (expected['ok'] == const BdBool(true)) {
        m.expectThat(same(r.value, untag(expected['value'])), () => '$src → $r, TS ${show(expected['value'])}');
      } else {
        m.expectThat(
          r.errorMessage == expected['error']!.stringValue,
          () => '$src → $r, TS error ${expected['error']}',
        );
      }
    }
    m.check('formula');
  });

  test('conditions', () {
    final m = Misses();
    for (final c in cases('conditions')) {
      final rule = BdConditionRule.fromJson(plain(c['rule']!));
      final data = c.containsKey('value') ? {'a': c['value']!} : const <String, BdJson>{};
      final got = BdFormRules.evalCondition(rule, data);
      m.expectThat(got == c['result']!.boolValue, () => '${show(c['rule'])} on ${show(c['value'])} = $got');
    }
    m.check('conditions');
  });

  test('validation', () {
    final m = Misses();
    for (final c in cases('validation')) {
      final field = BdFormField.make(c['field']!);
      final value = c['value'];
      final empty = BdFormRules.isEmpty(field, value);
      m.expectThat(empty == c['empty']!.boolValue, () => 'isEmpty ${field.type} ${show(value)} = $empty');
      final reason = BdFormRules.validateValue(field, value);
      m.expectThat(
        reason == c['reason']?.stringValue,
        () => 'validate ${field.type} ${show(value)} = $reason, TS ${show(c['reason'])}',
      );
    }
    m.check('validation');
  });

  test('trees', () {
    final m = Misses();
    for (final c in cases('trees')) {
      final name = c['name']!.stringValue!;
      final fields = [for (final f in c['fields']!.arrayValue!) BdFormField.make(f)];
      final data = c['data']!.objectValue!;
      final missing = [for (final f in BdFormRules.findMissingRequired(fields, data)) f.id];
      m.expectThat(
        missing.join(',') == c['missing']!.stringArray.join(','),
        () => 'missing: $name = $missing, TS ${show(c['missing'])}',
      );
      final seed = BdObj(BdFormRules.seedInitialData(fields));
      m.expectThat(same(seed, c['seed']), () => 'seed: $name = ${show(seed)}, TS ${show(c['seed'])}');
      final payload = BdObj(BdFormRules.toSubmissionPayload(fields, data));
      m.expectThat(same(payload, c['payload']), () => 'payload: $name = ${show(payload)}, TS ${show(c['payload'])}');
    }
    m.check('trees');
  });

  test('units', () {
    final m = Misses();
    for (final c in cases('units')) {
      final cat = BdUnits.category(c['category']!.stringValue)!;
      final value = c['value']!.doubleValue!;
      final unit = c['unit']!.stringValue!;
      final base = BdUnits.convertToBase(value, unit, cat);
      m.expectThat(same(base == null ? null : BdNum(base), c['base']), () => 'base $value $unit = $base, TS ${show(c['base'])}');
      final back = base == null ? null : BdUnits.convertFromBase(base, unit, cat);
      m.expectThat(same(back == null ? null : BdNum(back), c['back']), () => 'back $value $unit = $back, TS ${show(c['back'])}');
      final formatted = BdUnits.format(value, unit, cat);
      m.expectThat(formatted == c['formatted']!.stringValue, () => 'format $value $unit = $formatted, TS ${c['formatted']}');
    }
    m.check('units');
  });

  test('calculations', () {
    final m = Misses();
    for (final c in cases('calculations')) {
      final config = BdCalculationConfig.fromJson(plain(c['config']!));
      final values = c['values']!.objectValue!;
      final r = BdCalculation.compute(config, (id) => values[id], functionsById: {'fn1': fnDef});
      final expected = c['result']!.objectValue!;
      final label = show(c['config']);
      m.expectThat(r.ok == expected['ok']!.boolValue, () => 'ok $label = ${r.ok}');
      m.expectThat(same(r.value, expected['value']), () => 'value $label = ${show(r.value)}, TS ${show(expected['value'])}');
      m.expectThat(r.error == expected['error']?.stringValue, () => 'error $label = ${r.error}, TS ${show(expected['error'])}');
      final outputs = expected['outputs'];
      if (outputs != null) {
        m.expectThat(
          same(r.outputs == null ? null : BdObj(r.outputs!), outputs),
          () => 'outputs $label = ${r.outputs}, TS ${show(outputs)}',
        );
      }
    }
    m.check('calculations');
  });

  test('business functions', () {
    final m = Misses();
    for (final c in cases('businessFunctions')) {
      final inputs = c['inputs']!.objectValue!;
      final r = BdCalculation.runFunction(fnDef, inputs);
      final expected = c['result']!.objectValue!;
      m.expectThat(r.ok == expected['ok']!.boolValue, () => 'ok ${show(c['inputs'])} = ${r.ok}');
      m.expectThat(
        same(BdObj(r.outputs), expected['outputs']),
        () => 'outputs ${show(c['inputs'])} = ${BdObj(r.outputs)}, TS ${show(expected['outputs'])}',
      );
      final issues = [
        for (final i in expected['issues']!.arrayValue!)
          '${i['scope']!.stringValue}/${i['key']!.stringValue}: ${i['reason']!.stringValue}',
      ];
      m.expectThat(r.issues.join('|') == issues.join('|'), () => 'issues ${show(c['inputs'])} = ${r.issues}, TS $issues');
    }
    m.check('businessFunctions');
  });

  test('calculation display', () {
    final m = Misses();
    for (final c in cases('calcFormat')) {
      final display = BdCalcDisplay.fromJson(plain(c['display']!));
      final raw = c['value'];
      final value = raw == null || raw.isNull ? null : raw;
      final got = BdCalculation.format(value, display);
      m.expectThat(got == c['output']!.stringValue, () => '${show(value)} = $got, TS ${c['output']}');
    }
    m.check('calcFormat');
  });
}
