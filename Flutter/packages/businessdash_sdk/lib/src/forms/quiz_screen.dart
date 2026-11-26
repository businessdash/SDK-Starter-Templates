// Exactly what a quiz screen shows, texts included: the TypeScript
// forms-core's `QuizView`. `BdQuiz` (in businessdash_forms) draws it; a
// custom UI can draw it too. [BdQuizEngine.screen] builds one.

import 'json.dart';
import 'schema.dart';

enum BdQuizTone {
  correct('correct'),
  partial('partial'),
  incorrect('incorrect'),
  pending('pending'),
  unscored('unscored'),
  unsure('unsure');

  const BdQuizTone(this.wire);
  final String wire;
}

enum BdQuizChoiceState {
  idle('idle'),
  selected('selected'),
  correct('correct'),
  incorrect('incorrect'),
  dimmed('dimmed');

  const BdQuizChoiceState(this.wire);
  final String wire;
}

class BdQuizChoice {
  const BdQuizChoice(
      {required this.letter,
      required this.label,
      required this.selected,
      required this.state});

  final String letter;
  final String label;
  final bool selected;
  final BdQuizChoiceState state;

  Map<String, Object?> toJson() => {
        'letter': letter,
        'label': label,
        'selected': selected,
        'state': state.wire
      };
}

class BdQuizDontKnowChoice {
  const BdQuizDontKnowChoice(
      {required this.label, required this.selected, required this.state});

  final String label;
  final bool selected;
  final BdQuizChoiceState state;

  Map<String, Object?> toJson() =>
      {'label': label, 'selected': selected, 'state': state.wire};
}

class BdQuizQuestion {
  const BdQuizQuestion({
    required this.field,
    required this.number,
    required this.label,
    this.value,
    this.error,
    required this.locked,
    this.choices,
    required this.multiple,
    this.dontKnow,
  });

  final BdFormField field;

  /// 1-based, in the order asked.
  final int number;
  final String label;
  final BdJson? value;
  final String? error;

  /// The answer can't change (locked, or the quiz is busy).
  final bool locked;

  /// Lettered choices for multiple choice; null: render an input for the field.
  final List<BdQuizChoice>? choices;
  final bool multiple;
  final BdQuizDontKnowChoice? dontKnow;

  /// The field goes out as its id, as the fixtures carry it.
  Map<String, Object?> toJson() => {
        'field': field.id,
        'number': number,
        'label': label,
        'value': value?.toPlain(),
        'error': error,
        'locked': locked,
        'choices': choices?.map((c) => c.toJson()).toList(),
        'multiple': multiple,
        'dontKnow': dontKnow?.toJson(),
      };
}

class BdQuizOptionNote {
  const BdQuizOptionNote({required this.option, required this.explanation});

  final String option;
  final String explanation;

  Map<String, Object?> toJson() =>
      {'option': option, 'explanation': explanation};
}

class BdQuizBadge {
  const BdQuizBadge({required this.label, required this.tone});

  final String label;
  final BdQuizTone tone;

  Map<String, Object?> toJson() => {'label': label, 'tone': tone.wire};
}

class BdQuizOtherOptions {
  const BdQuizOtherOptions({required this.label, required this.items});

  final String label;
  final List<BdQuizOptionNote> items;

  Map<String, Object?> toJson() =>
      {'label': label, 'items': items.map((i) => i.toJson()).toList()};
}

class BdQuizFeedback {
  const BdQuizFeedback({
    required this.fieldId,
    required this.label,
    required this.badge,
    this.accuracy,
    required this.answerLabel,
    required this.answer,
    required this.acceptedLabel,
    this.accepted,
    required this.whyLabel,
    this.why,
    required this.selected,
    this.others,
  });

  final String fieldId;
  final String label;
  final BdQuizBadge badge;
  final String? accuracy;
  final String answerLabel;
  final String answer;
  final String acceptedLabel;
  final String? accepted;
  final String whyLabel;
  final String? why;

  /// Explanations for each picked option, when several were picked.
  final List<BdQuizOptionNote> selected;
  final BdQuizOtherOptions? others;

  Map<String, Object?> toJson() => {
        'fieldId': fieldId,
        'label': label,
        'badge': badge.toJson(),
        'accuracy': accuracy,
        'answerLabel': answerLabel,
        'answer': answer,
        'acceptedLabel': acceptedLabel,
        'accepted': accepted,
        'whyLabel': whyLabel,
        'why': why,
        'selected': selected.map((s) => s.toJson()).toList(),
        'others': others?.toJson(),
      };
}

class BdQuizTimer {
  const BdQuizTimer({
    required this.label,
    required this.value,
    required this.seconds,
    required this.countdown,
    required this.warning,
    required this.paused,
    required this.pausedLabel,
    this.progress,
  });

  final String label;
  final String value;
  final int seconds;
  final bool countdown;

  /// A minute or less left.
  final bool warning;
  final bool paused;
  final String pausedLabel;

  /// Percent of time left, for a bar; null without a countdown.
  final double? progress;

