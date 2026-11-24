// Quizzes: the forms engine taking a graded assessment.
//
// A port of the TypeScript forms-core's `quiz.ts`. A BD quiz IS a form: its
// questions are ordinary fields carrying an answer key, and the quiz adds how
// it's taken: immediate or end-of-quiz feedback, an elapsed or countdown
// timer, choices and questions as written or in a seeded shuffle, "I don't
// know", and results (or a thank-you, or "sign in to see your results").
//
// Everything here is pure: a [BdQuizState] in, a new one out, and
// [BdQuizEngine.screen] turns it into exactly what a screen shows, texts
// included. [BdQuizController] adds the async parts (BD calls, the clock,
// autosave) and businessdash_forms' `BdQuiz` draws it. Times are epoch
// milliseconds, as in JavaScript, so a state travels to and from a server
// unchanged.

import 'dart:math' as math;

import 'json.dart';
import 'quiz_scoring.dart';
import 'quiz_screen.dart';
import 'quiz_words.dart';
import 'rules.dart';
import 'schema.dart';

enum BdQuizFeedbackMode {
  /// Each answer locks and its verdict shows before moving on.
  immediate,

  /// Every verdict shows after the whole quiz is submitted.
  end,
}

enum BdQuizLayout {
  /// One question at a time.
  single,

  /// Every question on one page (end feedback only).
  all,
}

/// How a quiz is shown and taken.
class BdQuizOptions {
  const BdQuizOptions({
    required this.fields,
    this.questionFieldIds,
    this.feedbackMode = BdQuizFeedbackMode.end,
    this.passingScore,
    this.showTimer = false,
    this.timeLimitMinutes,
    this.showScore = true,
    this.resultsLocked = false,
    this.signInHref,
    this.shuffleChoices = false,
    this.shuffleQuestions = false,
    this.seed,
    this.questionLimit,
    this.allowDontKnow = false,
    this.layout = BdQuizLayout.single,
    this.local,
    this.canRestart,
    this.words = const BdQuizWords(),
  });

  /// Reads the TypeScript `QuizOptions` JSON (words aside), as leniently as it does.
  factory BdQuizOptions.fromJson(BdJson json) {
    bool? flag(String key) => json[key]?.boolValue;
    final limit = json['questionLimit']?.doubleValue;
    return BdQuizOptions(
      fields: [for (final f in json['fields']?.arrayValue ?? const <BdJson>[]) BdFormField.make(f)],
      questionFieldIds: json['questionFieldIds']?.arrayValue?.map((i) => i.stringValue).whereType<String>().toList(),
      feedbackMode: json['feedbackMode']?.stringValue == 'immediate' ? BdQuizFeedbackMode.immediate : BdQuizFeedbackMode.end,
      passingScore: json['passingScore']?.doubleValue,
      showTimer: flag('showTimer') ?? false,
      timeLimitMinutes: json['timeLimitMinutes']?.doubleValue,
      showScore: flag('showScore') ?? true,
      resultsLocked: flag('resultsLocked') ?? false,
      signInHref: json['signInHref']?.stringValue,
      shuffleChoices: flag('shuffleChoices') ?? false,
      shuffleQuestions: flag('shuffleQuestions') ?? false,
      seed: json['seed']?.stringValue,
      questionLimit: limit != null && limit.isFinite ? limit.floor() : null,
      allowDontKnow: flag('allowDontKnow') ?? false,
      layout: json['layout']?.stringValue == 'all' ? BdQuizLayout.all : BdQuizLayout.single,
      local: flag('local'),
      canRestart: flag('canRestart'),
    );
  }

  /// The quiz's fields: the question document.
  final List<BdFormField> fields;

  /// Which fields are questions. Null: every field with an answer key.
  final List<String>? questionFieldIds;
  final BdQuizFeedbackMode feedbackMode;

  /// Percent needed to pass (local runs; BD decides for invited quizzes).
  final double? passingScore;
  final bool showTimer;

  /// A countdown; the quiz submits itself at zero.
  final double? timeLimitMinutes;

  /// False = interview mode: the taker gets a thank-you, never a score.
  final bool showScore;

  /// Results wait for the invited account: show a sign-in prompt instead.
  final bool resultsLocked;

  /// Where that prompt sends the taker. `BdQuiz` sets one when given `onSignIn`.
  final String? signInHref;

  /// Multiple-choice options in a shuffled order (off: as written).
  final bool shuffleChoices;

  /// Questions in a shuffled order (off: as written).
  final bool shuffleQuestions;

  /// What the shuffle is built from: one taker, one order. An invitation
  /// uses its id. Null: a new order each time a local run starts.
  final String? seed;

  /// Local runs: ask only this many questions (after any shuffle).
  final int? questionLimit;

  /// Offer "I don't know" on multiple-choice questions that aren't required.
  final bool allowDontKnow;

  /// End feedback only: one question at a time, or all on one page.
  final BdQuizLayout layout;

  /// Graded here: the fields carry answer keys (or a practice run).
  final bool? local;

  /// Offer "Retake" when it ends. Null: local runs can.
  final bool? canRestart;
  final BdQuizWords words;

  BdQuizOptions copyWith({bool? local, bool? canRestart}) => BdQuizOptions(
        fields: fields,
        questionFieldIds: questionFieldIds,
        feedbackMode: feedbackMode,
        passingScore: passingScore,
        showTimer: showTimer,
        timeLimitMinutes: timeLimitMinutes,
        showScore: showScore,
        resultsLocked: resultsLocked,
        signInHref: signInHref,
        shuffleChoices: shuffleChoices,
        shuffleQuestions: shuffleQuestions,
        seed: seed,
        questionLimit: questionLimit,
        allowDontKnow: allowDontKnow,
        layout: layout,
        local: local ?? this.local,
        canRestart: canRestart ?? this.canRestart,
        words: words,
      );
}

