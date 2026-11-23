import 'dart:math' as math;

import 'dates.dart';
import 'forms_data.generated.dart' as data;
import 'json.dart';
import 'schema.dart';

/// What a formula produced: a value, or the problem that stopped it.
sealed class BdFormulaResult {
  const BdFormulaResult();

  BdJson? get value => switch (this) {
        BdFormulaOk(:final result) => result,
        BdFormulaError() => null,
      };

  String? get errorMessage => switch (this) {
        BdFormulaError(:final message) => message,
        BdFormulaOk() => null,
      };
}

final class BdFormulaOk extends BdFormulaResult {
  const BdFormulaOk(this.result);

  final BdJson result;

  @override
  String toString() => 'Ok(${result.toJsonString()})';
}

final class BdFormulaError extends BdFormulaResult {
  const BdFormulaError(this.message);

  final String message;

  @override
  String toString() => 'Error($message)';
}

/// A business function callable from a formula by its upper-cased slug.
class BdUserFunction {
  BdUserFunction._(this._params, this._ast);

  final List<String> _params;
  final _Node _ast;
}

/// A formula parsed once, to evaluate many times.
class BdParsedFormula {
  BdParsedFormula._(this._ast);

  final _Node _ast;
}

/// A formula problem; the message is what the visitor or author sees.
class _Failure implements Exception {
  _Failure(this.message);

  final String message;
}

/// BD's formula language, as used by `calculation` fields and business
/// functions: a port of forms-core's `formula.ts`.
///
/// Values are numbers, strings, booleans and objects (`addr.city`). Errors
/// are values too: a formula that divides by zero produces a result with an
/// error message, never a crash, and the message text matches the TS engine
/// so the same formula reports the same problem everywhere.
abstract final class BdFormula {
  /// Parse once, evaluate many times. Throws a [FormatException] with the TS
  /// engine's message.
  static BdParsedFormula parse(String src) {
    try {
      return BdParsedFormula._(_Parser(_tokenize(src)).parse());
    } on _Failure catch (f) {
      throw FormatException(f.message);
    }
  }

  static BdFormulaResult evaluate(
    BdParsedFormula parsed,
    Map<String, BdJson?> vars, [
    Map<String, BdUserFunction> functions = const {},
  ]) {
    try {
      return BdFormulaOk(_eval(parsed._ast, _Ctx(vars, functions, const {})));
    } on _Failure catch (f) {
      return BdFormulaError(f.message);
    } catch (_) {
      return const BdFormulaError('Formula error.');
    }
  }

  static BdFormulaResult run(
    String src,
    Map<String, BdJson?> vars, [
    Map<String, BdUserFunction> functions = const {},
  ]) {
    final _Node ast;
    try {
      ast = _Parser(_tokenize(src)).parse();
    } on _Failure catch (f) {
      return BdFormulaError(f.message);
    } catch (_) {
      return const BdFormulaError('Invalid formula.');
    }
    return evaluate(BdParsedFormula._(ast), vars, functions);
  }

  /// Business functions as formula functions, keyed by upper-cased slug.
  /// Each one evaluates its first output. A function whose formula doesn't
  /// parse is left out rather than failing the form.
  static Map<String, BdUserFunction> userFunctions(Map<String, BdBusinessFunction> defs) {
    final out = <String, BdUserFunction>{};
    for (final MapEntry(key: name, value: def) in defs.entries) {
      if (def.outputs.isEmpty) continue;
      try {
        final ast = _Parser(_tokenize(def.outputs.first.formula)).parse();
        out[name] = BdUserFunction._([for (final i in def.inputs) i.key], ast);
      } catch (_) {
        continue;
      }
    }
    return out;
  }

  // ── Tokenizer ──────────────────────────────────────────────────────────

  static const _multiOps = {'<=', '>=', '<>', '==', '!=', '&&', '||'};
  static const _singleOps = {'+', '-', '*', '/', '%', '^', '&', '<', '>', '=', '!'};

  static bool _isDigit(String? c) =>
      c != null && c.length == 1 && c.codeUnitAt(0) >= 0x30 && c.codeUnitAt(0) <= 0x39;

  static bool _isIdentStart(String c) {
    final u = c.codeUnitAt(0);
    return (u >= 0x61 && u <= 0x7A) || (u >= 0x41 && u <= 0x5A) || u == 0x5F;
  }

