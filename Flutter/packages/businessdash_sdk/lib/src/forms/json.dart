import 'dart:convert';
import 'dart:typed_data';

import 'forms_data.generated.dart' as data;

/// A form value: the JSON the BD form schema and submissions are made of.
///
/// A form answer is not one Dart type. A text field holds a string, a
/// checkbox group a list, an address an object, a rating a number, so values
/// travel as JSON and each element reads the shape it owns. Keeping the JSON
/// as JSON is also what lets a form gain an element the app was built
/// without: the value round-trips untouched.
///
/// Where a value can be missing, `null` (the Dart null) means *absent*, and
/// [BdNull] means an explicit JSON `null`. The two differ in a few of the
/// JavaScript rules the forms engine mirrors (`Number(undefined)` is NaN,
/// `Number(null)` is 0).
sealed class BdJson {
  const BdJson();

  String? get stringValue => switch (this) {
        BdStr(:final value) => value,
        _ => null,
      };

  double? get doubleValue => switch (this) {
        BdNum(:final value) => value,
        _ => null,
      };

  bool? get boolValue => switch (this) {
        BdBool(:final value) => value,
        _ => null,
      };

  List<BdJson>? get arrayValue => switch (this) {
        BdArr(:final items) => items,
        _ => null,
      };

  Map<String, BdJson>? get objectValue => switch (this) {
        BdObj(:final fields) => fields,
        _ => null,
      };

  bool get isNull => this is BdNull;

  /// Strings of a list value, skipping anything that isn't a string.
  List<String> get stringArray => [
        for (final item in arrayValue ?? const <BdJson>[])
          if (item.stringValue case final s?) s,
      ];

  BdJson? operator [](String key) => objectValue?[key];

  /// Plain Dart JSON, ready for `jsonEncode`. Whole numbers go out as ints.
  Object? toPlain() => switch (this) {
        BdNull() => null,
        BdBool(:final value) => value,
        BdNum(:final value) => !value.isFinite
            ? null
            : value == value.truncateToDouble() &&
                    value.abs() < 9007199254740992
                ? value.toInt()
                : value,
        BdStr(:final value) => value,
        BdArr(:final items) => [for (final item in items) item.toPlain()],
        BdObj(:final fields) => {
            for (final e in fields.entries) e.key: e.value.toPlain(),
          },
      };

  /// `JSON.stringify`, optionally with sorted keys.
  String toJsonString({bool sortKeys = false}) {
    final out = StringBuffer();
    _write(this, out, sortKeys);
    return out.toString();
  }

  @override
  String toString() => toJsonString();

  /// From plain Dart JSON (what `jsonDecode` returns). Anything else reads
  /// as null.
  static BdJson of(Object? value) => switch (value) {
        null => const BdNull(),
        BdJson() => value,
        bool() => BdBool(value),
        num() => BdNum(value.toDouble()),
        String() => BdStr(value),
        List<Object?>() => BdArr([for (final item in value) of(item)]),
        Map<Object?, Object?>() => BdObj({
            for (final e in value.entries) e.key.toString(): of(e.value),
          }),
        _ => const BdNull(),
      };

  /// Parse JSON text.
  static BdJson parse(String text) => of(jsonDecode(text));

  static BdJson list(List<BdJson> items) => BdArr(items);

  static BdJson obj(Map<String, BdJson> fields) => BdObj(fields);

  /// JS's "no answer": absent, `null` and `""`. An empty list is not blank.
  static bool isBlank(BdJson? value) => switch (value) {
        null || BdNull() => true,
        BdStr(:final value) => value.isEmpty,
        _ => false,
      };

  static void _write(BdJson value, StringBuffer out, bool sortKeys) {
    switch (value) {
      case BdNull():
        out.write('null');
      case BdBool(:final value):
        out.write(value);
      case BdNum(:final value):
        out.write(value.isFinite ? BdJS.formatNumber(value) : 'null');
      case BdStr(:final value):
        _writeString(value, out);
      case BdArr(:final items):
        out.write('[');
        for (var i = 0; i < items.length; i++) {
          if (i > 0) out.write(',');
          _write(items[i], out, sortKeys);
        }
        out.write(']');
      case BdObj(:final fields):
        out.write('{');
        final keys = fields.keys.toList();
        if (sortKeys) keys.sort();
        for (var i = 0; i < keys.length; i++) {
          if (i > 0) out.write(',');
          _writeString(keys[i], out);
          out.write(':');
          _write(fields[keys[i]]!, out, sortKeys);
        }
        out.write('}');
    }
  }

  static void _writeString(String s, StringBuffer out) {
    out.write('"');
    for (final c in s.codeUnits) {
      switch (c) {
        case 0x22:
          out.write(r'\"');
        case 0x5C:
          out.write(r'\\');
        case 0x08:
          out.write(r'\b');
        case 0x0C:
          out.write(r'\f');
        case 0x0A:
          out.write(r'\n');
        case 0x0D:
          out.write(r'\r');
        case 0x09:
          out.write(r'\t');
        default:
          if (c < 0x20) {
            out.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
          } else {
            out.writeCharCode(c);
          }
      }
    }
    out.write('"');
  }
}