/// [BdQuizOptions], resolved: questions arranged, defaults filled in.
class BdQuizConfig {
  BdQuizConfig(BdQuizOptions options, String seed)
      : local = options.local ?? false,
        questions = BdQuizArrange.questions(options, seed, options.local ?? false),
        feedbackMode = options.feedbackMode,
        passingScore = options.passingScore != null && options.passingScore!.isFinite
            ? options.passingScore!
            : BdQuizScoring.defaultPassingGrade,
        timeLimitMinutes = options.timeLimitMinutes != null && options.timeLimitMinutes!.isFinite && options.timeLimitMinutes! > 0
            ? options.timeLimitMinutes!.floor()
            : null,
        showScore = options.showScore,
        resultsLocked = options.resultsLocked,
        signInHref = options.signInHref,
        allowDontKnow = options.allowDontKnow,
        layout = options.feedbackMode == BdQuizFeedbackMode.end && options.layout == BdQuizLayout.all
            ? BdQuizLayout.all
            : BdQuizLayout.single,
        canRestart = options.canRestart ?? false,
        words = options.words,
        _showTimer = options.showTimer;

  final bool local;
  final List<BdFormField> questions;
  final BdQuizFeedbackMode feedbackMode;
  final double passingScore;
  final int? timeLimitMinutes;
  final bool _showTimer;
  bool get timerEnabled => _showTimer || timeLimitMinutes != null;
  final bool showScore;
  final bool resultsLocked;
  final String? signInHref;
  final bool allowDontKnow;
  final BdQuizLayout layout;
  final bool canRestart;
  final BdQuizWords words;
}

// ── Questions, choices and order ────────────────────────────────────────────

abstract final class BdQuizArrange {
  /// Field types asked as multiple choice: lettered cards, shuffle-able.
  static const Set<String> multipleChoiceTypes = {'radio', 'checkbox', 'multi_select', 'choice_cards'};

  static bool isMultipleChoice(BdFormField field) =>
      multipleChoiceTypes.contains(field.type) && BdQuizScoring.optionLabels(field).isNotEmpty;

  /// Several answers may be picked.
  static bool isMultiSelect(BdFormField field) =>
      field.type == 'checkbox' ||
      field.type == 'multi_select' ||
      (field.type == 'choice_cards' && field.choiceConfig?.mode == 'multi');

  /// A, B, C … Z, then 27, 28 …
  static String choiceLetter(int index) => index < 26 ? String.fromCharCode(65 + index) : '${index + 1}';

  /// The questions in document order: listed ids, or fields with answer keys.
  static List<BdFormField> questionFields(List<BdFormField> fields, List<String>? ids) {
    final explicit = ids?.toSet();
    final out = <BdFormField>[];
    void walk(List<BdFormField> nodes) {
      for (final field in nodes) {
        final id = field.raw['id']?.stringValue ?? '';
        if (id.isNotEmpty && (explicit?.contains(id) ?? field.hasQuizAnswerKey)) out.add(field);
        if (field.children case final children?) walk(children);
      }
    }

    walk(fields);
    return out;
  }

  /// `Math.imul`, safe on the web (where ints are doubles).
  static int _imul(int a, int b) {
    final aHi = (a >>> 16) & 0xffff;
    final aLo = a & 0xffff;
    final bHi = (b >>> 16) & 0xffff;
    final bLo = b & 0xffff;
    return (aLo * bLo + (((aHi * bLo + aLo * bHi) << 16) & 0xffffffff)) & 0xffffffff;
  }

  /// FNV-1a over the text's UTF-8 bytes: the shuffle's seed (unsigned 32-bit).
  static int seedHash(String text) {
    var hash = 0x811c9dc5;
    for (final byte in _utf8(text)) {
      hash = _imul(hash ^ byte, 0x01000193);
    }
    return hash;
  }

  static List<int> _utf8(String text) {
    final out = <int>[];
    for (final rune in text.runes) {
      if (rune < 0x80) {
        out.add(rune);
      } else if (rune < 0x800) {
        out..add(0xc0 | (rune >> 6))..add(0x80 | (rune & 0x3f));
      } else if (rune < 0x10000) {
        out..add(0xe0 | (rune >> 12))..add(0x80 | ((rune >> 6) & 0x3f))..add(0x80 | (rune & 0x3f));
      } else {
        out
          ..add(0xf0 | (rune >> 18))
          ..add(0x80 | ((rune >> 12) & 0x3f))
          ..add(0x80 | ((rune >> 6) & 0x3f))
          ..add(0x80 | (rune & 0x3f));
      }
    }
    return out;
  }

  /// A shuffled order of `0 until count` (Fisher–Yates over mulberry32), the
  /// same for the same seed in every port.
  static List<int> seededOrder(int count, String seed) {
    final order = List<int>.generate(count, (i) => i);
    var state = seedHash(seed);
    int next() {
      state = (state + 0x6d2b79f5) & 0xffffffff;
      var t = _imul(state ^ (state >>> 15), state | 1);
      t = ((t + _imul(t ^ (t >>> 7), t | 61)) & 0xffffffff) ^ t;
      return (t ^ (t >>> 14)) & 0xffffffff;
    }

    for (var i = count - 1; i > 0; i--) {
      final j = (next() * (i + 1)) ~/ 4294967296;
      final held = order[i];
      order[i] = order[j];
      order[j] = held;
    }
    return order;
  }

  static List<BdJson> _reorder(List<BdJson> items, List<int> order) =>
      items.length == order.length ? [for (final i in order) items[i]] : items;

  /// One question with its options shuffled: labels, card content and the
  /// grading ids move together, so answers still score the same. A question
  /// marked "keep these choices in order" stays as written.
  static BdFormField shuffledChoices(BdFormField field, String seed) {
    if (!isMultipleChoice(field) || field.quizKeepChoiceOrder) return field;
    final source = field.raw.objectValue;
    if (source == null) return field;
    final raw = Map<String, BdJson>.of(source);
    final order = seededOrder(BdQuizScoring.optionLabels(field).length, '$seed:${field.id}');
    final config = raw['choiceConfig']?.objectValue;
    final cards = config?['options']?.arrayValue;
    if (field.type == 'choice_cards' && config != null && cards != null) {
      raw['choiceConfig'] = BdObj({...config, 'options': BdArr(_reorder(cards, order))});
    } else if (raw['options']?.arrayValue case final options?) {
      raw['options'] = BdArr(_reorder(options, order));
    }
    if (raw['quizOptionIds']?.arrayValue case final ids?) raw['quizOptionIds'] = BdArr(_reorder(ids, order));
    return BdFormField.make(BdObj(raw));
  }