  static bool _isIdentPart(String c) => _isIdentStart(c) || _isDigit(c);

  static List<_Tok> _tokenize(String src) {
    final toks = <_Tok>[];
    var i = 0;
    final n = src.length;
    while (i < n) {
      final c = src[i];
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
        i++;
        continue;
      }
      if (c == '"') {
        final str = StringBuffer();
        i++;
        while (i < n && src[i] != '"') {
          if (src[i] == r'\' && i + 1 < n) {
            str.write(src[i + 1]);
            i += 2;
          } else {
            str.write(src[i]);
            i++;
          }
        }
        if (i >= n) throw _Failure('Unterminated string literal.');
        i++;
        toks.add(_Tok.str(str.toString()));
        continue;
      }
      if (_isDigit(c) || (c == '.' && i + 1 < n && _isDigit(src[i + 1]))) {
        var j = i;
        while (j < n && (_isDigit(src[j]) || src[j] == '.')) {
          j++;
        }
        if (j < n && (src[j] == 'e' || src[j] == 'E') && j + 1 < n) {
          j++;
          if (src[j] == '+' || src[j] == '-') j++;
          while (j < n && _isDigit(src[j])) {
            j++;
          }
        }
        final raw = src.substring(i, j);
        final value = BdJS.parseNumber(raw);
        if (value.isNaN) throw _Failure('Invalid number "$raw".');
        toks.add(_Tok.num(value));
        i = j;
        continue;
      }
      if (_isIdentStart(c)) {
        var j = i;
        while (j < n && _isIdentPart(src[j])) {
          j++;
        }
        toks.add(_Tok.ident(src.substring(i, j)));
        i = j;
        continue;
      }
      switch (c) {
        case '(':
          toks.add(const _Tok(_K.lparen));
          i++;
          continue;
        case ')':
          toks.add(const _Tok(_K.rparen));
          i++;
          continue;
        case ',':
          toks.add(const _Tok(_K.comma));
          i++;
          continue;
        case '.':
          toks.add(const _Tok(_K.dot));
          i++;
          continue;
      }
      if (i + 1 < n && _multiOps.contains(src.substring(i, i + 2))) {
        toks.add(_Tok.op(src.substring(i, i + 2)));
        i += 2;
        continue;
      }
      if (_singleOps.contains(c)) {
        toks.add(_Tok.op(c));
        i++;
        continue;
      }
      throw _Failure('Unexpected character "$c".');
    }
    return toks;
  }

  // ── Coercion ───────────────────────────────────────────────────────────

  static double _toNum(BdJson v) => switch (v) {
        BdNum(:final value) => value,
        BdBool(:final value) => value ? 1 : 0,
        BdObj() || BdArr() => throw _Failure('Cannot use an object as a number.'),
        BdNull() => 0,
        BdStr(:final value) => () {
            final n = BdJS.parseNumber(value);
            if (n.isNaN) throw _Failure('"$value" is not a number.');
            return n;
          }(),
      };

  static bool _toBool(BdJson v) => switch (v) {
        BdBool(:final value) => value,
        BdNum(:final value) => value != 0,
        BdObj() || BdArr() => throw _Failure('Cannot use an object as a boolean.'),
        BdNull() => false,
        BdStr(:final value) => value.isNotEmpty && value.toLowerCase() != 'false',
      };

  static String _toStr(BdJson v) => switch (v) {
        BdStr(:final value) => value,
        BdObj() || BdArr() => throw _Failure('Cannot use an object as text.'),
        _ => BdJS.string(v),
      };

  /// `Math.round`: halves round toward +∞.
  static double _jsRound(double x) {
    if (!x.isFinite) return x;
    final f = x.floorToDouble();
    return x - f >= 0.5 ? f + 1 : f;
  }

  /// `**`: like `pow`, except `1 ** NaN` and `(±1) ** ±∞` are NaN.
  static double _jsPow(double base, double exp) {
    if (exp.isNaN) return double.nan;
    if (base.abs() == 1 && exp.isInfinite) return double.nan;
    return math.pow(base, exp).toDouble();
  }

  /// `Math.log10`, exact on powers of ten (a plain `ln / ln10` isn't).
  static double _log10(double x) {
    final r = math.log(x) / math.ln10;
    if (!r.isFinite) return r;
    final rounded = r.roundToDouble();
    return (rounded - r).abs() < 1e-9 && math.pow(10, rounded) == x ? rounded : r;
  }

  /// `String.prototype.slice` over UTF-16 units (a Dart String's own units).
  static String _jsSlice(String s, double start, [double? end]) {
    final len = s.length.toDouble();
    int clamp(double v) {
      if (v.isNaN) return 0;
      final t = v.truncateToDouble();
      final r = v < 0 ? (t == 0 ? 0.0 : math.max(len + t, 0.0)) : math.min(t, len);
      return r.toInt();
    }

    final from = clamp(start);
    final to = end == null ? s.length : clamp(end);
    return from < to ? s.substring(from, to) : '';
  }

  static int _parseDate(BdJson v) => BdDates.parse(v) ?? (throw _Failure('Invalid date.'));

  static double _monthsBetween(int s, int e) {
    final a = BdDates.utcParts(s);
    final b = BdDates.utcParts(e);
    var m = (b.year - a.year) * 12 + (b.month - a.month);
    if (b.day < a.day) m -= 1;
    return m.toDouble();
  }

  static double _yearsBetween(int s, int e) {
    final a = BdDates.utcParts(s);
    final b = BdDates.utcParts(e);
    var y = b.year - a.year;
    // Feb 29 in a common year rolls to Mar 1, as `Date.UTC` does.
    if (e < BdDates.utcMillis(b.year, a.month, a.day)) y -= 1;
    return y.toDouble();
  }

  static final Map<String, String> _fileTypeByExt = {
    for (final (type, exts) in const [
      ('image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic']),
      ('video', ['mp4', 'mov', 'webm', 'mkv', 'avi']),
      ('audio', ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac']),
      ('pdf', ['pdf']),
      ('doc', ['doc', 'docx', 'txt', 'rtf', 'md', 'pages']),
      ('spreadsheet', ['xls', 'xlsx', 'csv', 'numbers']),
      ('archive', ['zip', 'rar', '7z', 'tar', 'gz']),
    ])
      for (final e in exts) e: type,
  };

  static String _fileType(String url) {
    final path = BdJS.trim(url.split(RegExp('[?#]')).first);
    final dot = path.lastIndexOf('.');
    if (dot < 0) return 'other';
    return _fileTypeByExt[path.substring(dot + 1).toLowerCase()] ?? 'other';
  }

  /// One left-to-right pass, longest find first, so a replacement is never
  /// itself re-matched.
  static String _substituteAll(String text, List<(String, String)> pairs) {
    final active = [
      for (var i = 0; i < pairs.length; i++)
        if (pairs[i].$1.isNotEmpty) (i, pairs[i]),
    ];
    if (active.isEmpty) return text;
    active.sort((a, b) {
      final byLength = b.$2.$1.length.compareTo(a.$2.$1.length);
      return byLength != 0 ? byLength : a.$1.compareTo(b.$1);
    });
    final out = StringBuffer();
    var i = 0;
    outer:
    while (i < text.length) {
      for (final (_, (find, replace)) in active) {
        if (text.startsWith(find, i)) {
          out.write(replace);
          i += find.length;
          continue outer;
        }
      }
      out.write(text[i]);
      i++;
    }
    return out.toString();
  }

  static Map<int, String>? _slugFold;

  static Map<int, String> get _folds => _slugFold ??= {
        for (final pair in data.slugFold.split(','))
          if (pair.indexOf(':') case final colon when colon > 0)
            int.parse(pair.substring(0, colon), radix: 16): pair.substring(colon + 1),
      };

  /// NFKD, combining marks dropped, lower-cased, runs of anything else as
  /// one dash. Code points NFKD folds to ASCII come from the generated table.
  static String _slugify(String text) {
    final folds = _folds;
    final out = StringBuffer();
    for (final rune in text.runes) {
      if (rune >= 0x300 && rune <= 0x36F) continue;
      final fold = folds[rune];
      out.write(fold ?? BdJS.toLowerCase(String.fromCharCode(rune)));
    }
    return out.toString().replaceAll(RegExp('[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
  }

  static double _haversine(double lat1, double lng1, double lat2, double lng2, bool miles) {
    double rad(double d) => d * math.pi / 180;
    final dLat = rad(lat2 - lat1);
    final dLng = rad(lng2 - lng1);
    final a = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLng / 2), 2);
    final km = 2 * 6371 * math.asin(math.min(1.0, math.sqrt(a)));
    return miles ? km * 0.621371 : km;
  }

  // ── Functions ──────────────────────────────────────────────────────────

  static List<double> _nums(List<BdJson> a) => [for (final x in a) _toNum(x)];

  static double _jsMin(List<double> xs) =>
      xs.any((x) => x.isNaN) ? double.nan : xs.fold(double.infinity, (m, x) => x < m || (x == 0 && m == 0 && x.isNegative) ? x : m);

  static double _jsMax(List<double> xs) =>
      xs.any((x) => x.isNaN) ? double.nan : xs.fold(double.negativeInfinity, (m, x) => x > m || (x == 0 && m == 0 && !x.isNegative) ? x : m);

  static BdJson _num(double x) => BdNum(x);

  static BdJson _roundTo(List<BdJson> a, double digitsDefault, double Function(double) op) {
    final f = _jsPow(10, a.length > 1 ? _toNum(a[1]) : digitsDefault);
    return _num(op(_toNum(a[0]) * f) / f);
  }

  static double _sum(List<double> xs) => xs.fold(0.0, (s, x) => s + x);

  static final Map<String, _FnDef> _functions = {
    'SUM': _FnDef(1, null, (a) => _num(_sum(_nums(a)))),
    'PRODUCT': _FnDef(1, null, (a) => _num(_nums(a).fold(1.0, (p, x) => p * x))),
    'ABS': _FnDef(1, 1, (a) => _num(_toNum(a[0]).abs())),
    'ROUND': _FnDef(1, 2, (a) => _roundTo(a, 0, _jsRound)),
    'ROUNDUP': _FnDef(1, 2, (a) => _roundTo(a, 0, (x) => x.ceilToDouble())),
    'ROUNDDOWN': _FnDef(1, 2, (a) => _roundTo(a, 0, (x) => x.truncateToDouble())),
    'CEILING': _FnDef(1, 1, (a) => _num(_toNum(a[0]).ceilToDouble())),
    'FLOOR': _FnDef(1, 1, (a) => _num(_toNum(a[0]).floorToDouble())),
    'INT': _FnDef(1, 1, (a) => _num(_toNum(a[0]).truncateToDouble())),
    // `remainder` is JS `%` (sign of the dividend); Dart's `%` is not.
    'MOD': _FnDef(2, 2, (a) => _num(_toNum(a[0]).remainder(_toNum(a[1])))),
    'POWER': _FnDef(2, 2, (a) => _num(_jsPow(_toNum(a[0]), _toNum(a[1])))),
    'SQRT': _FnDef(1, 1, (a) => _num(math.sqrt(_toNum(a[0])))),
    'SIGN': _FnDef(1, 1, (a) {
      final x = _toNum(a[0]);
      return _num(x.isNaN ? double.nan : (x > 0 ? 1 : (x < 0 ? -1 : x)));
    }),
    'EXP': _FnDef(1, 1, (a) => _num(math.exp(_toNum(a[0])))),
    'LN': _FnDef(1, 1, (a) => _num(math.log(_toNum(a[0])))),
    'LOG10': _FnDef(1, 1, (a) => _num(_log10(_toNum(a[0])))),
    'AVERAGE': _FnDef(1, null, (a) => _num(_sum(_nums(a)) / a.length)),
    'MIN': _FnDef(1, null, (a) => _num(_jsMin(_nums(a)))),
    'MAX': _FnDef(1, null, (a) => _num(_jsMax(_nums(a)))),
    'MEDIAN': _FnDef(1, null, (a) {
      final s = _nums(a)..sort();
      final m = s.length ~/ 2;
      return _num(s.length.isOdd ? s[m] : (s[m - 1] + s[m]) / 2);
    }),
    'COUNT': _FnDef(1, null, (a) {
      var count = 0;
      for (final x in a) {
        if (x is BdNum || (x is BdStr && BdJS.trim(x.value).isNotEmpty && !BdJS.parseNumber(x.value).isNaN)) {
          count++;
        }
      }
      return _num(count.toDouble());
    }),
    'COUNTA': _FnDef(1, null, (a) => _num(a.where((x) => x != const BdStr('') && !x.isNull).length.toDouble())),
    'IF': _FnDef(2, 3, (a) => _toBool(a[0]) ? a[1] : (a.length > 2 ? a[2] : const BdBool(false))),
    'AND': _FnDef(1, null, (a) => BdBool(a.every(_toBool))),
    'OR': _FnDef(1, null, (a) => BdBool(a.any(_toBool))),
    'NOT': _FnDef(1, 1, (a) => BdBool(!_toBool(a[0]))),
    'XOR': _FnDef(1, null, (a) => BdBool(a.where(_toBool).length.isOdd)),
    'TRUE': _FnDef(0, 0, (_) => const BdBool(true)),
    'FALSE': _FnDef(0, 0, (_) => const BdBool(false)),
    'IFS': _FnDef(2, null, (a) {
      for (var i = 0; i + 1 < a.length; i += 2) {
        if (_toBool(a[i])) return a[i + 1];
      }
      throw _Failure('No IFS condition matched.');
    }),
    'CHOOSE': _FnDef(2, null, (a) {
      final idx = _toNum(a[0]).truncateToDouble();
      if (!(idx >= 0 && idx < a.length)) throw _Failure('CHOOSE index out of range.');
      return a[idx.toInt()];
    }),
    'SWITCH': _FnDef(3, null, (a) {
      var i = 1;
      while (i + 1 < a.length) {
        if (a[i] == a[0]) return a[i + 1];
        i += 2;
      }
      return i < a.length ? a[i] : const BdBool(false);
    }),
    'CONCATENATE': _FnDef(1, null, (a) => BdStr(a.map(_toStr).join())),
    'LEN': _FnDef(1, 1, (a) => _num(_toStr(a[0]).length.toDouble())),
    'LOWER': _FnDef(1, 1, (a) => BdStr(BdJS.toLowerCase(_toStr(a[0])))),
    'UPPER': _FnDef(1, 1, (a) => BdStr(BdJS.toUpperCase(_toStr(a[0])))),
    'SUBSTITUTE': _FnDef(3, null, (a) {
      final text = _toStr(a[0]);
      final rest = a.sublist(1);
      if (rest.length.isOdd) {
        throw _Failure('SUBSTITUTE needs find/replace in pairs — it got an odd number of arguments after the text.');
      }
      final pairs = [
        for (var i = 0; i < rest.length; i += 2) (_toStr(rest[i]), _toStr(rest[i + 1])),
      ];
      return BdStr(_substituteAll(text, pairs));
    }),
    'SLUGIFY': _FnDef(1, 1, (a) => BdStr(_slugify(_toStr(a[0])))),
    'TRIM': _FnDef(1, 1, (a) => BdStr(BdJS.trim(_toStr(a[0])))),
    'LEFT': _FnDef(1, 2, (a) {
      final text = _toStr(a[0]);
      return BdStr(_jsSlice(text, 0, a.length > 1 ? _toNum(a[1]) : 1));
    }),
    'RIGHT': _FnDef(1, 2, (a) {
      final n = a.length > 1 ? _toNum(a[1]) : 1.0;
      return BdStr(_jsSlice(_toStr(a[0]), -n));
    }),
    'MID': _FnDef(3, 3, (a) {
      final start = _toNum(a[1]) - 1;
      final text = _toStr(a[0]);
      return BdStr(_jsSlice(text, start, start + _toNum(a[2])));
    }),
    'FILETYPE': _FnDef(1, 1, (a) => BdStr(_fileType(_toStr(a[0])))),
    'TODAY': _FnDef(0, 0, (_) => BdStr(BdDates.ymd(DateTime.now().millisecondsSinceEpoch))),
    'YEAR': _FnDef(1, 1, (a) => _num(BdDates.utcParts(_parseDate(a[0])).year.toDouble())),
    'MONTH': _FnDef(1, 1, (a) => _num(BdDates.utcParts(_parseDate(a[0])).month.toDouble())),
    'DAY': _FnDef(1, 1, (a) => _num(BdDates.utcParts(_parseDate(a[0])).day.toDouble())),
    'DAYS': _FnDef(2, 2, (a) {
      final end = _parseDate(a[0]);
      final start = _parseDate(a[1]);
      return _num(_jsRound((end - start) / 86400000));
    }),
    'NOW': _FnDef(0, 0, (_) => BdStr(BdDates.isoString(DateTime.now().millisecondsSinceEpoch))),
    'MINUTES': _FnDef(2, 2, (a) {
      final s = _parseDate(a[0]);
      final e = _parseDate(a[1]);
      return _num(_jsRound((e - s) / 60000));
    }),
    'HOURS': _FnDef(2, 3, (a) {
      final f = _jsPow(10, a.length > 2 ? _toNum(a[2]) : 2);
      final s = _parseDate(a[0]);
      final e = _parseDate(a[1]);
      return _num(_jsRound((e - s) / 3600000 * f) / f);
    }),
    'WEEKS': _FnDef(2, 2, (a) {
      final s = _parseDate(a[0]);
      final e = _parseDate(a[1]);
      return _num(((e - s) / 604800000).truncateToDouble());
    }),
    'MONTHS': _FnDef(2, 2, (a) => _num(_monthsBetween(_parseDate(a[0]), _parseDate(a[1])))),
    'YEARS': _FnDef(2, 2, (a) => _num(_yearsBetween(_parseDate(a[0]), _parseDate(a[1])))),
    'DATEDIFF': _FnDef(3, 3, (a) {
      final unit = _toStr(a[0]).toLowerCase();
      final s = _parseDate(a[1]);
      final e = _parseDate(a[2]);
      final d = (e - s).toDouble();
      return switch (unit) {
        'minutes' => _num(_jsRound(d / 60000)),
        'hours' => _num(_jsRound(d / 3600000 * 100) / 100),
        'days' => _num(_jsRound(d / 86400000)),
        'weeks' => _num((d / 604800000).truncateToDouble()),
        'months' => _num(_monthsBetween(s, e)),
        'years' => _num(_yearsBetween(s, e)),
        _ => throw _Failure('Unknown DATEDIFF unit "$unit".'),
      };
    }),
    'DISTANCE': _FnDef(4, 5, (a) {
      final miles = a.length > 4 && _toStr(a[4]).toLowerCase() == 'mi';
      return _num(_haversine(_toNum(a[0]), _toNum(a[1]), _toNum(a[2]), _toNum(a[3]), miles));
    }),
  };

  // ── Evaluator ──────────────────────────────────────────────────────────

  static BdJson _eval(_Node node, _Ctx ctx) => switch (node) {
        _NumNode(:final v) => BdNum(v),
        _StrNode(:final v) => BdStr(v),
        _BoolNode(:final v) => BdBool(v),
        _VarNode(:final name) => switch (ctx.vars[name]) {
            null || BdNull() => throw _Failure('Variable "$name" has no value.'),
            final v => v,
          },
        _MemberNode(:final obj, :final key) => switch (_eval(obj, ctx)) {
            BdObj(:final fields) => switch (fields[key]) {
                null || BdNull() => throw _Failure('Field "$key" has no value.'),
                final v => v,
              },
            _ => throw _Failure('Cannot read field "$key" of a non-object value.'),
          },
        _UnaryNode(:final op, :final arg) => op == 'NOT'
            ? BdBool(!_toBool(_eval(arg, ctx)))
            : () {
                final x = _toNum(_eval(arg, ctx));
                return BdNum(op == '-' ? -x : x);
              }(),
        _BinaryNode(:final op, :final l, :final r) => _evalBinary(op, l, r, ctx),
        _CallNode() => _evalCall(node, ctx),
      };

  static BdJson _evalCall(_CallNode node, _Ctx ctx) {
    final name = node.name;
    final def = _functions[name];
    if (def != null) {
      final args = [for (final a in node.args) _eval(a, ctx)];
      if (args.length < def.min || (def.max != null && args.length > def.max!)) {
        throw _Failure('$name got the wrong number of arguments.');
      }
      return def.fn(args);
    }
    final user = ctx.fns[name] ?? (throw _Failure('Unknown function "$name".'));
    if (ctx.stack.contains(name)) throw _Failure('Circular function reference: "$name".');
    if (node.args.length != user._params.length) {
      throw _Failure('$name expects ${user._params.length} argument(s).');
    }
    final args = [for (final a in node.args) _eval(a, ctx)];
    final scope = <String, BdJson?>{
      for (var i = 0; i < user._params.length; i++) user._params[i]: args[i],
    };
    return _eval(user._ast, _Ctx(scope, ctx.fns, {...ctx.stack, name}));
  }

  static BdJson _evalBinary(String op, _Node ln, _Node rn, _Ctx ctx) {
    if (op == 'AND') {
      if (!_toBool(_eval(ln, ctx))) return const BdBool(false);
      return BdBool(_toBool(_eval(rn, ctx)));
    }
    if (op == 'OR') {
      if (_toBool(_eval(ln, ctx))) return const BdBool(true);
      return BdBool(_toBool(_eval(rn, ctx)));
    }
    final l = _eval(ln, ctx);
    final r = _eval(rn, ctx);
    switch (op) {
      case '+':
        return _num(_toNum(l) + _toNum(r));
      case '-':
        return _num(_toNum(l) - _toNum(r));
      case '*':
        return _num(_toNum(l) * _toNum(r));
      case '/':
        final d = _toNum(r);
        if (d == 0) throw _Failure('Division by zero.');
        return _num(_toNum(l) / d);
      case '%':
        final d = _toNum(r);
        if (d == 0) throw _Failure('Division by zero.');
        return _num(_toNum(l).remainder(d));
      case '^':
        return _num(_jsPow(_toNum(l), _toNum(r)));
      case '&':
        return BdStr(_toStr(l) + _toStr(r));
      case '=' || '==':
        return BdBool(_looseEq(l, r));
      case '<>' || '!=':
        return BdBool(!_looseEq(l, r));
      case '<':
        return BdBool(_cmp(l, r) < 0);
      case '>':
        return BdBool(_cmp(l, r) > 0);
      case '<=':
        return BdBool(_cmp(l, r) <= 0);
      case '>=':
        return BdBool(_cmp(l, r) >= 0);
    }
    throw _Failure('Unknown operator "$op".');
  }

  static bool _looseEq(BdJson l, BdJson r) {
    if (l is BdNum || r is BdNum) {
      final a = BdJS.number(l);
      final b = BdJS.number(r);
      if (!a.isNaN && !b.isNaN) return a == b;
    }
    return _toStr(l) == _toStr(r);
  }

  static double _cmp(BdJson l, BdJson r) {
    if (l is BdNum || r is BdNum) return _toNum(l) - _toNum(r);
    // JS compares strings by UTF-16 code unit, as Dart's compareTo does.
    final c = _toStr(l).compareTo(_toStr(r));
    return c < 0 ? -1 : (c == 0 ? 0 : 1);
  }
}

