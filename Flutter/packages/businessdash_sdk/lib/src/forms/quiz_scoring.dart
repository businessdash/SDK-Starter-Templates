// Quiz grading: answer keys, accepted answers, thresholds, rationale and the
// deterministic score BD records for an attempt.
//
// A port of the TypeScript forms-core's `quiz-scoring.ts` (itself a port of
// BD's `packages/forms/src/quizzes/scoring.ts`). `quiz_parity_test.dart`
// replays the TypeScript answers in `quiz-parity.json`; change them together.
//
// In an app this grades LOCAL quizzes, ones whose fields carry their answer
// keys. An invited quiz arrives without keys and BD grades every answer.

import 'json.dart';
import 'schema.dart';

/// A question's verdict. An unknown one reads as [incorrect], as the web shows it.
enum BdQuizQuestionStatus {
  correct('correct'),
  partiallyCorrect('partially_correct'),
  incorrect('incorrect'),
  pendingAi('pending_ai'),
  unscored('unscored');

  const BdQuizQuestionStatus(this.wire);

  final String wire;

  static BdQuizQuestionStatus parse(String? wire) =>
      values.firstWhere((s) => s.wire == wire, orElse: () => incorrect);
}

// ── JSON helpers shared by the quiz types ──────────────────────────────────

String? _str(BdJson? j) => j?.stringValue;
double? _num(BdJson? j) => j?.doubleValue;
bool? _bool(BdJson? j) => j?.boolValue;

/// The value, or null when it is absent or JSON `null`.
BdJson? quizPresent(BdJson? j) => j == null || j.isNull ? null : j;

class BdQuizOptionExplanation {
  const BdQuizOptionExplanation({required this.optionId, required this.option, required this.accepted, this.explanation});

  factory BdQuizOptionExplanation.fromJson(BdJson j) => BdQuizOptionExplanation(
        optionId: _str(j['optionId']) ?? '',
        option: _str(j['option']) ?? '',
        accepted: _bool(j['accepted']) ?? false,
        explanation: _str(j['explanation']),
      );

  final String optionId;
  final String option;
  final bool accepted;
  final String? explanation;

  Map<String, Object?> toJson() =>
      {'optionId': optionId, 'option': option, 'accepted': accepted, 'explanation': explanation};
}

class BdQuizQuestionRationale {
  const BdQuizQuestionRationale({required this.outcome, this.explanation, this.selectedOptions, this.optionExplanations});

  factory BdQuizQuestionRationale.fromJson(BdJson j) => BdQuizQuestionRationale(
        outcome: _str(j['outcome']) ?? 'incorrect',
        explanation: _str(j['explanation']),
        selectedOptions: j['selectedOptions']?.arrayValue?.map(BdQuizOptionExplanation.fromJson).toList(),
        optionExplanations: j['optionExplanations']?.arrayValue?.map(BdQuizOptionExplanation.fromJson).toList(),
      );

  /// `correct`, `partially_correct` or `incorrect`.
  final String outcome;
  final String? explanation;
  final List<BdQuizOptionExplanation>? selectedOptions;
  final List<BdQuizOptionExplanation>? optionExplanations;

  Map<String, Object?> toJson() => {
        'outcome': outcome,
        'explanation': explanation,
        'selectedOptions': selectedOptions?.map((o) => o.toJson()).toList(),
        'optionExplanations': optionExplanations?.map((o) => o.toJson()).toList(),
      };
}

class BdQuizValidation {
  const BdQuizValidation({required this.source, this.confidence, this.rationale});

  factory BdQuizValidation.fromJson(BdJson j) =>
      BdQuizValidation(source: _str(j['source']) ?? '', confidence: _num(j['confidence']), rationale: _str(j['rationale']));

  final String source;
  final double? confidence;
  final String? rationale;

  Map<String, Object?> toJson() => {'source': source, 'confidence': confidence, 'rationale': rationale};
}

class BdQuizQuestionResult {
  const BdQuizQuestionResult({
    required this.fieldId,
    required this.label,
    this.answer,
    required this.status,
    required this.pointsPossible,
    required this.pointsEarned,
    this.accuracyPercent,
    this.passingGrade,
    this.correctThreshold,
    this.partiallyCorrectThreshold,
    this.passed,
    this.correctAnswers,
    this.rationale,
    this.reason,
    this.validation,
  });

