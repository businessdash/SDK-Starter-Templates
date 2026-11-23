import 'json.dart';

/// A calendar date in UTC.
typedef BdDateParts = ({int year, int month, int day});

/// Date parsing with the server's rules (`toUtcLegacyDate`): a bare
/// `YYYY-MM-DD` is midnight UTC, an ISO instant with an offset is that
/// instant, anything else falls back to the looser `Date.parse` shapes.
///
/// Times are epoch milliseconds, the unit JS `Date` arithmetic works in, so a
/// formula's `DAYS(a, b)` divides the same numbers the server does.
abstract final class BdDates {
  /// A form value as a time: a number is epoch ms, anything else is parsed
  /// as text.
  static int? parse(BdJson value) => switch (value) {
        // `new Date(n)`: TimeClip truncates and refuses past ±8.64e15.
        BdNum(:final value) => value.isFinite && value.abs() <= 8.64e15 ? value.truncate() : null,
        _ => parseInstant(BdJS.string(value)),
      };

  static final _ymd = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');
  static final _instant = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})$',
  );
  static final _local = RegExp(r'^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$');
  static final _ym = RegExp(r'^(\d{4})-(\d{2})$');
  static final _y = RegExp(r'^(\d{4})$');

  static const _months = [
    'january', 'february', 'march', 'april', 'may', 'june', //
    'july', 'august', 'september', 'october', 'november', 'december', //
  ];

  // "March 5, 2024" / "Mar 5, 2024": local midnight, as Date.parse reads them.
  static final _monthDayYear = RegExp(r'^([A-Za-z]+) (\d{1,2}), (\d{4})$');
  static final _slashYmd = RegExp(r'^(\d{4})/(\d{1,2})/(\d{1,2})$');
  static final _slashMdy = RegExp(r'^(\d{1,2})/(\d{1,2})/(\d{4})$');
  // RFC 1123: "Fri, 15 Mar 2024 10:00:00 GMT".
  static final _rfc1123 = RegExp(
    r'^(?:[A-Za-z]{3}, )?(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? (GMT|UT|Z|[+-]\d{4})$',
  );

  static int? parseInstant(String raw) {
    final s = BdJS.trim(raw);
    if (_ymd.firstMatch(s) case final m?) {
      return utcMillis(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    }
    // ISO 8601 with an explicit offset or Z (Temporal.Instant.from).
    if (_instant.firstMatch(s) case final m?) {
      final fraction = m[7];
      final micros = fraction == null ? 0 : int.parse(fraction.padRight(9, '0').substring(0, 6));
      final utc = DateTime.utc(
        int.parse(m[1]!),
        int.parse(m[2]!),
        int.parse(m[3]!),
        int.parse(m[4]!),
        int.parse(m[5]!),
        m[6] == null ? 0 : int.parse(m[6]!),
        0,
        micros,
      );
      final zone = m[8]!;
      var offsetSeconds = 0;
      if (zone != 'Z' && zone != 'z') {
        final sign = zone.startsWith('-') ? -1 : 1;
        final digits = zone.substring(1).replaceAll(':', '');
        offsetSeconds = sign * (int.parse(digits.substring(0, 2)) * 3600 + int.parse(digits.substring(2)) * 60);
      }
      return utc.millisecondsSinceEpoch - offsetSeconds * 1000;
    }
    // Date.parse fallbacks: a date-time without offset is LOCAL time.
    if (_local.firstMatch(s) case final m?) {
      final ms = m[7] == null ? 0 : int.parse(m[7]!.padRight(3, '0'));
      return DateTime(
        int.parse(m[1]!),
        int.parse(m[2]!),
        int.parse(m[3]!),
        int.parse(m[4]!),
        int.parse(m[5]!),
        m[6] == null ? 0 : int.parse(m[6]!),
        ms,
      ).millisecondsSinceEpoch;
    }
    if (_ym.firstMatch(s) case final m?) return utcMillis(int.parse(m[1]!), int.parse(m[2]!), 1);
    if (_y.firstMatch(s) case final m?) return utcMillis(int.parse(m[1]!), 1, 1);
    if (_monthDayYear.firstMatch(s) case final m?) {
      final month = _monthIndex(m[1]!, allowFull: true);
      if (month != null) return _localDate(int.parse(m[3]!), month, int.parse(m[2]!));
    }
    if (_slashYmd.firstMatch(s) case final m?) {
      return _localDate(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    }
    if (_slashMdy.firstMatch(s) case final m?) {
      return _localDate(int.parse(m[3]!), int.parse(m[1]!), int.parse(m[2]!));
    }
    if (_rfc1123.firstMatch(s) case final m?) {
      final month = _monthIndex(m[2]!, allowFull: false);
      if (month == null) return null;
      final day = int.parse(m[1]!);
      if (!_validDate(int.parse(m[3]!), month, day)) return null;
      final utc = DateTime.utc(
        int.parse(m[3]!),
        month,
        day,
        int.parse(m[4]!),
        int.parse(m[5]!),
        m[6] == null ? 0 : int.parse(m[6]!),
      ).millisecondsSinceEpoch;
      final zone = m[7]!;
      if (zone.startsWith('+') || zone.startsWith('-')) {
        final sign = zone.startsWith('-') ? -1 : 1;
        final offset = sign * (int.parse(zone.substring(1, 3)) * 3600 + int.parse(zone.substring(3)) * 60);
        return utc - offset * 1000;
      }
      return utc;
    }
    return null;
  }

  static int? _monthIndex(String name, {required bool allowFull}) {
    final lower = name.toLowerCase();
    for (var i = 0; i < _months.length; i++) {
      if (lower == _months[i].substring(0, 3) || (allowFull && lower == _months[i])) return i + 1;
    }
    return null;
  }

  static bool _validDate(int year, int month, int day) {
    if (month < 1 || month > 12 || day < 1) return false;
    final d = DateTime.utc(year, month, day);
    return d.month == month && d.day == day;
  }

  /// A strictly valid calendar date at local midnight, else null.
  static int? _localDate(int year, int month, int day) =>
      _validDate(year, month, day) ? DateTime(year, month, day).millisecondsSinceEpoch : null;

  /// `Date.UTC(year, month - 1, day)`. Out-of-range parts roll over (month
  /// 13 is next January), as `Date.UTC` does.
  static int utcMillis(int year, int month, int day) => DateTime.utc(year, month, day).millisecondsSinceEpoch;

  static BdDateParts utcParts(int ms) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
    return (year: d.year, month: d.month, day: d.day);
  }

  /// `Date.toISOString()`: `2024-03-15T10:00:00.000Z`.
  static String isoString(int ms) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
    String two(int n) => n.toString().padLeft(2, '0');
    final year = d.year >= 0 && d.year <= 9999
        ? d.year.toString().padLeft(4, '0')
        : (d.year < 0 ? '-' : '+') + d.year.abs().toString().padLeft(6, '0');
    return '$year-${two(d.month)}-${two(d.day)}T${two(d.hour)}:${two(d.minute)}:${two(d.second)}'
        '.${d.millisecond.toString().padLeft(3, '0')}Z';
  }

  /// `YYYY-MM-DD` of an instant, in UTC (or local time).
  static String ymd(int ms, {bool local = false}) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: !local);
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// A `YYYY-MM-DD` as a calendar date (local midnight), for date pickers.
  static DateTime? localDate(String ymd) {
    final m = _ymd.firstMatch(ymd);
    if (m == null) return null;
    final y = int.parse(m[1]!);
    final mo = int.parse(m[2]!);
    final d = int.parse(m[3]!);
    return _validDate(y, mo, d) ? DateTime(y, mo, d) : null;
  }
}