class _FnDef {
  const _FnDef(this.min, this.max, this.fn);

  final int min;
  final int? max;
  final BdJson Function(List<BdJson>) fn;
}

class _Ctx {
  const _Ctx(this.vars, this.fns, this.stack);

  final Map<String, BdJson?> vars;
  final Map<String, BdUserFunction> fns;
  final Set<String> stack;
}

// ── Tokens and nodes ─────────────────────────────────────────────────────

enum _K { num, str, ident, op, lparen, rparen, comma, dot }

class _Tok {
  const _Tok(this.kind, {this.number = 0, this.text = ''});

  _Tok.num(double v) : this(_K.num, number: v);
  _Tok.str(String v) : this(_K.str, text: v);
  _Tok.ident(String v) : this(_K.ident, text: v);
  _Tok.op(String v) : this(_K.op, text: v);

  final _K kind;
  final double number;
  final String text;
}

sealed class _Node {
  const _Node();
}

final class _NumNode extends _Node {
  const _NumNode(this.v);
  final double v;
}

final class _StrNode extends _Node {
  const _StrNode(this.v);
  final String v;
}

final class _BoolNode extends _Node {
  const _BoolNode(this.v);
  final bool v;
}

final class _VarNode extends _Node {
  const _VarNode(this.name);
  final String name;
}