  factory BdQuizQuestionResult.fromJson(BdJson j) => BdQuizQuestionResult(
        fieldId: _str(j['fieldId']) ?? '',
        label: _str(j['label']) ?? '',
        answer: quizPresent(j['answer']),
        status: BdQuizQuestionStatus.parse(_str(j['status'])),
        pointsPossible: _num(j['pointsPossible']) ?? 0,
        pointsEarned: _num(j['pointsEarned']) ?? 0,
        accuracyPercent: _num(j['accuracyPercent']),
        passingGrade: _num(j['passingGrade']),
        correctThreshold: _num(j['correctThreshold']),
        partiallyCorrectThreshold: _num(j['partiallyCorrectThreshold']),
        passed: _bool(j['passed']),
        correctAnswers: j['correctAnswers']?.arrayValue?.map((a) => a.stringValue ?? BdJS.string(a)).toList(),
        rationale: quizPresent(j['rationale']) == null ? null : BdQuizQuestionRationale.fromJson(j['rationale']!),
        reason: _str(j['reason']),
        validation: quizPresent(j['validation']) == null ? null : BdQuizValidation.fromJson(j['validation']!),
      );

  final String fieldId;
  final String label;
  final BdJson? answer;
  final BdQuizQuestionStatus status;
  final double pointsPossible;
  final double pointsEarned;

  /// Null while a free-text answer waits for AI review.
  final double? accuracyPercent;
  final double? passingGrade;
  final double? correctThreshold;
  final double? partiallyCorrectThreshold;
  final bool? passed;

  /// Revealed only once an answer is locked or the quiz is submitted.
  final List<String>? correctAnswers;
  final BdQuizQuestionRationale? rationale;
  final String? reason;
  final BdQuizValidation? validation;

  Map<String, Object?> toJson() => {
        'fieldId': fieldId,
        'label': label,
        'answer': answer?.toPlain(),
        'status': status.wire,
        'pointsPossible': pointsPossible,
        'pointsEarned': pointsEarned,
        'accuracyPercent': accuracyPercent,
        'passingGrade': passingGrade,
        'correctThreshold': correctThreshold,
        'partiallyCorrectThreshold': partiallyCorrectThreshold,
        'passed': passed,
        'correctAnswers': correctAnswers,
        'rationale': rationale?.toJson(),
        'reason': reason,
        'validation': validation?.toJson(),
      };
}

/// A scored submission.
class BdQuizScore {
  const BdQuizScore({
    required this.status,
    required this.results,
    required this.pointsEarned,
    required this.pointsPossible,
    required this.scorePercent,
    required this.provisionalScorePercent,
    required this.passed,
  });

  /// `scored` or `pending_ai_review`.
  final String status;
  final List<BdQuizQuestionResult> results;
  final double pointsEarned;
  final double pointsPossible;
  final double? scorePercent;
  final double provisionalScorePercent;
  final bool? passed;

  Map<String, Object?> toJson() => {
        'status': status,
        'results': results.map((r) => r.toJson()).toList(),
        'pointsEarned': pointsEarned,
        'pointsPossible': pointsPossible,
        'scorePercent': scorePercent,
        'provisionalScorePercent': provisionalScorePercent,
        'passed': passed,
      };
}

// ── The answer key on a question field (`quizAnswerKey`), as received ──────

class _Accepted {
  _Accepted(BdJson json)
      : hasText = json.objectValue?.containsKey('text') ?? false,
        text = _str(json['text']),
        optionId = _str(json['option_id']),
        validateWithAI = _bool(json['validate_with_ai']) == true;

  /// The key had `text` (an open answer), whatever its value.
  final bool hasText;
  final String? text;
  final String? optionId;
  final bool validateWithAI;

  /// `"option_id" in answer && answer.option_id`
  String? get choiceId => optionId == null || optionId!.isEmpty ? null : optionId;
}

class _AnswerKey {
  _AnswerKey(BdJson json) : _o = json {
    final rationale = json['rationale'];
    whyRight = _str(rationale?['why_right']);
    whyWrong = _str(rationale?['why_wrong']);
    whyWrongByOptionId = {
      for (final e in (rationale?['why_wrong_by_option_id']?.objectValue ?? const <String, BdJson>{}).entries)
        if (e.value.stringValue case final s?) e.key: s,
    };
  }

  final BdJson _o;
  late final String? whyRight;
  late final String? whyWrong;
  late final Map<String, String> whyWrongByOptionId;