  Map<String, Object?> toJson() => {
        'label': label,
        'value': value,
        'seconds': seconds,
        'countdown': countdown,
        'warning': warning,
        'paused': paused,
        'pausedLabel': pausedLabel,
        'progress': progress,
      };
}

enum BdQuizActionId {
  start('start'),
  lock('lock'),
  next('next'),
  back('back'),
  submit('submit'),
  finish('finish'),
  retake('retake'),
  signIn('signIn');

  const BdQuizActionId(this.wire);
  final String wire;
}

class BdQuizAction {
  const BdQuizAction(
      {required this.id,
      required this.label,
      required this.enabled,
      required this.primary,
      this.href});

  final BdQuizActionId id;
  final String label;
  final bool enabled;
  final bool primary;
  final String? href;

  Map<String, Object?> toJson() => {
        'id': id.wire,
        'label': label,
        'enabled': enabled,
        'primary': primary,
        'href': href
      };
}

/// How a quiz ended, as shown.
sealed class BdQuizDone {
  const BdQuizDone();

  Map<String, Object?> toJson();
}

/// Score, tally and per-question feedback.
class BdQuizResults extends BdQuizDone {
  const BdQuizResults({
    required this.eyebrow,
    required this.score,
    this.tally,
    required this.summary,
    this.message,
    this.timing,
    this.passed,
    required this.items,
  });

  final String eyebrow;
  final String score;
  final String? tally;
  final String summary;
  final String? message;
  final String? timing;
  final bool? passed;
  final List<BdQuizResultItem> items;

  @override
  Map<String, Object?> toJson() => {
        'kind': 'results',
        'eyebrow': eyebrow,
        'score': score,
        'tally': tally,
        'summary': summary,
        'message': message,
        'timing': timing,
        'passed': passed,
        'items': items.map((i) => i.toJson()).toList(),
      };
}

class BdQuizResultItem {
  const BdQuizResultItem(
      {required this.number,
      required this.label,
      required this.tone,
      required this.feedback});

  final int number;
  final String label;
  final BdQuizTone tone;
  final BdQuizFeedback feedback;

  Map<String, Object?> toJson() => {
        'number': number,
        'label': label,
        'tone': tone.wire,
        'feedback': feedback.toJson()
      };
}

/// Interview mode: a thank-you, never a score.
class BdQuizSubmitted extends BdQuizDone {
  const BdQuizSubmitted(
      {required this.eyebrow, required this.title, required this.body});

  final String eyebrow;
  final String title;
  final String body;

  @override
  Map<String, Object?> toJson() =>
      {'kind': 'submitted', 'eyebrow': eyebrow, 'title': title, 'body': body};
}

/// Results wait for the invited account.
class BdQuizResultsLocked extends BdQuizDone {
  const BdQuizResultsLocked(
      {required this.eyebrow, required this.title, required this.body});

  final String eyebrow;
  final String title;
  final String body;

  @override
  Map<String, Object?> toJson() =>
      {'kind': 'locked', 'eyebrow': eyebrow, 'title': title, 'body': body};
}

enum BdQuizPhase {
  empty('empty'),
  ready('ready'),
  question('question'),
  all('all'),
  feedback('feedback'),
  done('done');

  const BdQuizPhase(this.wire);
  final String wire;
}

class BdQuizReady {
  const BdQuizReady(
      {required this.icon, required this.title, required this.body});

  /// `hourglass` (a countdown) or `clock` (elapsed time).
  final String icon;
  final String title;
  final String body;

  Map<String, Object?> toJson() => {'icon': icon, 'title': title, 'body': body};
}

class BdQuizProgress {
  const BdQuizProgress(
      {required this.position, this.note, required this.percent});

  final String position;
  final String? note;
  final double percent;

  Map<String, Object?> toJson() =>
      {'position': position, 'note': note, 'percent': percent};
}

class BdQuizScreen {
  const BdQuizScreen({
    required this.phase,
    this.empty,
    this.ready,
    this.timer,
    this.progress,
    this.notice,
    this.questions = const [],
    this.feedback,
    this.done,
    this.actions = const [],
    this.error,
    required this.busy,
  });

  final BdQuizPhase phase;
  final String? empty;
  final BdQuizReady? ready;
  final BdQuizTimer? timer;
  final BdQuizProgress? progress;

  /// End feedback: when answers and rationale appear.
  final String? notice;
  final List<BdQuizQuestion> questions;
  final BdQuizFeedback? feedback;
  final BdQuizDone? done;
  final List<BdQuizAction> actions;
  final String? error;
  final bool busy;

  Map<String, Object?> toJson() => {
        'phase': phase.wire,
        'empty': empty,
        'ready': ready?.toJson(),
        'timer': timer?.toJson(),
        'progress': progress?.toJson(),
        'notice': notice,
        'questions': questions.map((q) => q.toJson()).toList(),
        'feedback': feedback?.toJson(),
        'done': done?.toJson(),
        'actions': actions.map((a) => a.toJson()).toList(),
        'error': error,
        'busy': busy,
      };
}