  static final _random = math.Random.secure();

  /// A seed for a run that wasn't given one.
  static String randomSeed() =>
      [for (var i = 0; i < 8; i++) _random.nextInt(256).toRadixString(16).padLeft(2, '0')].join();

  /// The questions as this taker gets them: picked, ordered (shuffled when
  /// asked), limited (local runs), with options shuffled when asked.
  static List<BdFormField> questions(BdQuizOptions options, String seed, bool local) {
    var questions = questionFields(options.fields, options.questionFieldIds);
    if (options.shuffleQuestions) {
      final shuffled = questions;
      questions = [for (final i in seededOrder(shuffled.length, '$seed:questions')) shuffled[i]];
    }
    final limit = options.questionLimit;
    if (local && limit != null && limit > 0 && questions.length > limit) questions = questions.sublist(0, limit);
    return options.shuffleChoices ? [for (final q in questions) shuffledChoices(q, seed)] : questions;
  }
}

// ── State ───────────────────────────────────────────────────────────────────

enum BdQuizPending {
  start('start'),
  lock('lock'),
  submit('submit');

  const BdQuizPending(this.wire);
  final String wire;
}

/// A finished attempt as the taker sees it. The numbers are null when BD
/// withheld them (scores hidden, or results waiting for the invited account).
class BdQuizCompletion {
  const BdQuizCompletion({
    required this.status,
    required this.results,
    this.pointsEarned,
    this.pointsPossible,
    this.scorePercent,
    this.provisionalScorePercent,
    this.passed,
    this.id,
    this.submittedAt,
    this.timedOut,
    this.durationSeconds,
  });

  factory BdQuizCompletion.fromJson(BdJson j) => BdQuizCompletion(
        status: j['status']?.stringValue ?? 'scored',
        results: [for (final r in j['results']?.arrayValue ?? const <BdJson>[]) BdQuizQuestionResult.fromJson(r)],
        pointsEarned: j['pointsEarned']?.doubleValue,
        pointsPossible: j['pointsPossible']?.doubleValue,
        scorePercent: j['scorePercent']?.doubleValue,
        provisionalScorePercent: j['provisionalScorePercent']?.doubleValue,
        passed: j['passed']?.boolValue,
        id: j['id']?.stringValue,
        submittedAt: quizPresent(j['submittedAt']),
        timedOut: j['timedOut']?.boolValue,
        durationSeconds: j['durationSeconds']?.doubleValue,
      );

  /// `scored` or `pending_ai_review`.
  final String status;
  final List<BdQuizQuestionResult> results;
  final double? pointsEarned;
  final double? pointsPossible;
  final double? scorePercent;
  final double? provisionalScorePercent;
  final bool? passed;
  final String? id;

  /// An ISO string from BD, or epoch ms.
  final BdJson? submittedAt;
  final bool? timedOut;
  final double? durationSeconds;

  BdQuizCompletion withTiming({bool? timedOut, double? durationSeconds}) => BdQuizCompletion(
        status: status,
        results: results,
        pointsEarned: pointsEarned,
        pointsPossible: pointsPossible,
        scorePercent: scorePercent,
        provisionalScorePercent: provisionalScorePercent,
        passed: passed,
        id: id,
        submittedAt: submittedAt,
        timedOut: timedOut,
        durationSeconds: durationSeconds,
      );

  Map<String, Object?> toJson() => {
        'status': status,
        'results': results.map((r) => r.toJson()).toList(),
        'pointsEarned': pointsEarned,
        'pointsPossible': pointsPossible,
        'scorePercent': scorePercent,
        'provisionalScorePercent': provisionalScorePercent,
        'passed': passed,
        'id': id,
        'submittedAt': submittedAt?.toPlain(),
        'timedOut': timedOut,
        'durationSeconds': durationSeconds,
      };
}

/// BD's answer to "start the clock". Times are ISO strings or epoch ms.
class BdQuizStartInfo {
  const BdQuizStartInfo({required this.startedAt, this.deadlineAt, required this.serverNow});

  factory BdQuizStartInfo.fromJson(BdJson j) => BdQuizStartInfo(
        startedAt: j['startedAt'] ?? const BdNull(),
        deadlineAt: quizPresent(j['deadlineAt']),
        serverNow: j['serverNow']?.doubleValue ?? 0,
      );

  final BdJson startedAt;
  final BdJson? deadlineAt;
  final double serverNow;
}

/// What a resumed quiz already has (from BD's invitation, or a saved run).
class BdQuizInitial {
  const BdQuizInitial({
    this.answers,
    this.results,
    this.completion,
    this.startedAt,
    this.deadlineAt,
    this.serverNow,
    this.dontKnow,
  });

  factory BdQuizInitial.fromJson(BdJson j) => BdQuizInitial(
        answers: j['answers']?.objectValue,
        results: j['results']?.arrayValue?.map(BdQuizQuestionResult.fromJson).toList(),
        completion: quizPresent(j['completion']) == null ? null : BdQuizCompletion.fromJson(j['completion']!),
        startedAt: quizPresent(j['startedAt']),
        deadlineAt: quizPresent(j['deadlineAt']),
        serverNow: j['serverNow']?.doubleValue,
        dontKnow: j['dontKnow']?.stringArray,
      );

  final Map<String, BdJson>? answers;
  final List<BdQuizQuestionResult>? results;
  final BdQuizCompletion? completion;
  final BdJson? startedAt;
  final BdJson? deadlineAt;
  final double? serverNow;
  final List<String>? dontKnow;
}

const Object _keep = Object();