  _Accepted? get answer => BdQuizScoring.truthy(_o['answer']) ? _Accepted(_o['answer']!) : null;
  bool get noWrongAnswer => BdQuizScoring.truthy(_o['no_wrong_answer']);
  List<_Accepted> get additional => [for (final a in _o['additional_accepted_answers']?.arrayValue ?? const <BdJson>[]) _Accepted(a)];
  String? get reason => _str(_o['reason']);
  double? get points => _num(_o['points']);
  double? get passingGrade => _num(_o['passing_grade']);
  double? get correctThreshold => _num(_o['correct_threshold']);
  double? get partialThreshold => _num(_o['partially_correct_threshold']);

  List<_Accepted> get accepted => [if (answer case final a?) a, ...additional];
}

_AnswerKey? _answerKey(BdFormField field) {
  final key = field.raw['quizAnswerKey'];
  return BdQuizScoring.truthy(key) ? _AnswerKey(key!) : null;
}

/// Quiz facts a question field carries.
extension BdQuizField on BdFormField {
  /// Stable ids of the options, in display order (graded quizzes only).
  List<String> get quizOptionIds =>
      [for (final id in raw['quizOptionIds']?.arrayValue ?? const <BdJson>[]) id.stringValue ?? BdJS.string(id)];

  /// "Keep these choices in order": never shuffled.
  bool get quizKeepChoiceOrder => raw['quizKeepChoiceOrder']?.boolValue == true;

  /// The field carries an answer key: a graded question.
  bool get hasQuizAnswerKey => BdQuizScoring.truthy(raw['quizAnswerKey']);
}

abstract final class BdQuizScoring {
  static const double defaultPassingGrade = 80;
  static const double defaultCorrectThreshold = 85;
  static const double defaultPartialThreshold = 50;

  /// Layout, display and payment nodes, never graded.
  static const Set<String> nonQuestionTypes = {
    'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'multi_populator', //
    'condition_block', 'or_condition', 'image', 'richtext', 'body_text', 'bullet_list',
    'table', 'calculation', 'credit_card',
  };

  static final _tags = RegExp(r'<[^>]*>');

  // Dart's RegExp is ECMAScript's, so `\s` is JavaScript's whitespace.
  static final _spaces = RegExp(r'\s+');

  /// JavaScript truthiness of a JSON value.
  static bool truthy(BdJson? value) => switch (value) {
        null || BdNull() => false,
        BdBool(:final value) => value,
        BdNum(:final value) => value != 0 && !value.isNaN,
        BdStr(:final value) => value.isNotEmpty,
        BdArr() || BdObj() => true,
      };

  static String stripTags(String s) => s.replaceAll(_tags, ' ');

  static bool isBlank(BdJson? value) => switch (value) {
        null || BdNull() => true,
        BdArr(:final items) => items.isEmpty,
        BdStr(:final value) => value.isEmpty || BdJS.trim(stripTags(value)).isEmpty,
        _ => false,
      };

  /// Tags stripped, whitespace collapsed, lower-cased: how answers compare.
  static String normalizedText(BdJson? value) =>
      BdJS.toLowerCase(BdJS.trim(stripTags(BdJS.string(value))).replaceAll(_spaces, ' '));

  static String _normalized(String? value) => normalizedText(value == null ? null : BdStr(value));

  /// The visible choices of an option question, in order.
  static List<String> optionLabels(BdFormField field) => field.type == 'choice_cards'
      ? [for (final o in field.choiceConfig?.options ?? const <BdChoiceOption>[]) o.label]
      : field.options ?? const [];

  static String? cleanRationale(String? value) {
    if (value == null) return null;
    final cleaned = BdJS.trim(value);
    if (cleaned.isEmpty) return null;
    return cleaned.length > 2000 ? cleaned.substring(0, 2000) : cleaned;
  }

  static String? _acceptedLabel(BdFormField field, _Accepted answer) {
    if (answer.hasText) return cleanRationale(answer.text);
    final optionId = answer.optionId;
    if (optionId == null) return null;
    final index = field.quizOptionIds.indexOf(optionId);
    final labels = optionLabels(field);
    return cleanRationale(index >= 0 && index < labels.length ? labels[index] : optionId);
  }

  /// The accepted answers' labels, attached only to locked or submitted results.
  static List<String> correctAnswers(BdFormField field) {
    final key = _answerKey(field);
    if (key == null) return const [];
    if (key.noWrongAnswer) return const ['Any non-empty response'];
    return [
      for (final a in key.accepted)
        if (_acceptedLabel(field, a) case final label?) label,
    ];
  }

