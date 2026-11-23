import 'dates.dart';
import 'formula.dart';
import 'json.dart';
import 'schema.dart';

/// The result of a `calculation` field.
class BdCalcOutcome {
  const BdCalcOutcome({required this.ok, this.value, this.outputs, this.error});

  final bool ok;
  final BdJson? value;
  final Map<String, BdJson>? outputs;
  final String? error;
}

/// The result of running a business function.
class BdFunctionRun {
  const BdFunctionRun({required this.ok, required this.outputs, required this.issues});

  final bool ok;
  final Map<String, BdJson> outputs;

  /// `scope/key: reason` per problem.
  final List<String> issues;
}

/// `calculation` fields and business functions: ports of forms-core's
/// `calculation.ts` and `business-function.ts`.
abstract final class BdCalculation {
  /// A form value as a formula input: blank is "no value", an array reads as
  /// its comma-joined text, everything else passes through.
  static BdJson? formulaValue(BdJson? raw) {
    if (raw == null || BdJson.isBlank(raw)) return null;
    if (raw is BdArr) return BdStr(BdJS.string(raw));
    return raw;
  }

  static BdCalcOutcome compute(
    BdCalculationConfig config,
    BdJson? Function(String fieldId) resolve, {
    Map<String, BdBusinessFunction> functionsById = const {},
    Map<String, BdUserFunction> userFunctions = const {},
  }) {
    final bindings = config.inputMap ?? const <BdBinding>[];
    if (config.mode == 'function') {
      final def = config.functionId == null ? null : functionsById[config.functionId];
      if (def == null) {
        return const BdCalcOutcome(ok: false, error: 'Referenced function not found.');
      }
      final raw = <String, BdJson?>{for (final b in bindings) b.variable: resolve(b.fieldId)};
      final run = runFunction(def, raw, userFunctions: userFunctions);
      final key = config.outputKey ?? (def.outputs.isEmpty ? null : def.outputs.first.key);
      return BdCalcOutcome(
        ok: run.ok,
        value: key == null ? null : run.outputs[key],
        outputs: run.outputs,
        error: run.ok ? null : run.issues.join('; '),
      );
    }
    final formula = config.formula == null ? '' : BdJS.trim(config.formula!);
    if (formula.isEmpty) return const BdCalcOutcome(ok: false, error: 'No formula.');
    final vars = <String, BdJson?>{
      for (final b in bindings) b.variable: formulaValue(resolve(b.fieldId)),
    };
    return switch (BdFormula.run(formula, vars, userFunctions)) {
      BdFormulaOk(:final result) => BdCalcOutcome(ok: true, value: result),
      BdFormulaError(:final message) => BdCalcOutcome(ok: false, error: message),
    };
  }

  /// Prefix + value + suffix, with fixed decimals for numbers.
  static String format(BdJson? value, BdCalcDisplay? display) {
    if (value == null || value.isNull) return '';
    final decimals = display?.decimals;
    final body = switch (value) {
      BdNum(:final value) when decimals != null && value.isFinite => BdJS.toFixed(value, decimals),
      BdObj() || BdArr() => value.toJsonString(sortKeys: true),
      _ => BdJS.string(value),
    };
    return '${display?.prefix ?? ''}$body${display?.suffix ?? ''}';
  }

  static final _isoDate = RegExp(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ].*)?$');

  /// The coerced value, or a `String` saying why it couldn't be.
  static Object _coerce(BdJson value, String type) {
    switch (type) {
      case 'any':
        return value;
      case 'object':
        return value is BdObj ? value : 'expected an object';
      case 'number':
        final n = value.doubleValue ?? BdJS.number(value);
        return n.isNaN ? 'not a number' : BdNum(n);
      case 'boolean':
        if (value is BdBool) return value;
        if (value == const BdStr('true') || value == const BdNum(1)) return const BdBool(true);
        if (value == const BdStr('false') || value == const BdNum(0)) return const BdBool(false);
        return 'not a boolean';
      case 'date':
        final s = BdJS.string(value);
        return _isoDate.hasMatch(s) && BdDates.parseInstant(s) != null ? BdStr(s) : 'not a date';
      default:
        return value is BdStr ? value : BdStr(BdJS.string(value));
    }
  }

  static bool _matches(BdJson value, String type) => switch (type) {
        'any' => true,
        'number' => value is BdNum && !value.value.isNaN,
        'text' => value.stringValue != null,
        'boolean' => value.boolValue != null,
        'object' => value.objectValue != null,
        'date' => value.stringValue != null && _isoDate.hasMatch(value.stringValue!),
        _ => false,
      };

  /// Run a business function: coerce and default its inputs, then evaluate
  /// each output in order (later outputs can read earlier ones), falling
  /// back where an output fails or comes out the wrong type.
  static BdFunctionRun runFunction(
    BdBusinessFunction def,
    Map<String, BdJson?> inputs, {
    Map<String, BdUserFunction> userFunctions = const {},
  }) {
    final issues = <String>[];
    final vars = <String, BdJson?>{};
    for (final input in def.inputs) {
      final value = inputs[input.key];
      if (value == null || BdJson.isBlank(value)) {
        final d = input.defaultValue;
        if (d != null) {
          vars[input.key] = d;
        } else if (input.required == true) {
          issues.add('input/${input.key}: required value is missing');
        }
        continue;
      }
      switch (_coerce(value, input.type)) {
        case final String reason:
          issues.add('input/${input.key}: $reason');
        case final BdJson coerced:
          vars[input.key] = coerced;
      }
    }
    final outputs = <String, BdJson>{};
    for (final out in def.outputs) {
      void fallback(String reason) {
        final fb = out.fallback;
        if (fb != null) {
          outputs[out.key] = fb;
          vars[out.key] = fb;
        } else {
          issues.add('output/${out.key}: $reason');
        }
      }

      switch (BdFormula.run(out.formula, vars, userFunctions)) {
        case BdFormulaError(:final message):
          fallback(message);
        case BdFormulaOk(:final result):
          if (_matches(result, out.type)) {
            outputs[out.key] = result;
            vars[out.key] = result;
          } else {
            fallback('expected ${out.type}');
          }
      }
    }
    return BdFunctionRun(ok: issues.isEmpty, outputs: outputs, issues: issues);
  }
}