/// Everything that changes while a quiz is taken. Plain JSON: a server can
/// keep it between requests. The engine returns the same instance when a
/// step changes nothing.
class BdQuizState {
  const BdQuizState({
    required this.index,
    required this.answers,
    required this.dontKnow,
    required this.results,
    required this.revealed,
    required this.completion,
    required this.startedAt,
    required this.deadlineAt,
    required this.clockOffset,
    required this.pausedMs,
    required this.revealStartedAt,
    required this.pending,
    required this.error,
    required this.fieldErrors,
    required this.timeUp,
  });

  /// The question on screen (single layout).
  final int index;
  final Map<String, BdJson> answers;

  /// Questions answered "I don't know".
  final List<String> dontKnow;

  /// Locked answers' verdicts (immediate feedback), in question order.
  final List<BdQuizQuestionResult> results;

  /// Immediate feedback: the current question's verdict is on screen.
  final bool revealed;
  final BdQuizCompletion? completion;

  /// Server-clock ms.
  final double? startedAt;
  final double? deadlineAt;

  /// Server clock minus this device's clock, ms.
  final double clockOffset;

  /// Local runs: time verdicts have been on screen (the clock stops).
  final double pausedMs;
  final double? revealStartedAt;
  final BdQuizPending? pending;
  final String? error;

  /// Field id → message, for required questions left empty.
  final Map<String, String> fieldErrors;

  /// The deadline was reached and the quiz is (being) submitted.
  final bool timeUp;

  BdQuizState copyWith({
    int? index,
    Map<String, BdJson>? answers,
    List<String>? dontKnow,
    List<BdQuizQuestionResult>? results,
    bool? revealed,
    Object? completion = _keep,
    Object? startedAt = _keep,
    Object? deadlineAt = _keep,
    double? clockOffset,
    double? pausedMs,
    Object? revealStartedAt = _keep,
    Object? pending = _keep,
    Object? error = _keep,
    Map<String, String>? fieldErrors,
    bool? timeUp,
  }) =>
      BdQuizState(
        index: index ?? this.index,
        answers: answers ?? this.answers,
        dontKnow: dontKnow ?? this.dontKnow,
        results: results ?? this.results,
        revealed: revealed ?? this.revealed,
        completion: identical(completion, _keep) ? this.completion : completion as BdQuizCompletion?,
        startedAt: identical(startedAt, _keep) ? this.startedAt : startedAt as double?,
        deadlineAt: identical(deadlineAt, _keep) ? this.deadlineAt : deadlineAt as double?,
        clockOffset: clockOffset ?? this.clockOffset,
        pausedMs: pausedMs ?? this.pausedMs,
        revealStartedAt: identical(revealStartedAt, _keep) ? this.revealStartedAt : revealStartedAt as double?,
        pending: identical(pending, _keep) ? this.pending : pending as BdQuizPending?,
        error: identical(error, _keep) ? this.error : error as String?,
        fieldErrors: fieldErrors ?? this.fieldErrors,
        timeUp: timeUp ?? this.timeUp,
      );

  Map<String, Object?> toJson() => {
        'index': index,
        'answers': {for (final e in answers.entries) e.key: e.value.toPlain()},
        'dontKnow': dontKnow,
        'results': results.map((r) => r.toJson()).toList(),
        'revealed': revealed,
        'completion': completion?.toJson(),
        'startedAt': startedAt,
        'deadlineAt': deadlineAt,
        'clockOffset': clockOffset,
        'pausedMs': pausedMs,
        'revealStartedAt': revealStartedAt,
        'pending': pending?.wire,
        'error': error,
        'fieldErrors': fieldErrors,
        'timeUp': timeUp,
      };
}

/// What `advance` asks of the host: nothing, a lock, or a submission.
sealed class BdQuizStep {
  const BdQuizStep(this.state);

  final BdQuizState state;
}

class BdQuizStay extends BdQuizStep {
  const BdQuizStay(super.state);
}

class BdQuizLock extends BdQuizStep {
  const BdQuizLock(super.state, this.fieldId, this.answer);

  final String fieldId;
  final BdJson answer;
}

class BdQuizSubmit extends BdQuizStep {
  const BdQuizSubmit(super.state, this.answers);

  final Map<String, BdJson> answers;
}

// ── Steps ───────────────────────────────────────────────────────────────────

abstract final class BdQuizEngine {
  static final _dateOnly = RegExp(r'^\d{4}-\d{2}-\d{2}$');

  /// Epoch ms from an ISO string or epoch ms; null when missing or bad.
  static double? timestamp(BdJson? value) => switch (value) {
        BdNum(:final value) => value.isFinite ? value : null,
        // JavaScript reads a bare date as UTC midnight; Dart would use local time.
        BdStr(:final value) when value.isNotEmpty =>
          DateTime.tryParse(_dateOnly.hasMatch(value) ? '${value}T00:00:00Z' : value)?.millisecondsSinceEpoch.toDouble(),
        _ => null,
      };

  static BdQuizQuestionResult? result(BdQuizState state, String fieldId) {
    for (final r in state.results) {
      if (r.fieldId == fieldId) return r;
    }
    return null;
  }

  static BdFormField? _question(BdQuizConfig config, String fieldId) {
    for (final q in config.questions) {
      if (q.id == fieldId) return q;
    }
    return null;
  }

  /// A fresh (or resumed) quiz. [now] is this device's clock, epoch ms.
  static BdQuizState initialState(BdQuizConfig config, BdQuizInitial initial, double now) {
    final results = initial.results ?? const <BdQuizQuestionResult>[];
    final locked = {for (final r in results) r.fieldId};
    final count = config.questions.length;
    final firstOpen = config.questions.indexWhere((q) => !locked.contains(q.id));
    final allLocked = count > 0 && firstOpen == -1;
    return BdQuizState(
      index: allLocked ? count - 1 : math.max(firstOpen, 0),
      answers: initial.answers ?? const {},
      dontKnow: initial.dontKnow ?? const [],
      results: results,
      revealed: config.feedbackMode == BdQuizFeedbackMode.immediate && allLocked,
      completion: initial.completion,
      startedAt: timestamp(initial.startedAt),
      deadlineAt: timestamp(initial.deadlineAt),
      clockOffset: initial.serverNow == null ? 0 : initial.serverNow! - now,
      pausedMs: 0,
      revealStartedAt: null,
      pending: null,
      error: null,
      fieldErrors: const {},
      timeUp: false,
    );
  }