final class _MemberNode extends _Node {
  const _MemberNode(this.obj, this.key);
  final _Node obj;
  final String key;
}

final class _UnaryNode extends _Node {
  const _UnaryNode(this.op, this.arg);
  final String op;
  final _Node arg;
}

final class _BinaryNode extends _Node {
  const _BinaryNode(this.op, this.l, this.r);
  final String op;
  final _Node l;
  final _Node r;
}

final class _CallNode extends _Node {
  const _CallNode(this.name, this.args);
  final String name;
  final List<_Node> args;
}

class _Parser {
  _Parser(this.tokens);

  final List<_Tok> tokens;
  var pos = 0;

  static const _comparisonOps = {'=', '==', '<>', '!=', '<', '>', '<=', '>='};

  _Tok? peek() => pos < tokens.length ? tokens[pos] : null;

  _Tok? next() {
    final t = peek();
    pos++;
    return t;
  }

  _Tok eat(_K kind) {
    final t = next();
    if (t == null || t.kind != kind) throw _Failure('Expected ${kind.name}.');
    return t;
  }

  bool isKind(_K kind) => peek()?.kind == kind;

  bool isOp(String v) {
    final t = peek();
    return t != null && t.kind == _K.op && t.text == v;
  }

  bool isIdent(String v) {
    final t = peek();
    return t != null && t.kind == _K.ident && t.text.toUpperCase() == v;
  }

