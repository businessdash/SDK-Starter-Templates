import 'dart:math' as math;

import 'dates.dart';
import 'forms_data.generated.dart' as data;
import 'json.dart';
import 'schema.dart';
import 'units.dart';

/// A required field with no answer, found by the required-field walk.
class BdMissingField {
  const BdMissingField(this.id, this.label, this.path);

  /// The field's id.
  final String id;
  final String label;

  /// Unique per instance: the id at the top level, `repeater[2].child`
  /// inside a repeater. Errors are keyed by this.
  final String path;

  @override
  String toString() => 'BdMissingField($path)';
}

/// A value problem found by the client-side validation walk.
class BdInvalidField {
  const BdInvalidField(this.id, this.label, this.path, this.reason);

  final String id;
  final String label;
  final String path;
  final String reason;
}

/// Resolves a rule's compared value for a `collection_select` source with
/// `matchField`.
typedef BdMatchResolver = BdJson? Function(BdConditionRule rule, BdJson? raw);

/// Resolves the value a condition rule compares.
typedef BdRuleResolver = BdJson? Function(BdConditionRule rule);

/// An author's validation pattern, compiled with JS semantics.
class BdFieldPattern {
  const BdFieldPattern._(this.regExp, this.sticky);

  final RegExp regExp;

  /// `y`: a JS sticky regex only matches where `lastIndex` (0) points.
  final bool sticky;

  /// `RegExp.prototype.test` on a fresh regex.
  bool test(String value) => sticky ? regExp.matchAsPrefix(value) != null : regExp.hasMatch(value);
}

/// BD's form rules, ported from the server validator
/// (`apps/web/src/server/forms/validate.ts`) and the shared condition module.
///
/// The server is the authority: it re-runs all of this on submit. The point
/// of running it here first is that a visitor learns "this is required" or
/// "that isn't an email" next to the field, before a round trip, and is never
/// told something the server would then contradict. So these functions
/// follow the server line for line, including its quirks. Dart's `RegExp` is
/// JavaScript's, so the patterns are the server's own.
abstract final class BdFormRules {
  // Limits (server `validate.ts`)