  /// The server clock now.
  static double clock(BdQuizState state, double now) => now + state.clockOffset;

  static bool _busy(BdQuizState state) => state.pending != null || state.completion != null;

  static bool _isLocked(BdQuizConfig config, BdQuizState state, String fieldId) =>
      config.feedbackMode == BdQuizFeedbackMode.immediate && result(state, fieldId) != null;

  static BdJson emptyAnswer(BdFormField field) => BdQuizArrange.isMultiSelect(field) ? const BdArr([]) : const BdStr('');

  static Map<String, V> _without<V>(Map<String, V> map, String key) =>
      map.containsKey(key) ? ({...map}..remove(key)) : map;

  /// The taker answered (or changed) a question.
  static BdQuizState setAnswer(BdQuizConfig config, BdQuizState state, String fieldId, BdJson value) {
    if (_busy(state) || _isLocked(config, state, fieldId)) return state;
    if (_question(config, fieldId) == null) return state;
    return state.copyWith(
      answers: {...state.answers, fieldId: value},
      dontKnow: [for (final id in state.dontKnow) if (id != fieldId) id],
      fieldErrors: _without(state.fieldErrors, fieldId),
      error: null,
    );
  }

  /// Whether "I don't know" is offered on this question.
  static bool offersDontKnow(BdQuizConfig config, BdFormField field) =>
      config.allowDontKnow && BdQuizArrange.isMultipleChoice(field) && !field.required;

  /// "I don't know": the answer is left empty and marked as such.
  static BdQuizState chooseDontKnow(BdQuizConfig config, BdQuizState state, String fieldId) {
    final field = _question(config, fieldId);
    if (field == null || !offersDontKnow(config, field) || _busy(state) || _isLocked(config, state, fieldId)) return state;
    return state.copyWith(
      answers: {...state.answers, fieldId: emptyAnswer(field)},
      dontKnow: [for (final id in state.dontKnow) if (id != fieldId) id, fieldId],
      fieldErrors: _without(state.fieldErrors, fieldId),
      error: null,
    );
  }

  /// Required questions in [fields] left empty → field id → message.
  static Map<String, String> missing(BdQuizConfig config, BdQuizState state, List<BdFormField> fields) => {
        for (final f in fields)
          if (f.required && BdFormRules.isEmpty(f, state.answers[f.id]))
            f.id: BdQuizWords.fill(config.words.required, {'label': f.label.isEmpty ? 'This question' : f.label}),
      };

  /// The main button. Immediate: lock the answer, then move on (or finish).
  /// End, single: next question (or submit). End, all: submit.
  static BdQuizStep advance(BdQuizConfig config, BdQuizState state, double now) {
    if (_busy(state) || (config.timerEnabled && state.startedAt == null)) return BdQuizStay(state);
    final count = config.questions.length;
    if (state.index < 0 || state.index >= count) return BdQuizStay(state);
    final question = config.questions[state.index];
    final last = state.index >= count - 1;

    if (config.feedbackMode == BdQuizFeedbackMode.immediate) {
      if (state.revealed) {
        final resumed = endRevealPause(state, now);
        return last
            ? BdQuizSubmit(resumed.copyWith(pending: BdQuizPending.submit, error: null), state.answers)
            : BdQuizStay(resumed.copyWith(index: state.index + 1, revealed: false));
      }
      final errors = missing(config, state, [question]);
      if (errors.isNotEmpty) return BdQuizStay(state.copyWith(fieldErrors: errors));
      final given = state.answers[question.id];
      final answer = given == null || given.isNull ? emptyAnswer(question) : given;
      return BdQuizLock(state.copyWith(pending: BdQuizPending.lock, error: null, fieldErrors: const {}), question.id, answer);
    }

    final checking = config.layout == BdQuizLayout.all ? config.questions : [question];
    final errors = missing(config, state, checking);
    if (errors.isNotEmpty) return BdQuizStay(state.copyWith(fieldErrors: errors));
    if (config.layout == BdQuizLayout.single && !last) {
      return BdQuizStay(state.copyWith(index: state.index + 1, fieldErrors: const {}, error: null));
    }
    return BdQuizSubmit(state.copyWith(pending: BdQuizPending.submit, error: null, fieldErrors: const {}), state.answers);
  }

  /// End feedback, one at a time: the previous question.
  static BdQuizState back(BdQuizConfig config, BdQuizState state) {
    if (_busy(state) || config.feedbackMode != BdQuizFeedbackMode.end || config.layout != BdQuizLayout.single) return state;
    return state.index > 0 ? state.copyWith(index: state.index - 1, fieldErrors: const {}, error: null) : state;
  }

  /// The clock was started (from BD, or a local start).
  static BdQuizState started(BdQuizState state, BdQuizStartInfo info, double now) => state.copyWith(
        pending: null,
        error: null,
        clockOffset: info.serverNow - now,
        startedAt: timestamp(info.startedAt),
        deadlineAt: timestamp(info.deadlineAt),
      );

  /// A local start: now, with the deadline the time limit sets.
  static BdQuizStartInfo localStart(BdQuizConfig config, double now) => BdQuizStartInfo(
        startedAt: BdNum(now),
        deadlineAt: config.timeLimitMinutes == null ? null : BdNum(now + config.timeLimitMinutes! * 60000),
        serverNow: now,
      );

  /// A locked answer's verdict arrived: show it (and stop a local clock).
  static BdQuizState locked(
    BdQuizConfig config,
    BdQuizState state,
    String fieldId,
    BdJson answer,
    BdQuizQuestionResult result,
    double now,
  ) =>
      state.copyWith(
        pending: null,
        error: null,
        answers: {...state.answers, fieldId: answer},
        results: [for (final r in state.results) if (r.fieldId != fieldId) r, result],
        revealed: true,
        revealStartedAt: config.local ? clock(state, now) : state.revealStartedAt,
      );