  _Node parse() {
    final node = parseOr();
    if (pos < tokens.length) throw _Failure('Unexpected trailing input.');
    return node;
  }

  _Node parseOr() {
    var left = parseAnd();
    while (isOp('||') || isIdent('OR')) {
      next();
      left = _BinaryNode('OR', left, parseAnd());
    }
    return left;
  }

  _Node parseAnd() {
    var left = parseNot();
    while (isOp('&&') || isIdent('AND')) {
      next();
      left = _BinaryNode('AND', left, parseNot());
    }
    return left;
  }

  _Node parseNot() {
    if (isOp('!') || isIdent('NOT')) {
      next();
      return _UnaryNode('NOT', parseNot());
    }
    return parseComparison();
  }

  _Node parseComparison() {
    var left = parseConcat();
    while (true) {
      final t = peek();
      if (t == null || t.kind != _K.op || !_comparisonOps.contains(t.text)) break;
      next();
      left = _BinaryNode(t.text, left, parseConcat());
    }
    return left;
  }

  _Node parseConcat() {
    var left = parseAdd();
    while (isOp('&')) {
      next();
      left = _BinaryNode('&', left, parseAdd());
    }
    return left;
  }

  _Node parseAdd() {
    var left = parseMul();
    while (isOp('+') || isOp('-')) {
      final op = next()!.text;
      left = _BinaryNode(op, left, parseMul());
    }
    return left;
  }