final class BdNull extends BdJson {
  const BdNull();

  @override
  bool operator ==(Object other) => other is BdNull;

  @override
  int get hashCode => 0;
}

final class BdBool extends BdJson {
  const BdBool(this.value);

  final bool value;

  @override
  bool operator ==(Object other) => other is BdBool && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

/// Compares like a JS number: `0 == -0`, and NaN equals nothing.
final class BdNum extends BdJson {
  const BdNum(this.value);

  final double value;

  @override
  bool operator ==(Object other) => other is BdNum && other.value == value;

  @override
  int get hashCode => value == 0 ? 0 : value.hashCode;
}

final class BdStr extends BdJson {
  const BdStr(this.value);

  final String value;

  @override
  bool operator ==(Object other) => other is BdStr && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

final class BdArr extends BdJson {
  const BdArr(this.items);

  final List<BdJson> items;

  @override
  bool operator ==(Object other) {
    if (other is! BdArr || other.items.length != items.length) return false;
    for (var i = 0; i < items.length; i++) {
      if (items[i] != other.items[i]) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hashAll(items);
}

final class BdObj extends BdJson {
  const BdObj(this.fields);

  final Map<String, BdJson> fields;

  @override
  bool operator ==(Object other) {
    if (other is! BdObj || other.fields.length != fields.length) return false;
    for (final e in fields.entries) {
      final theirs = other.fields[e.key];
      if (theirs == null || theirs != e.value) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hashAllUnordered(fields.keys);
}

/// The handful of JavaScript coercions the BD form rules are written in terms
/// of. Conditions compare `String(value)`, numeric operators use `Number(x)`,
/// a calculation's display uses `toFixed`. Matching the server means matching
/// these exactly, including their odd corners (`String([1,2])` is `"1,2"`,
/// `Number("")` is `0`).
abstract final class BdJS {
  /// `String(value)` for a JSON value, the way the condition engine sees it.
  static String string(BdJson? value) => switch (value) {
        null || BdNull() => '',
        BdBool(:final value) => value ? 'true' : 'false',
        BdNum(:final value) => formatNumber(value),
        BdStr(:final value) => value,
        // Array.prototype.join: null becomes "", objects "[object Object]".
        BdArr(:final items) =>
          items.map((item) => item.isNull ? '' : string(item)).join(','),
        BdObj() => '[object Object]',
      };

  /// `Number(value)` for a JSON value.
  static double number(BdJson? value) => switch (value) {
        null => double.nan,
        BdNull() => 0,
        BdBool(:final value) => value ? 1 : 0,
        BdNum(:final value) => value,
        BdStr(:final value) => parseNumber(value),
        // ToPrimitive → join → Number: [] is 0, [x] is Number(x).
        BdArr() => parseNumber(string(value)),
        BdObj() => double.nan,
      };

  static final _decimalLiteral = RegExp(
    r'^[+-]?(?:[0-9]+\.?[0-9]*(?:[eE][+-]?[0-9]+)?|\.[0-9]+(?:[eE][+-]?[0-9]+)?)$',
  );

  /// `Number(string)`: hex/binary/octal literals, `Infinity`, whitespace,
  /// `""` → 0.
  static double parseNumber(String raw) {
    final s = trim(raw);
    if (s.isEmpty) return 0;
    switch (s) {
      case 'Infinity' || '+Infinity':
        return double.infinity;
      case '-Infinity':
        return double.negativeInfinity;
    }
    final lower = s.toLowerCase();
    for (final (prefix, radix) in const [('0x', 16), ('0b', 2), ('0o', 8)]) {
      if (!lower.startsWith(prefix)) continue;
      final digits = lower.substring(2);
      if (digits.isEmpty) return double.nan;
      var value = 0.0;
      for (final ch in digits.codeUnits) {
        final int d;
        if (ch >= 0x30 && ch <= 0x39) {
          d = ch - 0x30;
        } else if (ch >= 0x61 && ch <= 0x66) {
          d = ch - 0x61 + 10;
        } else {
          return double.nan;
        }
        if (d >= radix) return double.nan;
        value = value * radix + d;
      }
      return value;
    }
    if (!_decimalLiteral.hasMatch(s)) return double.nan;
    // Dart's parser wants a digit on both sides of the point.
    var text = s.replaceFirst(RegExp(r'\.(?=$|[eE])'), '.0');
    if (text.startsWith('.') ||
        text.startsWith('+.') ||
        text.startsWith('-.')) {
      text = text.replaceFirst('.', '0.');
    }
    return double.tryParse(text) ?? double.nan;
  }

  /// Number::toString(10): the shortest digits that round-trip, with JS's
  /// thresholds for exponent form (1e21 and 1e-7). Dart prints the same
  /// digits and thresholds, plus a `.0` on whole numbers that JS leaves off.
  static String formatNumber(double n) {
    if (n.isNaN) return 'NaN';
    if (n.isInfinite) return n > 0 ? 'Infinity' : '-Infinity';
    if (n == 0) return '0';
    final s = n.toString();
    return s.endsWith('.0') ? s.substring(0, s.length - 2) : s;
  }

  /// Number.prototype.toFixed: the exact binary value, ties away from zero,
  /// and String(x) at or above 1e21.
  static String toFixed(double n, int decimals) {
    final places = decimals.clamp(0, 100);
    if (n.isNaN) return 'NaN';
    if (n.isInfinite || n.abs() >= 1e21) return formatNumber(n);
    // `-0.0001` keeps its sign ("-0.00"); negative zero does not.
    final sign = n < 0 ? '-' : '';
    return sign + _fixedAbs(n.abs(), places);
  }

  /// [x] (finite, non-negative) rounded half-up at [places], from its exact
  /// binary value: `mantissa × 2^exponent`.
  static String _fixedAbs(double x, int places) {
    final bytes = ByteData(8)..setFloat64(0, x);
    // Two 32-bit reads: 64-bit reads aren't available on the web.
    final hi = bytes.getUint32(0);
    final lo = bytes.getUint32(4);
    final biased = (hi >> 20) & 0x7ff;
    var mantissa = (BigInt.from(hi & 0xfffff) << 32) | BigInt.from(lo);
    int exponent;
    if (biased == 0) {
      exponent = -1074;
    } else {
      mantissa |= BigInt.one << 52;
      exponent = biased - 1075;
    }
    final scale = BigInt.from(10).pow(places);
    BigInt q;
    if (exponent >= 0) {
      q = (mantissa << exponent) * scale;
    } else {
      final numerator = mantissa * scale;
      final denominator = BigInt.one << -exponent;
      q = numerator ~/ denominator;
      final remainder = numerator - q * denominator;
      if (remainder * BigInt.two >= denominator) q += BigInt.one;
    }
    var digits = q.toString();
    if (places == 0) return digits;
    if (digits.length <= places) digits = digits.padLeft(places + 1, '0');
    final point = digits.length - places;
    return '${digits.substring(0, point)}.${digits.substring(point)}';
  }

  /// JS `String.prototype.trim` whitespace: WhiteSpace and LineTerminator.
  static bool isWhitespace(int c) =>
      c == 0x09 ||
      c == 0x0A ||
      c == 0x0B ||
      c == 0x0C ||
      c == 0x0D ||
      c == 0x20 ||
      c == 0xA0 ||
      c == 0x1680 ||
      (c >= 0x2000 && c <= 0x200A) ||
      c == 0x2028 ||
      c == 0x2029 ||
      c == 0x202F ||
      c == 0x205F ||
      c == 0x3000 ||
      c == 0xFEFF;

  /// JS `toUpperCase`: Dart's, plus the mappings that yield more than one
  /// code point (`straße` → `STRASSE`).
  static String toUpperCase(String s) {
    if (!s.runes.any(data.upperExpansions.containsKey)) return s.toUpperCase();
    final out = StringBuffer();
    for (final rune in s.runes) {
      out.write(data.upperExpansions[rune] ??
          String.fromCharCode(rune).toUpperCase());
    }
    return out.toString();
  }

  static final _cased = RegExp(r'[\p{Lu}\p{Ll}\p{Lt}]', unicode: true);
  static final _caseIgnorable =
      RegExp(r"[\p{Mn}\p{Me}\p{Cf}\p{Lm}\p{Sk}'.:·’]", unicode: true);

  /// JS `toLowerCase`: Dart's, plus `İ` → `i̇` and the final-sigma rule
  /// (`ΟΔΟΣ` → `οδος`).
  static String toLowerCase(String s) {
    final runes = s.runes.toList();
    if (!runes.any((r) => r == 0x3A3 || data.lowerExpansions.containsKey(r))) {
      return s.toLowerCase();
    }
    bool test(RegExp re, int rune) => re.hasMatch(String.fromCharCode(rune));
    final out = StringBuffer();
    for (var i = 0; i < runes.length; i++) {
      final rune = runes[i];
      if (rune == 0x3A3) {
        var before = i - 1;
        while (before >= 0 && test(_caseIgnorable, runes[before])) {
          before--;
        }
        var after = i + 1;
        while (after < runes.length && test(_caseIgnorable, runes[after])) {
          after++;
        }
        final finalSigma = before >= 0 &&
            test(_cased, runes[before]) &&
            !(after < runes.length && test(_cased, runes[after]));
        out.write(finalSigma ? 'ς' : 'σ');
        continue;
      }
      out.write(data.lowerExpansions[rune] ??
          String.fromCharCode(rune).toLowerCase());
    }
    return out.toString();
  }

  /// JS `trim`. Dart's own `trim` also strips U+0085 and U+180E, which JS
  /// keeps.
  static String trim(String s) {
    var start = 0;
    var end = s.length;
    while (start < end && isWhitespace(s.codeUnitAt(start))) {
      start++;
    }
    while (end > start && isWhitespace(s.codeUnitAt(end - 1))) {
      end--;
    }
    return start == 0 && end == s.length ? s : s.substring(start, end);
  }
}