  /// The verdict is closing: a local clock runs again.
  static BdQuizState endRevealPause(BdQuizState state, double now) {
    final since = state.revealStartedAt;
    if (since == null) return state;
    return state.copyWith(revealStartedAt: null, pausedMs: state.pausedMs + math.max(0, clock(state, now) - since));
  }

  static BdQuizState completed(BdQuizState state, BdQuizCompletion completion) =>
      state.copyWith(pending: null, error: null, completion: completion);

  static BdQuizState failed(BdQuizState state, String message) => state.copyWith(pending: null, error: message);

  /// How long a run took and whether it ran out of time (local runs).
  static ({bool timedOut, double? durationSeconds}) localTiming(BdQuizState state, double now) {
    final at = clock(state, now);
    return (
      timedOut: state.deadlineAt != null && at >= state.deadlineAt! + state.pausedMs,
      durationSeconds: state.startedAt == null ? null : math.max(0, jsRound((at - state.startedAt!) / 1000)).toDouble(),
    );
  }

  /// Grade a local run: every question, with timing.
  static BdQuizCompletion localCompletion(BdQuizConfig config, BdQuizState state, Map<String, BdJson> answers, double now) {
    final score = BdQuizScoring.score(config.questions, answers, config.passingScore);
    final timing = localTiming(state, now);
    return BdQuizCompletion(
      status: score.status,
      results: score.results,
      pointsEarned: score.pointsEarned,
      pointsPossible: score.pointsPossible,
      scorePercent: score.scorePercent,
      provisionalScorePercent: score.provisionalScorePercent,
      passed: score.passed,
      timedOut: timing.timedOut,
      durationSeconds: timing.durationSeconds,
    );
  }

  /// Grade one question locally (immediate feedback, local run).
  static BdQuizQuestionResult? localResult(BdQuizConfig config, String fieldId, BdJson answer) {
    final field = _question(config, fieldId);
    if (field == null) return null;
    final results = BdQuizScoring.score([field], {fieldId: answer}, config.passingScore).results;
    return results.isEmpty ? null : results.first;
  }

  static double _revealPauseNow(BdQuizConfig config, BdQuizState state, double now) {
    final since = state.revealStartedAt;
    return !config.local || since == null ? 0 : math.max(0, clock(state, now) - since);
  }

  /// The deadline everything counts down to; a local run adds paused time.
  static double? effectiveDeadline(BdQuizConfig config, BdQuizState state, double now) {
    final deadline = state.deadlineAt;
    if (deadline == null) return null;
    return config.local ? deadline + state.pausedMs + _revealPauseNow(config, state, now) : deadline;
  }

  /// Time's up: the host should submit now. True once, until [timeUp] records it.
  static bool deadlinePassed(BdQuizConfig config, BdQuizState state, double now) {
    final deadline = effectiveDeadline(config, state, now);
    if (deadline == null) return false;
    return clock(state, now) >= deadline && state.completion == null && state.pending == null && !state.timeUp;
  }

  static BdQuizState timeUp(BdQuizState state) => state.copyWith(timeUp: true, pending: BdQuizPending.submit, error: null);

  // ── Display helpers ──

  /// `m:ss`, or `h:mm:ss` from an hour.
  static String durationLabel(double totalSeconds) {
    final seconds = math.max(0, totalSeconds.floor());
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final rest = seconds % 60;
    String pad(int n) => n.toString().padLeft(2, '0');
    return hours > 0 ? '$hours:${pad(minutes)}:${pad(rest)}' : '$minutes:${pad(rest)}';
  }

  /// An answer as one line of text.
  static String answerText(BdJson? value, [BdQuizWords words = const BdQuizWords()]) => switch (value) {
        BdArr(:final items) => items.isEmpty ? words.noAnswer : items.map((i) => answerText(i, words)).join(', '),
        null || BdNull() => words.noAnswer,
        BdBool(:final value) => value ? words.yes : words.no,
        BdObj(:final fields) => () {
            final parts = [
              for (final part in fields.values)
                if (part case BdStr(:final value) when BdJS.trim(value).isNotEmpty)
                  value
                else if (part case BdNum(:final value))
                  BdJS.formatNumber(value),
            ];
            return parts.isEmpty ? words.noAnswer : parts.join(', ');
          }(),
        _ => () {
            final text = BdJS.trim(BdQuizScoring.stripTags(BdJS.string(value)));
            return text.isEmpty ? words.noAnswer : text;
          }(),
      };

  /// JavaScript's `Math.round`: half rounds up, toward +∞.
  static double jsRound(double value) => (value + 0.5).floorToDouble();

  /// Whole percent, rounded half up.
  static int percent(double value) => jsRound(value).toInt();

  static double _clamp(double value, double low, double high) => math.min(high, math.max(low, value));

  // ── The screen ──

  static BdQuizBadge _badge(BdQuizWords w, BdQuizQuestionResult result, bool dontKnow) {
    if (dontKnow && result.status != BdQuizQuestionStatus.correct) {
      return BdQuizBadge(label: w.dontKnow, tone: BdQuizTone.unsure);
    }
    return switch (result.status) {
      BdQuizQuestionStatus.correct => BdQuizBadge(label: w.correct, tone: BdQuizTone.correct),
      BdQuizQuestionStatus.partiallyCorrect => BdQuizBadge(label: w.partiallyCorrect, tone: BdQuizTone.partial),
      BdQuizQuestionStatus.pendingAi => BdQuizBadge(label: w.pendingAi, tone: BdQuizTone.pending),
      BdQuizQuestionStatus.unscored => BdQuizBadge(label: w.unscored, tone: BdQuizTone.unscored),
      BdQuizQuestionStatus.incorrect => BdQuizBadge(label: w.incorrect, tone: BdQuizTone.incorrect),
    };
  }