  _Node parseMul() {
    var left = parseUnary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      final op = next()!.text;
      left = _BinaryNode(op, left, parseUnary());
    }
    return left;
  }

  _Node parseUnary() {
    if (isOp('-') || isOp('+')) {
      final op = next()!.text;
      return _UnaryNode(op, parseUnary());
    }
    return parsePower();
  }

  _Node parsePower() {
    final base = parsePrimary();
    if (isOp('^')) {
      next();
      return _BinaryNode('^', base, parseUnary());
    }
    return base;
  }

  _Node parsePrimary() {
    var node = parseAtom();
    while (isKind(_K.dot)) {
      next();
      final key = eat(_K.ident).text;
      node = _MemberNode(node, key);
    }
    return node;
  }

  _Node parseAtom() {
    final t = peek() ?? (throw _Failure('Unexpected end of formula.'));
    switch (t.kind) {
      case _K.num:
        next();
        return _NumNode(t.number);
      case _K.str:
        next();
        return _StrNode(t.text);
      case _K.lparen:
        next();
        final inner = parseOr();
        eat(_K.rparen);
        return inner;
      case _K.ident:
        next();
        final upper = t.text.toUpperCase();
        if (upper == 'TRUE') return const _BoolNode(true);
        if (upper == 'FALSE') return const _BoolNode(false);
        if (isKind(_K.lparen)) {
          next();
          final args = <_Node>[];
          if (!isKind(_K.rparen)) {
            args.add(parseOr());
            while (isKind(_K.comma)) {
              next();
              args.add(parseOr());
            }
          }
          eat(_K.rparen);
          return _CallNode(upper, args);
        }
        return _VarNode(t.text);
      default:
        throw _Failure('Unexpected token.');
    }
  }
}