  static List<(String, String)> _selectedOptions(BdFormField field, BdJson? value) {
    final labels = optionLabels(field);
    final ids = field.quizOptionIds;
    final List<BdJson?> values = value?.arrayValue ?? [value];
    final out = <(String, String)>[];
    for (final selected in values) {
      final normalized = normalizedText(selected);
      var index = -1;
      for (var i = 0; i < labels.length; i++) {
        if (_normalized(labels[i]) == normalized || _normalized(i < ids.length ? ids[i] : null) == normalized) {
          index = i;
          break;
        }
      }
      if (index < 0) continue;
      final optionId = index < ids.length ? ids[index] : '';
      final option = labels[index];
      if (optionId.isNotEmpty && option.isNotEmpty) out.add((optionId, option));
    }
    return out;
  }

  static BdQuizQuestionRationale? _resultRationale(BdFormField field, _AnswerKey key, BdJson? value, String outcome) {
    final whyRight = cleanRationale(key.whyRight ?? key.reason);
    final whyWrong = cleanRationale(key.whyWrong);
    final accepted = {
      for (final a in key.accepted)
        if (a.choiceId case final id?) id,
    };
    String? explain(String optionId, bool isAccepted) =>
        cleanRationale(isAccepted ? whyRight : key.whyWrongByOptionId[optionId] ?? whyWrong);
    final selections = [
      for (final (optionId, option) in _selectedOptions(field, value))
        BdQuizOptionExplanation(
          optionId: optionId,
          option: option,
          accepted: accepted.contains(optionId),
          explanation: explain(optionId, accepted.contains(optionId)),
        ),
    ];
    final selectedExplanation = selections.length == 1 ? selections[0].explanation : null;
    final ids = field.quizOptionIds;
    final labels = optionLabels(field);
    final optionExplanations = <BdQuizOptionExplanation>[];
    for (var i = 0; i < labels.length; i++) {
      final optionId = i < ids.length ? ids[i] : '';
      if (optionId.isEmpty) continue;
      final isAccepted = accepted.contains(optionId);
      final explanation = explain(optionId, isAccepted);
      if (explanation != null) {
        optionExplanations.add(
          BdQuizOptionExplanation(optionId: optionId, option: labels[i], accepted: isAccepted, explanation: explanation),
        );
      }
    }
    final explanation = isBlank(value) || outcome == 'correct' ? whyRight : selectedExplanation ?? whyWrong;
    if (explanation == null && !selections.any((s) => s.explanation != null) && optionExplanations.isEmpty) return null;
    return BdQuizQuestionRationale(
      outcome: outcome,
      explanation: explanation,
      selectedOptions: selections.isEmpty ? null : selections,
      optionExplanations: optionExplanations.isEmpty ? null : optionExplanations,
    );
  }

  static bool _matches(BdFormField field, _Accepted accepted, BdJson? value) {
    final optionId = accepted.choiceId;
    if (optionId == null) return normalizedText(value) == _normalized(accepted.text);
    final labels = optionLabels(field);
    final index = field.quizOptionIds.indexOf(optionId);
    final wantLabel = _normalized(index >= 0 && index < labels.length ? labels[index] : null);
    final wantId = _normalized(optionId);
    bool hit(BdJson? item) {
      final n = normalizedText(item);
      return n == wantLabel || n == wantId;
    }

    final items = value?.arrayValue;
    return items != null ? items.any(hit) : hit(value);
  }

  /// Whether a result's accepted answers include this choice label.
  static bool isAcceptedLabel(BdQuizQuestionResult result, String label) {
    final wanted = _normalized(label);
    return (result.correctAnswers ?? const []).any((a) => _normalized(a) == wanted);
  }

  static bool _conditionMatches(BdFormField field, Map<String, BdJson> data) {
    final rule = field.conditionRule;
    final fieldId = rule?.fieldId;
    if (rule == null || fieldId == null || fieldId.isEmpty) return true;
    final current = data[fieldId];
    final clauses = rule.clauses != null && rule.clauses!.isNotEmpty
        ? [for (final c in rule.clauses!) (c.operator, c.value ?? '')]
        : [(rule.operator ?? 'eq', rule.value ?? '')];
    return clauses.every((c) {
      final (op, expected) = c;
      return switch (op) {
        'eq' => BdJS.string(current) == expected,
        'neq' => BdJS.string(current) != expected,
        'contains' => normalizedText(current).contains(_normalized(expected)),
        'gt' => BdJS.number(current) > BdJS.parseNumber(expected),
        'lt' => BdJS.number(current) < BdJS.parseNumber(expected),
        'is_empty' => isBlank(current),
        'is_not_empty' => !isBlank(current),
        _ => true,
      };
    });
  }

  static double _safePoints(double? value) => value == null || !value.isFinite ? 1 : value.clamp(0, 1000).toDouble();