  /// One verdict as a feedback card.
  static BdQuizFeedback feedback(BdQuizWords w, BdQuizQuestionResult result, {bool dontKnow = false}) {
    final answer = result.answer;
    final unanswered = switch (answer) {
      null || BdNull() => true,
      BdStr(:final value) => value.isEmpty,
      BdArr(:final items) => items.isEmpty,
      _ => false,
    };
    final picked = [
      for (final o in result.rationale?.selectedOptions ?? const <BdQuizOptionExplanation>[])
        if (o.explanation case final e?) BdQuizOptionNote(option: o.option, explanation: e),
    ];
    final others = [
      for (final o in result.rationale?.optionExplanations ?? const <BdQuizOptionExplanation>[])
        if (!o.accepted)
          if (o.explanation case final e?) BdQuizOptionNote(option: o.option, explanation: e),
    ];
    final accepted = result.correctAnswers;
    return BdQuizFeedback(
      fieldId: result.fieldId,
      label: result.label,
      badge: _badge(w, result, dontKnow),
      accuracy: result.accuracyPercent == null
          ? null
          : BdQuizWords.fill(w.accurate, {'percent': '${percent(result.accuracyPercent!)}'}),
      answerLabel: w.yourAnswer,
      answer: dontKnow && unanswered ? w.dontKnow : answerText(answer, w),
      acceptedLabel: w.acceptedAnswer,
      accepted: accepted == null || accepted.isEmpty ? null : accepted.join(' · '),
      whyLabel: unanswered ? w.whyAccepted : w.why,
      why: result.rationale?.explanation,
      selected: picked.length > 1 ? picked : const [],
      others: others.isEmpty ? null : BdQuizOtherOptions(label: w.whyOthers, items: others),
    );
  }

  /// The timer as shown, or null when the quiz has none or hasn't started.
  static BdQuizTimer? timer(BdQuizConfig config, BdQuizState state, double now) {
    final startedAt = state.startedAt;
    if (!config.timerEnabled || startedAt == null) return null;
    final at = clock(state, now);
    final deadline = effectiveDeadline(config, state, now);
    // The bar is against the time allowed, not the stretched deadline: a
    // local run's pauses push the deadline out, and the bar holds still
    // through them instead of shrinking.
    final allowed = (state.deadlineAt ?? startedAt) - startedAt;
    final seconds = deadline != null
        ? math.max(0, ((deadline - at) / 1000).ceil())
        : math.max(0, ((at - startedAt) / 1000).floor());
    return BdQuizTimer(
      label: deadline != null ? config.words.timeRemaining : config.words.elapsedTime,
      value: durationLabel(seconds.toDouble()),
      seconds: seconds,
      countdown: deadline != null,
      warning: deadline != null && seconds <= 60,
      paused: config.local && deadline != null && state.revealed,
      pausedLabel: config.words.paused,
      progress: deadline == null ? null : (allowed > 0 ? _clamp(((deadline - at) / allowed) * 100, 0, 100) : 0),
    );
  }

  static List<BdQuizChoice> _choices(BdFormField field, BdJson? value, BdQuizQuestionResult? result) {
    final picked = {for (final v in value?.arrayValue ?? [value]) BdJS.string(v)};
    final scored = result?.correctAnswers?.isNotEmpty ?? false;
    final labels = BdQuizScoring.optionLabels(field);
    return [
      for (var i = 0; i < labels.length; i++)
        BdQuizChoice(
          letter: BdQuizArrange.choiceLetter(i),
          label: labels[i],
          selected: picked.contains(labels[i]),
          state: result == null
              ? (picked.contains(labels[i]) ? BdQuizChoiceState.selected : BdQuizChoiceState.idle)
              : scored && BdQuizScoring.isAcceptedLabel(result, labels[i])
                  ? BdQuizChoiceState.correct
                  : picked.contains(labels[i])
                      ? (scored ? BdQuizChoiceState.incorrect : BdQuizChoiceState.selected)
                      : BdQuizChoiceState.dimmed,
        ),
    ];
  }

  static BdQuizQuestion _questionView(BdQuizConfig config, BdQuizState state, BdFormField field, int index) {
    final value = state.answers[field.id];
    final verdict = config.feedbackMode == BdQuizFeedbackMode.immediate ? result(state, field.id) : null;
    final chosen = state.dontKnow.contains(field.id);
    return BdQuizQuestion(
      field: field,
      number: index + 1,
      label: field.label,
      value: value,
      error: state.fieldErrors[field.id],
      locked: verdict != null || _busy(state),
      choices: BdQuizArrange.isMultipleChoice(field) ? _choices(field, value, verdict) : null,
      multiple: BdQuizArrange.isMultiSelect(field),
      dontKnow: !offersDontKnow(config, field)
          ? null
          : BdQuizDontKnowChoice(
              label: config.words.dontKnow,
              selected: chosen,
              state: verdict != null
                  ? (chosen ? BdQuizChoiceState.incorrect : BdQuizChoiceState.dimmed)
                  : (chosen ? BdQuizChoiceState.selected : BdQuizChoiceState.idle),
            ),
    );
  }

  static int _answered(BdQuizConfig config, BdQuizState state) => config.questions
      .where((q) => !BdFormRules.isEmpty(q, state.answers[q.id]) || state.dontKnow.contains(q.id))
      .length;

  static String _resultsMessage(BdQuizWords w, int percent) => percent >= 90
      ? w.messageExcellent
      : percent >= 75
          ? w.messageSolid
          : percent >= 50
              ? w.messageGettingThere
              : w.messageKeepGoing;