  static const maxStringLen = 50000;
  static const maxTextareaLen = 200000;
  static const maxArrayLen = 500;
  static const maxPhoneLen = 64;
  static const maxDateLen = 64;
  static const maxAddressFieldLen = 512;
  static const maxNamePartLen = 128;
  static const maxNameStringLen = 1024;
  static const maxNicknames = 20;
  static const maxFileFieldLen = 4096;
  static const maxIconNameLen = 64;
  static const maxRichTextLen = 20000;
  static const maxKeys = 500;
  static const _nameValueKeys = {'prefix', 'first', 'middle', 'last', 'suffix', 'nicknames', 'full', 'short'};

  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
  static final _url = RegExp(
    r'^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::[0-9]{1,5})?(?:[/?#][^\s]*)?$',
    caseSensitive: false,
  );
  static final _hexColor = RegExp(r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
  static final _iconName = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$');
  static final _monthYear = RegExp(r'^[0-9]{4}-(0[1-9]|1[0-2])$');
  static final _usZip = RegExp(r'^[0-9]{5}(-[0-9]{4})?$');
  static final _regexLiteral = RegExp(r'^/(.*)/([dgimsuvy]*)$', dotAll: true);
  static final _htmlTag = RegExp('<[^>]*>');

  // ── Author regex ───────────────────────────────────────────────────────

  /// Compile an author's pattern: a bare source or a `/source/flags`
  /// literal. A broken pattern compiles to null and never blocks a
  /// submission.
  static BdFieldPattern? compileFieldRegex(String raw) {
    final trimmed = BdJS.trim(raw);
    final m = _regexLiteral.firstMatch(trimmed);
    final source = m?[1] ?? trimmed;
    final flags = m?[2] ?? '';
    final valid = flags.split('').toSet().length == flags.length && !(flags.contains('u') && flags.contains('v'));
    if (valid) {
      try {
        return BdFieldPattern._(
          RegExp(
            source,
            caseSensitive: !flags.contains('i'),
            multiLine: flags.contains('m'),
            dotAll: flags.contains('s'),
            unicode: flags.contains('u') || flags.contains('v'),
          ),
          flags.contains('y'),
        );
      } on FormatException {
        // Falls through to the raw text as a pattern.
      }
    }
    try {
      return BdFieldPattern._(RegExp(raw), false);
    } on FormatException {
      return null;
    }
  }

  // ── Conditions ─────────────────────────────────────────────────────────

  static bool evalClause(BdJson? value, String op, String target) => switch (op) {
        'eq' => BdJS.string(value) == target,
        'neq' => BdJS.string(value) != target,
        'contains' => BdJS.toLowerCase(BdJS.string(value)).contains(BdJS.toLowerCase(target)) || target.isEmpty,
        'gt' => BdJS.number(value) > BdJS.parseNumber(target),
        'lt' => BdJS.number(value) < BdJS.parseNumber(target),
        'is_empty' => BdJson.isBlank(value),
        'is_not_empty' => !BdJson.isBlank(value),
        _ => true,
      };

  static List<BdClause> clauses(BdConditionRule? rule) {
    final list = rule?.clauses;
    if (list != null && list.isNotEmpty) return list;
    final op = rule?.operator;
    if (op != null) return [BdClause(op, rule!.value)];
    return const [];
  }

  /// Evaluate a rule. [resolve] returns the value the rule compares, which
  /// is usually `data[rule.fieldId]` but resolves a collection record's
  /// column when `matchField` is set.
  static bool evalConditionWith(BdConditionRule? rule, BdRuleResolver resolve) {
    if (rule?.fieldId == null) return true;
    final all = clauses(rule);
    if (all.isEmpty) return true;
    final value = resolve(rule!);
    bool test(BdClause c) => evalClause(value, c.operator, c.value ?? '');
    return rule.match == 'any' ? all.any(test) : all.every(test);
  }

  static bool evalCondition(BdConditionRule? rule, Map<String, BdJson> data) =>
      evalConditionWith(rule, (r) => data[r.fieldId ?? '']);

  /// Only a `condition_block` or an `input_group` can be hidden by a rule.
  static bool isNodeVisible(BdFormField node, BdRuleResolver resolve) {
    if (node.type != 'condition_block' && node.type != 'input_group') return true;
    return evalConditionWith(node.conditionRule, resolve);
  }

  /// Single-page: one step holding everything. Consecutive: each visible
  /// top-level node is a step, so a hidden page is skipped, not shown blank.
  static List<List<BdFormField>> computeSteps(
    List<BdFormField> fields,
    bool consecutive,
    BdRuleResolver resolve,
  ) {
    if (!consecutive) return [fields];
    return [
      for (final f in fields)
        if (isNodeVisible(f, resolve)) [f],
    ];
  }

  // ── Emptiness (server `isEmpty`) ───────────────────────────────────────

  static bool isEmpty(BdFormField field, BdJson? value) {
    bool emptyArray() => value?.arrayValue?.isEmpty ?? true;
    bool emptyString() => value?.stringValue?.isEmpty ?? true;
    switch (field.type) {
      case 'checkbox' || 'tags' || 'file_upload':
        return emptyArray();
      case 'collection_select':
        return field.collectionSelectConfig?.multi == true ? emptyArray() : emptyString();
      case 'rich_text_input':
        final s = value?.stringValue;
        if (s == null) return true;
        return BdJS.trim(s.replaceAll(_htmlTag, '')).isEmpty;
      case 'month_year':
        return emptyString();
      case 'choice_cards':
        return field.choiceConfig?.mode == 'multi' ? emptyArray() : emptyString();
      case 'boolean':
        // Consent: empty unless exactly true. Otherwise any explicit choice,
        // true or false, is an answer.
        return field.mustBeTrue == true ? value != const BdBool(true) : value?.boolValue == null;
      case 'schedule':
        final s = value?.objectValue ?? const <String, BdJson>{};
        final slot = s['slotStartAt']?.stringValue?.isNotEmpty ?? false;
        final asap = s['asap'] == const BdBool(true);
        final days = !(s['days']?.arrayValue?.isEmpty ?? true);
        final times = !(s['times']?.arrayValue?.isEmpty ?? true);
        return !(slot || asap || days || times);
      case 'multi_populator':
        final arr = value?.arrayValue;
        if (arr == null) return true;
        return !arr.any(instanceHasValue);
      case 'date_range':
        return isFalsy(value?['start']) || isFalsy(value?['end']);
      case 'address':
        return isFalsy(value?['line1']) || isFalsy(value?['city']) || isFalsy(value?['state']) || isFalsy(value?['zip']);
      case 'name':
        final first = BdJS.trim(value?['first']?.stringValue ?? '');
        final last = BdJS.trim(value?['last']?.stringValue ?? '');
        return first.isEmpty || last.isEmpty;
      case 'time_picker':
        return switch (field.timeConfig?.mode ?? 'simple') {
          'time_block' => isFalsy(value?['start']) || isFalsy(value?['end']),
          'appointment' => isFalsy(value?['date']) || isFalsy(value?['time']),
          _ => BdJson.isBlank(value),
        };
      case 'star_rating':
        final n = value?.doubleValue;
        if (n == null) return true;
        return n <= 0;
      // 0 is a real answer (😞 very unhappy), not a missing one.
      case 'happiness_rating':
        return value?.doubleValue == null;
      case 'measurement':
        return value?['value']?.doubleValue == null;
      case 'url':
        return value?['url']?.stringValue?.isEmpty ?? true;
      default:
        return BdJson.isBlank(value);
    }
  }

  /// JS falsiness for the `!v?.x` checks in the server's rules.
  static bool isFalsy(BdJson? v) => switch (v) {
        null || BdNull() => true,
        BdBool(:final value) => !value,
        BdNum(:final value) => value == 0 || value.isNaN,
        BdStr(:final value) => value.isEmpty,
        _ => false,
      };

  static bool instanceHasValue(BdJson instance) {
    final o = instance.objectValue;
    if (o == null) return false;
    return o.values.any(
      (v) => switch (v) {
        BdNull() => false,
        BdStr(:final value) => value.isNotEmpty,
        BdArr(:final items) => items.isNotEmpty,
        _ => true,
      },
    );
  }

  // ── Value validation (server `validateValue`) ──────────────────────────

  static bool _isWhole(double n) => n.roundToDouble() == n;

  static bool _isAsciiDigit(int c) => c >= 0x30 && c <= 0x39;

  static String _digits(String s) => String.fromCharCodes(s.codeUnits.where(_isAsciiDigit));

  /// Why a non-empty value doesn't conform to its field, or null when it
  /// does. Reasons are the server's: `type`, `format`, `min`, `max`,
  /// `options`, `regex`, `business_email`. Empty values always pass here;
  /// required-ness is the required walk's job.
  static String? validateValue(BdFormField field, BdJson? value) {
    if (value == null || BdJson.isBlank(value)) return null;
    final opts = field.options;

    switch (field.type) {
      case 'email':
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxStringLen) return 'max';
        if (!_email.hasMatch(s)) return 'format';
        if (field.emailConfig?.businessOnly == true && isConsumerEmailDomain(emailDomain(s) ?? '')) {
          return 'business_email';
        }
        return null;
      case 'url':
        final o = value.objectValue;
        if (o == null) return 'type';
        final u = o['url'];
        if (BdJson.isBlank(u)) return null;
        final s = u?.stringValue;
        if (s == null) return 'type';
        if (s.length > maxStringLen) return 'max';
        if (!_url.hasMatch(BdJS.trim(s))) return 'format';
        final verified = o['verified'];
        if (verified != null) {
          final vs = verified.stringValue;
          if (vs == null || !const {'unverified', 'safe', 'unsafe'}.contains(vs)) return 'options';
        }
        return onlyBoundedPrimitives(o, maxStringLen) ? null : 'type';
      case 'phone':
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxPhoneLen) return 'max';
        final regex = regexFail(field, s);
        if (regex != null) return regex;
        final digits = _digits(s);
        if (field.phoneConfig?.international == true) {
          return digits.length >= 7 && digits.length <= 15 ? null : 'format';
        }
        final national = digits.length == 11 && digits.startsWith('1') ? digits.substring(1) : digits;
        return national.length == 10 ? null : 'format';
      case 'number' || 'slider' || 'stepper':
        final double n;
        if (value is BdNum) {
          n = value.value;
        } else if (value is BdStr && BdJS.trim(value.value).isNotEmpty && !BdJS.parseNumber(value.value).isNaN) {
          n = BdJS.parseNumber(value.value);
        } else {
          return 'type';
        }
        if (field.type == 'number' && field.allowDecimal == false && !_isWhole(n)) return 'format';
        if (field.type == 'number' && field.allowNegative == false && n < 0) return 'min';
        final min = field.validation?.min ?? field.sliderConfig?.min;
        final max = field.validation?.max ?? field.sliderConfig?.max;
        if (min != null && n < min) return 'min';
        if (max != null && n > max) return 'max';
        return null;
      case 'star_rating':
        final n = value.doubleValue;
        if (n == null) return 'type';
        final maxStars = (field.starRatingConfig?.maxStars ?? 5).toDouble();
        if (n < 0 || n > maxStars + 0.0001) return 'max';
        return null;
      // Five faces valued 0–4 (0 = 😞 … 4 = very happy); nothing else is a face.
      case 'happiness_rating':
        final n = value.doubleValue;
        if (n == null) return 'type';
        if (!_isWhole(n) || n < 0 || n > 4) return 'options';
        return null;
      case 'boolean':
        return value.boolValue != null ? null : 'type';
      case 'select' || 'radio':
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxStringLen) return 'max';
        if (opts != null && field.allowCustom != true && !opts.contains(s)) return 'options';
        return null;
      case 'collection_select':
        if (field.collectionSelectConfig?.multi == true) {
          final a = value.arrayValue;
          if (a == null) return 'type';
          if (a.length > maxArrayLen) return 'max';
          for (final v in a) {
            final s = v.stringValue;
            if (s == null) return 'type';
            if (s.length > maxStringLen) return 'max';
          }
          return null;
        }
        final s = value.stringValue;
        if (s == null) return 'type';
        return s.length > maxStringLen ? 'max' : null;
      case 'rich_text_input':
        final s = value.stringValue;
        if (s == null) return 'type';
        return s.length > maxRichTextLen ? 'max' : null;
      case 'month_year':
        final s = value.stringValue;
        if (s == null) return 'type';
        return _monthYear.hasMatch(s) ? null : 'format';
      case 'color_picker':
        final s = value.stringValue;
        if (s == null) return 'type';
        return _hexColor.hasMatch(s) ? null : 'format';
      case 'icon_select':
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxIconNameLen) return 'max';
        if (!_iconName.hasMatch(s)) return 'format';
        final allowed = field.iconConfig?.allowedIcons;
        if (allowed != null && allowed.isNotEmpty && !allowed.contains(s)) return 'options';
        return null;
      case 'image_input':
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxStringLen) return 'max';
        return _url.hasMatch(BdJS.trim(s)) ? null : 'format';
      case 'tags':
        final a = value.arrayValue;
        if (a == null) return 'type';
        if (a.length > maxArrayLen) return 'max';
        for (final v in a) {
          final s = v.stringValue;
          if (s == null) return 'type';
          if (s.length > maxStringLen) return 'max';
        }
        return null;
      case 'checkbox':
        final a = value.arrayValue;
        if (a == null) return 'type';
        if (a.length > maxArrayLen) return 'max';
        for (final v in a) {
          final s = v.stringValue;
          if (s == null) return 'type';
          if (opts != null && field.allowCustom != true && !opts.contains(s)) return 'options';
        }
        return null;
      case 'service_selector':
        final a = value.arrayValue;
        if (a == null) return 'type';
        if (a.length > maxArrayLen) return 'max';
        final offered = [for (final o in field.serviceConfig?.options ?? const <BdServiceOption>[]) o.id];
        for (final v in a) {
          final s = v.stringValue;
          if (s == null) return 'type';
          if (offered.isNotEmpty && !offered.contains(s)) return 'options';
        }
        return null;
      case 'choice_cards':
        final labels = [for (final o in field.choiceConfig?.options ?? const <BdChoiceOption>[]) o.label];
        if (field.choiceConfig?.mode == 'multi') {
          final a = value.arrayValue;
          if (a == null) return 'type';
          if (a.length > maxArrayLen) return 'max';
          for (final v in a) {
            final s = v.stringValue;
            if (s == null) return 'type';
            if (labels.isNotEmpty && !labels.contains(s)) return 'options';
          }
          return null;
        }
        final s = value.stringValue;
        if (s == null) return 'type';
        if (s.length > maxStringLen) return 'max';
        if (labels.isNotEmpty && !labels.contains(s)) return 'options';
        return null;
      case 'file_upload':
        final a = value.arrayValue;
        if (a == null) return 'type';
        final maxFiles = math.min(field.fileConfig?.maxFiles ?? maxArrayLen, maxArrayLen);
        if (a.length > maxFiles) return 'max';
        for (final item in a) {
          final o = item.objectValue;
          if (o == null) return 'type';
          if (!onlyBoundedPrimitives(o, maxFileFieldLen)) return 'type';
        }
        return null;
      case 'currency':
        final n = value.doubleValue;
        if (n == null || n.isNaN) return 'type';
        if (field.currencyConfig?.allowNegative != true && n < 0) return 'format';
        if (field.currencyConfig?.allowDecimal == false && !_isWhole(n)) return 'format';
        return null;
      case 'measurement':
        final o = value.objectValue;
        if (o == null) return 'type';
        if (BdJson.isBlank(o['value'])) return null;
        final n = o['value']?.doubleValue;
        if (n == null || n.isNaN) return 'type';
        final unit = o['unit']?.stringValue;
        if (unit == null) return 'type';
        final cat = BdUnits.category(field.unitConfig?.category);
        if (cat != null && !cat.contains(unit)) return 'options';
        if (field.unitConfig?.allowDecimal == false && !_isWhole(n)) return 'format';
        return onlyBoundedPrimitives(o, maxDateLen) ? null : 'type';
      case 'multi_populator':
        final a = value.arrayValue;
        if (a == null) return 'type';
        final maxInstances = math.min(field.populatorConfig?.maxInstances ?? 10, maxArrayLen);
        if (a.length > maxInstances) return 'max';
        final known = instanceValueFields(field.children ?? const []);
        for (final instance in a) {
          final o = instance.objectValue;
          if (o == null) return 'type';
          if (o.length > maxKeys) return 'max';
          for (final MapEntry(:key, value: v) in o.entries) {
            final child = known[key];
            if (child == null) return 'options';
            final reason = validateValue(child, v);
            if (reason != null) return '${child.label.isEmpty ? key : child.label}: $reason';
          }
        }
        return null;
      case 'date_range':
        final o = value.objectValue;
        if (o == null) return 'type';
        return onlyBoundedPrimitives(o, maxDateLen) ? null : 'type';
      case 'time_picker':
        if ((field.timeConfig?.mode ?? 'simple') == 'simple') {
          final s = value.stringValue;
          if (s == null) return 'type';
          return s.length > maxDateLen ? 'max' : null;
        }
        final o = value.objectValue;
        if (o == null) return 'type';
        return onlyBoundedPrimitives(o, maxDateLen) ? null : 'type';
      case 'address':
        final o = value.objectValue;
        if (o == null) return 'type';
        if (!onlyBoundedPrimitives(o, maxAddressFieldLen)) return 'type';
        final zip = o['zip']?.stringValue;
        if (zip != null && !isValidUSZip(zip)) return 'format';
        return null;
      case 'name':
        final o = value.objectValue;
        if (o == null) return 'type';
        for (final MapEntry(:key, value: v) in o.entries) {
          if (!_nameValueKeys.contains(key)) return 'options';
          if (key == 'nicknames' || v.isNull) continue;
          final s = v.stringValue;
          if (s == null) return 'type';
          final cap = key == 'full' || key == 'short' ? maxNameStringLen : maxNamePartLen;
          if (s.length > cap) return 'max';
        }
        switch (o['nicknames']) {
          case null || BdNull():
            break;
          case BdStr(:final value):
            if (value.length > maxNameStringLen) return 'max';
          case BdArr(:final items):
            if (items.length > maxNicknames) return 'max';
            for (final item in items) {
              final s = item.stringValue;
              if (s == null) return 'type';
              if (s.length > maxNamePartLen) return 'max';
            }
          default:
            return 'type';
        }
        return null;
      case 'schedule':
        final s = value.objectValue;
        if (s == null) return 'type';
        final slot = s['slotStartAt'];
        if (slot != null) {
          final str = slot.stringValue;
          if (str == null) return 'type';
          if (str.length > maxDateLen) return 'max';
          if (BdDates.parseInstant(str) == null) return 'format';
        }
        final asap = s['asap'];
        if (asap != null && asap.boolValue == null) return 'type';
        for (final key in const ['days', 'times']) {
          final raw = s[key];
          if (raw == null) continue;
          final arr = raw.arrayValue;
          if (arr == null) return 'type';
          if (arr.length > maxArrayLen) return 'max';
          for (final item in arr) {
            final str = item.stringValue;
            if (str == null) return 'type';
            if (str.length > maxDateLen) return 'max';
          }
        }
        final notes = s['notes'];
        if (notes != null) {
          final str = notes.stringValue;
          if (str == null) return 'type';
          if (str.length > maxStringLen) return 'max';
        }
        return null;
      // text / textarea / date / any plain-text input.
      default:
        return switch (value) {
          BdNum() || BdBool() => null,
          BdStr(value: final s) =>
            s.length > (field.type == 'textarea' ? maxTextareaLen : maxStringLen) ? 'max' : regexFail(field, s),
          _ => 'type',
        };
    }
  }

  static String? regexFail(BdFormField field, String value) {
    final pattern = field.regexPattern;
    if (pattern == null || pattern.isEmpty) return null;
    final re = compileFieldRegex(pattern);
    if (re == null) return null;
    return re.test(value) ? null : 'regex';
  }

  static bool onlyBoundedPrimitives(Map<String, BdJson> obj, int maxLen) => obj.values.every(
        (v) => switch (v) {
          BdNull() || BdNum() || BdBool() => true,
          BdStr(:final value) => value.length <= maxLen,
          _ => false,
        },
      );

  /// Value-bearing fields inside a repeater, keyed by id and output key.
  static Map<String, BdFormField> instanceValueFields(List<BdFormField> children) {
    final out = <String, BdFormField>{};
    void walk(List<BdFormField> nodes) {
      for (final f in nodes) {
        if (!BdFieldType.layoutOnly.contains(f.type)) {
          out[f.id] = f;
          if (f.key != null) out[f.key!] = f;
        }
        if (f.type != 'multi_populator' && f.children != null) walk(f.children!);
      }
    }

    walk(children);
    return out;
  }

  /// A US ZIP (5 digits or ZIP+4), or nothing: an address left blank has no ZIP to check.
  static bool isValidUSZip(String zip) {
    final z = BdJS.trim(zip);
    return z.isEmpty || _usZip.hasMatch(z);
  }

  static String? emailDomain(String email) {
    final at = email.lastIndexOf('@');
    if (at < 0 || at + 1 >= email.length) return null;
    return BdJS.trim(email.substring(at + 1)).toLowerCase();
  }

  static bool isConsumerEmailDomain(String host) {
    final h = BdJS.trim(host).toLowerCase();
    if (data.consumerEmailDomains.contains(h)) return true;
    return h.endsWith('.gmail.com') || h.endsWith('.googlemail.com');
  }

  // ── Required walk (server `findMissingRequiredFields`) ─────────────────

  /// Every required field with no answer under the current conditions:
  /// hidden blocks and pages enforce nothing, an either/or needs one side, a
  /// required repeater needs an entry and each filled entry its own required
  /// fields, and consent must be `true`.
  static List<BdMissingField> findMissingRequired(
    List<BdFormField> fields,
    Map<String, BdJson> data, [
    BdMatchResolver? resolveMatch,
  ]) {
    final derived = withDerivedFieldValues(fields, deriveReferenceValues(fields, data));
    final missing = <BdMissingField>[];
    _walkRequired(fields, derived, '', resolveMatch, missing);
    return missing;
  }

  static BdRuleResolver resolver(Map<String, BdJson> scope, BdMatchResolver? resolveMatch) => (rule) {
        final raw = scope[rule.fieldId ?? ''];
        return rule.matchField != null && resolveMatch != null ? resolveMatch(rule, raw) : raw;
      };

  static void _walkRequired(
    List<BdFormField> nodes,
    Map<String, BdJson> scope,
    String prefix,
    BdMatchResolver? resolveMatch,
    List<BdMissingField> missing,
  ) {
    final resolve = resolver(scope, resolveMatch);
    for (final f in nodes) {
      switch (f.type) {
        case 'condition_block':
          if (!evalConditionWith(f.conditionRule, resolve)) continue;
          _walkRequired(f.children ?? const [], scope, prefix, resolveMatch, missing);
        case 'or_condition':
          final children = f.children ?? const <BdFormField>[];
          final filled = [for (final c in children) subtreeHasValue([c], scope, resolveMatch)];
          if (children.isNotEmpty && !filled.contains(true)) {
            missing.add(BdMissingField(f.id, f.label.isEmpty ? 'Either side required' : f.label, prefix + f.id));
            continue;
          }
          for (var i = 0; i < children.length; i++) {
            if (filled[i]) _walkRequired([children[i]], scope, prefix, resolveMatch, missing);
          }
        case 'input_group' || 'flex_row':
          if (!isNodeVisible(f, resolve)) continue;
          _walkRequired(f.children ?? const [], scope, prefix, resolveMatch, missing);
        case 'multi_populator':
          final instances = scope[f.id]?.arrayValue ?? const <BdJson>[];
          final filled = [
            for (var i = 0; i < instances.length; i++)
              if (instances[i].objectValue != null && instanceHasValue(instances[i])) (i, instances[i]),
          ];
          if (f.required && filled.isEmpty) {
            missing.add(BdMissingField(f.id, f.label.isEmpty ? 'At least one entry required' : f.label, prefix + f.id));
            continue;
          }
          for (final (index, inst) in filled) {
            _walkRequired(
              f.children ?? const [],
              inst.objectValue ?? const {},
              '$prefix${f.id}[$index].',
              resolveMatch,
              missing,
            );
          }
        default:
          if (BdFieldType.staticOrLayout.contains(f.type)) continue;
          if ((f.required || f.mustBeTrue == true) && isEmpty(f, scope[f.id])) {
            missing.add(BdMissingField(f.id, f.label.isEmpty ? 'Untitled' : f.label, prefix + f.id));
          }
      }
    }
  }

  /// Does any value-bearing leaf under these nodes hold an answer? Decides
  /// which side of an either/or the visitor chose.
  static bool subtreeHasValue(
    List<BdFormField> nodes,
    Map<String, BdJson> data, [
    BdMatchResolver? resolveMatch,
  ]) {
    final resolve = resolver(data, resolveMatch);
    for (final f in nodes) {
      switch (f.type) {
        case 'condition_block':
          if (!evalConditionWith(f.conditionRule, resolve)) continue;
          if (subtreeHasValue(f.children ?? const [], data, resolveMatch)) return true;
        case 'or_condition' || 'input_group' || 'flex_row':
          if (!isNodeVisible(f, resolve)) continue;
          if (subtreeHasValue(f.children ?? const [], data, resolveMatch)) return true;
        default:
          if (BdFieldType.staticOrLayout.contains(f.type)) continue;
          if (!isEmpty(f, data[f.id])) return true;
      }
    }
    return false;
  }

  /// Concurrent reveal: show children up to and including the first one
  /// that still has a missing required answer.
  static int concurrentRevealCount(List<BdFormField> children, Map<String, BdJson> data) {
    for (var i = 0; i < children.length; i++) {
      if (findMissingRequired([children[i]], data).isNotEmpty) return i + 1;
    }
    return children.length;
  }

  // ── Derived values ─────────────────────────────────────────────────────

  /// Hidden `reference_value` elements mirror their source once the source
  /// is complete (non-empty and passing its regex), else null.
  static Map<String, BdJson> deriveReferenceValues(List<BdFormField> fields, Map<String, BdJson> data) {
    final byId = fieldsById(fields);
    final out = Map<String, BdJson>.of(data);
    for (final f in byId.values) {
      if (f.type != 'reference_value') continue;
      BdJson derived = const BdNull();
      final sourceId = f.referenceFieldId;
      final source = sourceId == null ? null : byId[sourceId];
      if (sourceId != null && source != null && !isEmpty(source, data[sourceId])) {
        final v = data[sourceId] ?? const BdNull();
        var ok = true;
        final pattern = source.regexPattern;
        if (pattern != null && pattern.isNotEmpty) {
          final re = compileFieldRegex(pattern);
          if (re != null) ok = re.test(BdJS.string(v));
        }
        if (ok) derived = v;
      }
      out[f.id] = derived;
    }
    return out;
  }

  /// One derived value per exploded checkbox option (`id::optionKey`),
  /// month/year part (`id::year`), and name part (`id::first`), so a
  /// condition can point at any of them.
  static Map<String, BdJson> withDerivedFieldValues(List<BdFormField> fields, Map<String, BdJson> data) {
    final out = Map<String, BdJson>.of(data);
    for (final field in fieldsById(fields).values) {
      final options = field.options;
      if (field.type == 'checkbox' && field.explodeOptions == true && options != null && options.isNotEmpty) {
        final picked = data[field.id]?.stringArray ?? const <String>[];
        for (final (key, option) in checkboxOptionKeys(keyBase(field), options)) {
          out['${field.id}::$key'] = BdBool(picked.contains(option));
        }
      }
      if (field.type == 'month_year' && field.explodeMonthYear == true) {
        final parts = monthYearParts(data[field.id]);
        out['${field.id}::year'] = parts == null ? const BdNull() : BdNum(parts.$1.toDouble());
        out['${field.id}::month'] = parts == null ? const BdNull() : BdNum(parts.$2.toDouble());
      }
      if (field.type == 'name') {
        final cfg = field.nameConfig;
        final parts = [
          'first', 'last', 'full', 'short', //
          if (cfg?.prefix == true) 'prefix',
          if (cfg?.middle == true) 'middle',
          if (cfg?.suffix == true) 'suffix',
          if (cfg?.nicknames == true) 'nicknames',
        ];
        for (final part in parts) {
          final v = namePartValue(data[field.id], part);
          out['${field.id}::$part'] = v == null ? const BdNull() : BdStr(v);
        }
      }
    }
    return out;
  }

  static String keyBase(BdFormField field) => field.outputKey ?? toOutputKey(field.label);

  static final _monthYearParse = RegExp(r'^([0-9]{4})-([0-9]{1,2})$');

  static (int, int)? monthYearParts(BdJson? raw) {
    final s = raw?.stringValue;
    if (s == null) return null;
    final m = _monthYearParse.firstMatch(BdJS.trim(s));
    if (m == null) return null;
    return (int.parse(m[1]!), int.parse(m[2]!));
  }

  static String? namePartValue(BdJson? raw, String part) {
    final o = raw?.objectValue;
    if (o == null) return null;
    String? nonEmpty(String? s) => s == null || s.isEmpty ? null : s;
    return switch (part) {
      'prefix' || 'first' || 'middle' || 'last' || 'suffix' => nonEmpty(o[part]?.stringValue),
      'full' => nonEmpty(o['full']?.stringValue) ?? nonEmpty(composeFullName(o)),
      'short' => nonEmpty(o['short']?.stringValue) ?? nonEmpty(composeShortName(o)),
      'nicknames' => switch (o['nicknames']?.arrayValue) {
          final list? when list.isNotEmpty => list.map(BdJS.string).join(', '),
          _ => null,
        },
      _ => null,
    };
  }

  static Map<String, BdFormField> fieldsById(List<BdFormField> fields) {
    final out = <String, BdFormField>{};
    void walk(List<BdFormField> nodes) {
      for (final f in nodes) {
        out[f.id] = f;
        if (f.children != null) walk(f.children!);
      }
    }

    walk(fields);
    return out;
  }

  // ── Output keys ────────────────────────────────────────────────────────

  static final _nonAlnum = RegExp('[^a-zA-Z0-9]+');

  /// "Best time to reach:" → "bestTimeToReach". "" when the label has no
  /// usable characters.
  static String toOutputKey(String raw) {
    final words = raw.replaceAll(_nonAlnum, ' ').split(' ').where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '';
    final key = [
      for (var i = 0; i < words.length; i++)
        i == 0 ? words[i].toLowerCase() : words[i].substring(0, 1).toUpperCase() + words[i].substring(1).toLowerCase(),
    ].join();
    return _isAsciiDigit(key.codeUnitAt(0)) ? '_$key' : key;
  }

  static List<(String, String)> checkboxOptionKeys(String fieldKey, List<String> options) {
    final used = <String>{};
    return [
      for (final option in options)
        () {
          final raw = toOutputKey(option);
          final optKey = raw.isEmpty ? 'option' : raw;
          var key = fieldKey + optKey.substring(0, 1).toUpperCase() + optKey.substring(1);
          if (used.contains(key)) {
            var n = 2;
            while (used.contains('$key$n')) {
              n++;
            }
            key = '$key$n';
          }
          used.add(key);
          return (key, option);
        }(),
    ];
  }

  // ── Names ──────────────────────────────────────────────────────────────

  static const _namePartOrder = ['prefix', 'first', 'middle', 'last', 'suffix'];

  static String _joinParts(Map<String, BdJson> v, List<String> keys) => [
        for (final k in keys)
          if (v[k]?.stringValue case final s?)
            if (BdJS.trim(s) case final t when t.isNotEmpty) t,
      ].join(' ');

  static String composeFullName(Map<String, BdJson> v) => _joinParts(v, _namePartOrder);

  static String composeShortName(Map<String, BdJson> v) => _joinParts(v, const ['first', 'last']);

  /// Trimmed parts, nicknames split into a list, `full`/`short` recomputed.
  static BdJson normalizeNameValue(BdJson raw) {
    final o = raw.objectValue;
    if (o == null) return raw;
    final out = <String, BdJson>{};
    for (final key in _namePartOrder) {
      final s = o[key]?.stringValue;
      if (s != null && BdJS.trim(s).isNotEmpty) out[key] = BdStr(BdJS.trim(s));
    }
    final nicknames = switch (o['nicknames']) {
      BdStr(:final value) => value.split(',').map(BdJS.trim).where((s) => s.isNotEmpty).toList(),
      BdArr(:final items) => [
          for (final item in items)
            if (item.stringValue case final s?)
              if (BdJS.trim(s) case final t when t.isNotEmpty) t,
        ],
      _ => const <String>[],
    };
    if (nicknames.isNotEmpty) out['nicknames'] = BdArr([for (final n in nicknames) BdStr(n)]);
    out['full'] = BdStr(composeFullName(out));
    out['short'] = BdStr(composeShortName(out));
    return BdObj(out);
  }

  // ── Seed + payload ─────────────────────────────────────────────────────

  static const _noSeedStatic = {
    'title', 'subtitle', 'separator', 'image', 'richtext', 'body_text', 'bullet_list', 'table', //
    'calculation', 'reference_value', //
  };
  static const _stepContainers = {'input_group', 'condition_block', 'or_condition'};

  /// Starting values: what each element shows before the visitor touches it.
  static Map<String, BdJson> seedInitialData(List<BdFormField> fields) {
    final out = <String, BdJson>{};
    void walk(List<BdFormField> nodes) {
      for (final f in nodes) {
        if (f.type == 'multi_populator') {
          final d = defaultValue(f);
          if (d != null) out[f.id] = d;
          continue;
        }
        if (!_noSeedStatic.contains(f.type) && !_stepContainers.contains(f.type) && f.type != 'flex_row') {
          final d = defaultValue(f);
          if (d != null) out[f.id] = d;
        }
        if (f.children != null) walk(f.children!);
      }
    }

    walk(fields);
    return out;
  }

  /// A field's starting value, or null for one that starts unanswered.
  static BdJson? defaultValue(BdFormField field) {
    final stringDefault = field.defaultValue is BdStr ? field.defaultValue! : const BdStr('');
    switch (field.type) {
      case 'checkbox' || 'tags':
        return const BdArr([]);
      case 'choice_cards':
        return field.choiceConfig?.mode == 'multi' ? const BdArr([]) : const BdStr('');
      case 'collection_select':
        return field.collectionSelectConfig?.multi == true ? const BdArr([]) : stringDefault;
      case 'multi_populator':
        return const BdArr([BdObj({})]);
      case 'measurement':
        final cat = BdUnits.category(field.unitConfig?.category) ?? BdUnits.category('length')!;
        final unit = field.unitConfig?.defaultUnit ?? (cat.units.isEmpty ? '' : cat.units.first.symbol);
        return BdObj({'value': const BdStr(''), 'unit': BdStr(unit), 'baseUnit': BdStr(cat.baseUnit)});
      case 'boolean':
        return BdBool(field.defaultValue == const BdBool(true));
      case 'number' || 'stepper' || 'star_rating':
        return const BdNum(0);
      // Start where the thumb is drawn (seeding 0 under a higher minimum
      // submitted a value the visitor never chose).
      case 'slider':
        return BdNum(field.sliderConfig?.min ?? 0);
      // 0 is a real answer (😞): an unanswered rating stays unset.
      case 'happiness_rating':
        return null;
      case 'date_range':
        return const BdObj({'start': BdStr(''), 'end': BdStr('')});
      case 'time_picker':
        return switch (field.timeConfig?.mode ?? 'simple') {
          'time_block' => const BdObj({'start': BdStr(''), 'end': BdStr('')}),
          'appointment' => const BdObj({'date': BdStr(''), 'time': BdStr('')}),
          _ => const BdStr(''),
        };
      default:
        return stringDefault;
    }
  }

  /// The wire payload: values re-keyed by each field's published output
  /// key, repeaters remapped per entry, names normalized. Hidden references
  /// never travel (the server would reject them as unknown keys).
  static Map<String, BdJson> toSubmissionPayload(List<BdFormField> fields, Map<String, BdJson> data) {
    final all = fieldsById(fields);
    Map<String, BdJson> remap(List<BdFormField> scopeFields, Map<String, BdJson> scopeData) {
      final byId = flattenValueFields(scopeFields);
      final out = <String, BdJson>{};
      for (final MapEntry(key: id, value: input) in scopeData.entries) {
        final known = all[id];
        if (known != null && BdFieldType.layoutOnly.contains(known.type)) continue;
        final field = byId[id];
        if (field == null) {
          out[id] = input;
          continue;
        }
        var value = input;
        final arr = input.arrayValue;
        if (field.type == 'multi_populator' && arr != null) {
          value = BdArr([
            for (final inst in arr)
              if (inst.objectValue case final o?) BdObj(remap(field.children ?? const [], o)) else inst,
          ]);
        }
        if (field.type == 'name' && input.objectValue != null) value = normalizeNameValue(input);
        out[field.key ?? id] = value;
      }
      return out;
    }

    return remap(fields, data);
  }

  static Map<String, BdFormField> flattenValueFields(List<BdFormField> fields) {
    final out = <String, BdFormField>{};
    void walk(List<BdFormField> nodes) {
      for (final f in nodes) {
        if (f.type == 'multi_populator') {
          out[f.id] = f;
          continue;
        }
        if (!BdFieldType.staticOrLayout.contains(f.type) || f.type == 'stepper') out[f.id] = f;
        if (f.children != null) walk(f.children!);
      }
    }

    walk(fields);
    return out;
  }

  // ── Formatting helpers ─────────────────────────────────────────────────

  /// `(555) 123-4567` as the visitor types; `+442 079 460 958` when
  /// international. Same as the web renderer's.
  static String formatPhone(String input, bool international) {
    if (international) {
      final plus = input.trimLeft().startsWith('+') ? '+' : '';
      var digits = _digits(input);
      if (digits.length > 15) digits = digits.substring(0, 15);
      final grouped = StringBuffer();
      for (var i = 0; i < digits.length; i++) {
        if (i > 0 && i % 3 == 0) grouped.write(' ');
        grouped.write(digits[i]);
      }
      return '$plus$grouped'.trim();
    }
    final d = _digits(input);
    if (d.length <= 3) return d;
    if (d.length <= 6) return '(${d.substring(0, 3)}) ${d.substring(3)}';
    return '(${d.substring(0, 3)}) ${d.substring(3, 6)}-${d.substring(6, math.min(10, d.length))}';
  }

  /// A table cell in a `check` column: ✓, –, or its own text.
  static String tableCheckState(String cell) {
    final v = cell.trim().toLowerCase();
    if (const {'yes', 'y', 'true', '1', 'x', '✓', '✔', 'check'}.contains(v)) return 'yes';
    if (const {'no', 'n', 'false', '0', '-', '–', '—', ''}.contains(v)) return 'no';
    return 'text';
  }

  /// Only http(s) links leave the form. Returns the trimmed link, or null.
  static String? safeHttpUrl(String? raw) {
    final s = raw?.trim();
    if (s == null || s.isEmpty) return null;
    final scheme = Uri.tryParse(s)?.scheme.toLowerCase();
    return scheme == 'http' || scheme == 'https' ? s : null;
  }

  // ── Whole-tree value validation ────────────────────────────────────────

  /// Every visible, answered field whose value doesn't conform, walking the
  /// tree the way the required walk does (hidden blocks and pages are
  /// skipped; each repeater entry is checked field by field, so the error
  /// lands on the entry's own field rather than on the repeater).
  static List<BdInvalidField> findInvalidValues(
    List<BdFormField> fields,
    Map<String, BdJson> data, [
    BdMatchResolver? resolveMatch,
  ]) {
    final derived = withDerivedFieldValues(fields, deriveReferenceValues(fields, data));
    final out = <BdInvalidField>[];
    _walkValues(fields, derived, '', resolveMatch, out);
    return out;
  }

  static void _walkValues(
    List<BdFormField> nodes,
    Map<String, BdJson> scope,
    String prefix,
    BdMatchResolver? resolveMatch,
    List<BdInvalidField> out,
  ) {
    final resolve = resolver(scope, resolveMatch);
    for (final f in nodes) {
      switch (f.type) {
        case 'condition_block' || 'input_group' || 'flex_row' || 'or_condition':
          final visible =
              f.type == 'condition_block' ? evalConditionWith(f.conditionRule, resolve) : isNodeVisible(f, resolve);
          if (!visible) continue;
          _walkValues(f.children ?? const [], scope, prefix, resolveMatch, out);
        case 'multi_populator':
          final instances = scope[f.id]?.arrayValue ?? const <BdJson>[];
          final max = math.min(f.populatorConfig?.maxInstances ?? 10, maxArrayLen);
          if (instances.length > max) out.add(BdInvalidField(f.id, f.label, prefix + f.id, 'max'));
          for (var index = 0; index < instances.length; index++) {
            final o = instances[index].objectValue;
            if (o == null) continue;
            _walkValues(f.children ?? const [], o, '$prefix${f.id}[$index].', resolveMatch, out);
          }
        default:
          if (BdFieldType.layoutOnly.contains(f.type) || f.type == 'calculation') continue;
          final value = scope[f.id];
          if (isPendingUpload(value)) continue;
          final reason = validateValue(f, value) ?? clientOnlyRule(f, value);
          if (reason != null) out.add(BdInvalidField(f.id, f.label, prefix + f.id, reason));
      }
    }
  }

  /// Checks the server doesn't make but a visitor should hear about: a range
  /// that ends before it starts.
  static String? clientOnlyRule(BdFormField field, BdJson? value) {
    final s = value?['start']?.stringValue;
    final e = value?['end']?.stringValue;
    if (s == null || s.isEmpty || e == null || e.isEmpty) return null;
    if (field.type == 'date_range') {
      if (e.compareTo(s) < 0) return 'range_order';
      if (e == s && field.dateRangeConfig?.allowSameDay == false) return 'range_same_day';
      return null;
    }
    if (field.type == 'time_picker' && field.timeConfig?.mode == 'time_block') {
      return e.compareTo(s) <= 0 ? 'range_order' : null;
    }
    return null;
  }

  // ── Uploads ────────────────────────────────────────────────────────────

  /// A picked file waiting for submit. Stored in the value tree as a
  /// placeholder object so required checks and file counts see it, and
  /// swapped for the uploaded file (or image URL) on submit.
  static bool isPendingUpload(BdJson? value) =>
      value != null && value['pending'] == const BdBool(true) && value['localId']?.stringValue != null;

  static const _phoneImageTypes = ['image/heic', 'image/heif'];
  static const _phoneVideoTypes = ['video/quicktime'];

  /// The author's allowed types, plus the formats phone cameras produce for
  /// them (HEIC photos, QuickTime video) so "images only" accepts a photo
  /// straight off the camera.
  static List<String> expandAllowedTypes(List<String> allowed) {
    final out = [...allowed];
    void add(String t) {
      if (!out.contains(t)) out.add(t);
    }

    if (allowed.any((t) => t == 'image/*' || (t.startsWith('image/') && !t.contains('heic')))) {
      _phoneImageTypes.forEach(add);
      add('.heic');
      add('.heif');
    }
    if (allowed.any((t) => t == 'video/*' || t.startsWith('video/'))) {
      _phoneVideoTypes.forEach(add);
      add('.mov');
    }
    return out;
  }

  static bool isFileTypeAllowed(String name, String mimeType, List<String>? allowed) {
    if (allowed == null || allowed.isEmpty) return true;
    final type = mimeType.toLowerCase();
    final dot = name.lastIndexOf('.');
    final ext = dot >= 0 ? name.substring(dot).toLowerCase() : '';
    for (final raw in expandAllowedTypes(allowed)) {
      final a = raw.toLowerCase().trim();
      if (a.isEmpty) continue;
      if (a.startsWith('.')) {
        if (ext == a) return true;
        continue;
      }
      if (a.endsWith('/*')) {
        if (type.startsWith(a.substring(0, a.length - 1))) return true;
        continue;
      }
      if (type.isNotEmpty && type == a) return true;
    }
    return false;
  }

  /// Why a picked file is refused, or null. Same wording as the web renderer.
  static String? fileProblem(String name, String mimeType, int size, List<String>? allowed, double? maxMB) {
    if (!isFileTypeAllowed(name, mimeType, allowed)) {
      return 'File type not allowed: ${mimeType.isEmpty ? name : mimeType}';
    }
    if (maxMB != null && maxMB > 0 && size > maxMB * 1024 * 1024) {
      return '"$name" exceeds the ${BdJS.formatNumber(maxMB)} MB limit.';
    }
    return null;
  }

  /// At most this many files across every file field in one submission.
  static const formWideMaxFiles = 5;

  // ── Autofill ───────────────────────────────────────────────────────────

  static final List<(RegExp, String)> _autofillRules = [
    for (final (pattern, token) in const [
      (r'first[\s_-]?name|given[\s_-]?name', 'given-name'),
      (r'last[\s_-]?name|family[\s_-]?name|surname', 'family-name'),
      (r'full[\s_-]?name|your[\s_-]?name|^name$|contact[\s_-]?name', 'name'),
      (r'company|organi[sz]ation|business[\s_-]?name|employer', 'organization'),
      (r'job[\s_-]?title|position|occupation', 'organization-title'),
      (r'web[\s_-]?site|homepage|\burl\b', 'url'),
      (r'address[\s_-]?line[\s_-]?2|apartment|\bapt\b|\bsuite\b|\bunit\b', 'address-line2'),
      (r'street|address[\s_-]?line[\s_-]?1|^address1?$|street[\s_-]?address', 'street-address'),
      (r'\bcity\b|\btown\b', 'address-level2'),
      (r'\bstate\b|province|region', 'address-level1'),
      (r'\bzip\b|postal|post[\s_-]?code', 'postal-code'),
      (r'\bcountry\b', 'country-name'),
      (r'birth|\bdob\b', 'bday'),
      (r'work[\s_-]?phone|office[\s_-]?phone|company[\s_-]?phone|mobile|cell', 'tel'),
    ])
      (RegExp(pattern, caseSensitive: false), token),
  ];

  /// The autofill token (HTML `autocomplete` vocabulary) a field should
  /// advertise: the author's explicit one, else one inferred from its type,
  /// key and label. The UI maps it to the platform's autofill hints.
  static String? autocompleteToken(BdFormField field) {
    final explicit = field.autocomplete;
    if (explicit != null && explicit.isNotEmpty) return explicit;
    switch (field.type) {
      case 'email':
        return 'email';
      case 'phone':
        return 'tel';
      case 'url':
        return 'url';
    }
    final haystack = '${field.key ?? ''} ${field.label}';
    for (final (re, token) in _autofillRules) {
      if (re.hasMatch(haystack)) return token;
    }
    return null;
  }

  // ── Search ─────────────────────────────────────────────────────────────

  /// US states and DC, for an address's state picker.
  static List<({String name, String abbr})> get usStates => data.usStates;

  /// Past this many options a dropdown grows a search box.
  static const searchableThreshold = 10;

  static bool shouldSearch(int optionCount, String? display) =>
      display == 'combobox' || optionCount > searchableThreshold;
}