  static double _safePercent(double? value, double fallback) =>
      value == null || !value.isFinite ? fallback : value.clamp(0, 100).toDouble();

  /// Deterministically score a submission. A free-text answer that a key lets
  /// AI judge goes to `pendingAi` only when it doesn't already match an
  /// accepted answer exactly; BD grades those, never the app.
  static BdQuizScore score(List<BdFormField> fields, Map<String, BdJson> answers, double passingScore) {
    final results = <BdQuizQuestionResult>[];

    void grade(BdFormField field, BdJson? value, String resultId) {
      if (nonQuestionTypes.contains(field.type)) return;
      final label = field.label.isEmpty ? 'Untitled question' : field.label;
      final key = _answerKey(field);
      if (key == null) {
        results.add(BdQuizQuestionResult(
          fieldId: resultId,
          label: label,
          answer: value,
          status: BdQuizQuestionStatus.unscored,
          pointsPossible: 0,
          pointsEarned: 0,
        ));
        return;
      }
      final points = _safePoints(key.points);
      final correctThreshold = _safePercent(key.correctThreshold, defaultCorrectThreshold);
      final passingGrade = _safePercent(key.passingGrade, defaultPassingGrade);
      final partialThreshold = [correctThreshold, _safePercent(key.partialThreshold, defaultPartialThreshold)]
          .reduce((a, b) => a < b ? a : b);
      final accepted = key.accepted;
      final correct = key.noWrongAnswer ? !isBlank(value) : accepted.any((a) => _matches(field, a, value));
      final pendingAi = !correct && !isBlank(value) && accepted.any((a) => a.hasText && a.validateWithAI);
      final double? accuracy = pendingAi ? null : (correct ? 100 : 0);
      final status = accuracy == null
          ? BdQuizQuestionStatus.pendingAi
          : accuracy >= correctThreshold
              ? BdQuizQuestionStatus.correct
              : accuracy >= partialThreshold
                  ? BdQuizQuestionStatus.partiallyCorrect
                  : BdQuizQuestionStatus.incorrect;
      final answersShown = correctAnswers(field);
      final reason = key.reason == null ? null : BdJS.trim(key.reason!);
      results.add(BdQuizQuestionResult(
        fieldId: resultId,
        label: label,
        answer: value,
        status: status,
        pointsPossible: points,
        pointsEarned: accuracy == null ? 0 : points * (accuracy / 100),
        accuracyPercent: accuracy,
        passingGrade: passingGrade,
        correctThreshold: correctThreshold,
        partiallyCorrectThreshold: partialThreshold,
        passed: accuracy == null ? null : accuracy >= passingGrade,
        correctAnswers: answersShown.isEmpty ? null : answersShown,
        rationale: status == BdQuizQuestionStatus.pendingAi ? null : _resultRationale(field, key, value, status.wire),
        reason: reason == null || reason.isEmpty ? null : reason,
      ));
    }

    void walk(List<BdFormField> nodes, Map<String, BdJson> scope, String prefix) {
      for (final field in nodes) {
        switch (field.type) {
          case 'condition_block':
            if (_conditionMatches(field, scope)) walk(field.children ?? const [], scope, prefix);
          case 'input_group' || 'flex_row' || 'or_condition':
            walk(field.children ?? const [], scope, prefix);
          case 'multi_populator':
            final instances = scope[field.id]?.arrayValue ?? const <BdJson>[];
            for (var i = 0; i < instances.length; i++) {
              final instance = instances[i].objectValue;
              if (instance != null) walk(field.children ?? const [], instance, '$prefix${field.id}[$i].');
            }
          default:
            grade(field, scope[field.id], '$prefix${field.id}');
        }
      }
    }

    walk(fields, answers, '');

    final scorable = results.where((r) => r.pointsPossible > 0).toList();
    final possible = scorable.fold<double>(0, (sum, r) => sum + r.pointsPossible);
    final earned = scorable.fold<double>(0, (sum, r) => sum + r.pointsEarned);
    final provisional = possible == 0 ? 0.0 : (earned / possible) * 100;
    final pending = scorable.any((r) => r.status == BdQuizQuestionStatus.pendingAi);
    final percent = pending ? null : provisional;
    return BdQuizScore(
      status: pending ? 'pending_ai_review' : 'scored',
      results: results,
      pointsEarned: earned,
      pointsPossible: possible,
      scorePercent: percent,
      provisionalScorePercent: provisional,
      passed: percent == null ? null : percent >= passingScore,
    );
  }
}