  static BdQuizDone _done(BdQuizConfig config, BdQuizState state, BdQuizCompletion completion) {
    final w = config.words;
    if (!config.showScore) return BdQuizSubmitted(eyebrow: w.submittedEyebrow, title: w.submittedTitle, body: w.submittedBody);
    if (config.resultsLocked) return BdQuizResultsLocked(eyebrow: w.lockedEyebrow, title: w.lockedTitle, body: w.lockedBody);
    final score = percent(completion.scorePercent ?? completion.provisionalScorePercent ?? 0);
    final scorable = completion.results.where((r) => r.pointsPossible > 0).toList();
    final correct = scorable.where((r) => r.status == BdQuizQuestionStatus.correct).length;
    final pending = completion.status == 'pending_ai_review';
    String? timing;
    if (completion.timedOut == true || completion.durationSeconds != null) {
      final label = completion.timedOut == true ? w.timeLimitReached : w.completed;
      timing = completion.durationSeconds == null
          ? label
          : BdQuizWords.fill(w.inDuration, {'label': label, 'duration': durationLabel(completion.durationSeconds!)});
    }
    return BdQuizResults(
      eyebrow: w.resultsEyebrow,
      score: '$score%',
      tally: scorable.isEmpty ? null : BdQuizWords.fill(w.tally, {'correct': '$correct', 'total': '${scorable.length}'}),
      summary: pending ? w.provisional : (completion.passed == true ? w.passed : w.notPassed),
      message: pending ? null : _resultsMessage(w, score),
      timing: timing,
      passed: completion.passed,
      items: [
        for (var i = 0; i < completion.results.length; i++)
          () {
            final r = completion.results[i];
            final card = feedback(w, r, dontKnow: state.dontKnow.contains(r.fieldId));
            return BdQuizResultItem(number: i + 1, label: r.label, tone: card.badge.tone, feedback: card);
          }(),
      ],
    );
  }

  /// Exactly what the quiz screen shows now.
  static BdQuizScreen screen(BdQuizConfig config, BdQuizState state, double now) {
    final w = config.words;
    final count = config.questions.length;
    final busy = state.pending != null;

    if (state.completion case final completion?) {
      final done = _done(config, state, completion);
      final isLocked = done is BdQuizResultsLocked;
      return BdQuizScreen(
        phase: BdQuizPhase.done,
        done: done,
        error: state.error,
        busy: busy,
        actions: [
          if (isLocked && config.signInHref != null)
            BdQuizAction(id: BdQuizActionId.signIn, label: w.lockedAction, enabled: true, primary: true, href: config.signInHref),
          if (config.canRestart) BdQuizAction(id: BdQuizActionId.retake, label: w.retake, enabled: true, primary: !isLocked),
        ],
      );
    }

    if (count == 0) return BdQuizScreen(phase: BdQuizPhase.empty, empty: w.empty, error: state.error, busy: busy);

    if (config.timerEnabled && state.startedAt == null) {
      final limit = config.timeLimitMinutes;
      final body = limit == null
          ? w.readyElapsed
          : limit == 1
              ? w.readyLimitOne
              : BdQuizWords.fill(w.readyLimitMany, {'minutes': '$limit'});
      return BdQuizScreen(
        phase: BdQuizPhase.ready,
        ready: BdQuizReady(icon: limit != null ? 'hourglass' : 'clock', title: w.readyTitle, body: body),
        error: state.error,
        busy: busy,
        actions: [
          BdQuizAction(
            id: BdQuizActionId.start,
            label: state.pending == BdQuizPending.start ? w.starting : w.start,
            enabled: state.pending == null,
            primary: true,
          ),
        ],
      );
    }

    final clockView = timer(config, state, now);
    final idle = state.pending == null;
    final submit = BdQuizAction(
      id: BdQuizActionId.submit,
      label: state.pending == BdQuizPending.submit ? w.submitting : w.submit,
      enabled: idle,
      primary: true,
    );

    if (config.feedbackMode == BdQuizFeedbackMode.end && config.layout == BdQuizLayout.all) {
      final done = _answered(config, state);
      return BdQuizScreen(
        phase: BdQuizPhase.all,
        timer: clockView,
        progress: BdQuizProgress(
          position: BdQuizWords.fill(w.answeredOf, {'answered': '$done', 'total': '$count'}),
          percent: done / count * 100,
        ),
        notice: config.showScore ? w.endNotice : w.endNoticeHidden,
        questions: [for (var i = 0; i < count; i++) _questionView(config, state, config.questions[i], i)],
        actions: [submit],
        error: state.error,
        busy: busy,
      );
    }

    final index = state.index.clamp(0, count - 1);
    final field = config.questions[index];
    final last = state.index >= count - 1;
    final position = BdQuizWords.fill(w.questionOf, {'number': '${state.index + 1}', 'total': '$count'});

    if (config.feedbackMode == BdQuizFeedbackMode.immediate) {
      final verdict = result(state, field.id);
      final showing = state.revealed && verdict != null;
      final percentDone = math.max((state.revealed ? state.results.length : state.index) / count * 100, 4.0);
      final finishLabel = config.showScore && !config.resultsLocked ? w.seeResults : w.finish;
      return BdQuizScreen(
        phase: showing ? BdQuizPhase.feedback : BdQuizPhase.question,
        timer: clockView,
        progress: BdQuizProgress(position: position, note: w.locksWhenChecked, percent: percentDone),
        questions: [_questionView(config, state, field, state.index)],
        feedback: showing ? feedback(w, verdict, dontKnow: state.dontKnow.contains(field.id)) : null,
        error: state.error,
        busy: busy,
        actions: [
          if (showing)
            BdQuizAction(
              id: last ? BdQuizActionId.finish : BdQuizActionId.next,
              label: state.pending == BdQuizPending.submit
                  ? w.submitting
                  : last
                      ? finishLabel
                      : w.nextQuestion,
              enabled: idle,
              primary: true,
            )
          else
            BdQuizAction(
              id: BdQuizActionId.lock,
              label: state.pending == BdQuizPending.lock
                  ? w.checking
                  : config.local
                      ? w.checkAnswer
                      : w.lockAnswer,
              enabled: idle,
              primary: true,
            ),
        ],
      );
    }

    return BdQuizScreen(
      phase: BdQuizPhase.question,
      timer: clockView,
      progress: BdQuizProgress(position: position, percent: math.max(state.index / count * 100, 4.0)),
      notice: config.showScore ? w.endNotice : w.endNoticeHidden,
      questions: [_questionView(config, state, field, state.index)],
      error: state.error,
      busy: busy,
      actions: [
        if (state.index > 0) BdQuizAction(id: BdQuizActionId.back, label: w.back, enabled: idle, primary: false),
        if (last) submit else BdQuizAction(id: BdQuizActionId.next, label: w.next, enabled: idle, primary: true),
      ],
    );
  }
}
