import 'dart:async';

import 'backend.dart' show BdFormsException;
import 'json.dart';
import 'quiz.dart';
import 'quiz_backend.dart';
import 'quiz_scoring.dart';
import 'quiz_screen.dart';

/// A quiz being taken: the pure engine plus its async parts (BD calls, the
/// clock, autosave). businessdash_forms' `BdQuiz` draws one; a custom UI can
/// listen and read [screen], and call the same methods.
///
/// ```dart
/// // A local quiz: the fields carry answer keys, graded on the device.
/// final quiz = BdQuizController(BdQuizOptions(fields: fields, feedbackMode: BdQuizFeedbackMode.immediate));
/// ```
///
/// Call it from the UI isolate, and [dispose] it when the quiz goes away.
class BdQuizController {
  /// [backend] is BD's side ([BdQuizzes.invitationBackend] / `practiceBackend`);
  /// null for a local run, graded here. [initial] is where a resumed quiz was
  /// left ([BdQuizInvitation.initial]). [clock] is this device's clock, epoch
  /// ms (a test hook).
  BdQuizController(
    BdQuizOptions options, {
    this.backend,
    BdQuizInitial initial = const BdQuizInitial(),
    this.draftDelay = const Duration(milliseconds: 750),
    double Function()? clock,
  })  : _clock =
            clock ?? (() => DateTime.now().millisecondsSinceEpoch.toDouble()),
        _local = options.local ?? backend == null,
        _options = options.copyWith(
            local: options.local ?? backend == null,
            canRestart:
                options.canRestart ?? (options.local ?? backend == null)) {
    config = BdQuizConfig(_options, options.seed ?? BdQuizArrange.randomSeed());
    _state = BdQuizEngine.initialState(config, initial, _clock());
    _lastDraft = _state.answers;
    _screen = BdQuizEngine.screen(config, _state, _clock());
    _syncClock();
  }

  final BdQuizBackend? backend;
  final Duration draftDelay;
  final double Function() _clock;
  final bool _local;
  final BdQuizOptions _options;

  late BdQuizConfig config;
  late BdQuizState _state;
  late BdQuizScreen _screen;

  /// Everything that changes while the quiz is taken.
  BdQuizState get state => _state;

  /// Exactly what the quiz screen shows now.
  BdQuizScreen get screen => _screen;

  /// Called once, when the quiz ends (scored, submitted, or timed out).
  void Function(BdQuizCompletion completion)? onDone;

  final _listeners = <void Function()>[];
  void addListener(void Function() listener) => _listeners.add(listener);
  void removeListener(void Function() listener) => _listeners.remove(listener);

  Timer? _ticker;
  Timer? _draftTimer;
  late Map<String, BdJson> _lastDraft;
  var _disposed = false;

  /// Bumped by a retake or [dispose]: replies to an earlier run are dropped.
  var _generation = 0;

  // ── Taking the quiz ──

  void setAnswer(String fieldId, BdJson value) {
    final before = _state;
    _set(BdQuizEngine.setAnswer(config, _state, fieldId, value));
    if (!identical(_state, before)) _scheduleDraft();
  }

  /// Pick or unpick a lettered choice: one answer, or toggled in a multi-select's list.
  void choose(String fieldId, String label) {
    final field = config.questions.where((q) => q.id == fieldId).firstOrNull;
    if (field == null) return;
    if (BdQuizArrange.isMultiSelect(field)) {
      final picked = _state.answers[fieldId]?.arrayValue ?? const <BdJson>[];
      final has = picked.any((p) => p.stringValue == label);
      setAnswer(
          fieldId,
          BdArr(has
              ? [
                  for (final p in picked)
                    if (p.stringValue != label) p
                ]
              : [...picked, BdStr(label)]));
    } else {
      setAnswer(fieldId, BdStr(label));
    }
  }

  void chooseDontKnow(String fieldId) {
    final before = _state;
    _set(BdQuizEngine.chooseDontKnow(config, _state, fieldId));
    if (!identical(_state, before)) _scheduleDraft();
  }

  /// Run a screen action by id ([BdQuizAction.id]). [BdQuizActionId.signIn] is the host's.
  Future<void> perform(BdQuizActionId action) async {
    switch (action) {
      case BdQuizActionId.start:
        await start();
      case BdQuizActionId.lock ||
            BdQuizActionId.next ||
            BdQuizActionId.submit ||
            BdQuizActionId.finish:
        await advance();
      case BdQuizActionId.back:
        back();
      case BdQuizActionId.retake:
        restart();
      case BdQuizActionId.signIn:
        break;
    }
  }

  /// Start the clock (timed quizzes).
  Future<void> start() async {
    if (_state.startedAt != null || _state.pending != null) return;
    final run = _generation;
    _set(_state.copyWith(pending: BdQuizPending.start, error: null));
    try {
      final info = backend?.start != null
          ? await backend!.start!()
          : BdQuizEngine.localStart(config, _clock());
      if (run == _generation) {
        _set(BdQuizEngine.started(_state, info, _clock()));
      }
    } catch (e) {
      if (run == _generation) {
        _set(
            BdQuizEngine.failed(_state, _message(e, config.words.startFailed)));
      }
    }
  }

  /// The main button: lock and check, next, or submit.
  Future<void> advance() async {
    final step = BdQuizEngine.advance(config, _state, _clock());
    _set(step.state);
    switch (step) {
      case BdQuizLock(:final fieldId, :final answer):
        await _lock(fieldId, answer);
      case BdQuizSubmit(:final answers):
        await _submit(answers, config.words.submitFailed);
      case BdQuizStay():
        break;
    }
  }

  void back() => _set(BdQuizEngine.back(config, _state));

  /// A fresh run (local quizzes): a new order when anything is shuffled.
  void restart() {
    if (!_local) return;
    _generation++;
    _draftTimer?.cancel();
    config = BdQuizConfig(_options, BdQuizArrange.randomSeed());
    _state = BdQuizEngine.initialState(config, const BdQuizInitial(), _clock());
    _lastDraft = _state.answers;
    _publish();
    _syncClock();
  }

  /// Re-read the clock: update the timer, submit when time is up. Runs on
  /// its own every half second while timed.
  void tick() {
    if (_disposed) return;
    if (!BdQuizEngine.deadlinePassed(config, _state, _clock())) {
      _publish();
      return;
    }
    final answers = _state.answers;
    _set(BdQuizEngine.timeUp(_state));
    final saveDraft = config.feedbackMode == BdQuizFeedbackMode.end
        ? backend?.saveDraft
        : null;
    () async {
      // The submission carries the answers anyway; the draft is a backstop.
      if (saveDraft != null) {
        try {
          await saveDraft(answers);
        } catch (_) {}
      }
      await _submit(answers, config.words.timedSubmitFailed);
    }();
  }

  /// Stop the clock and autosave, drop any reply still on its way, and stop
  /// calling listeners.
  void dispose() {
    _disposed = true;
    _generation++;
    _ticker?.cancel();
    _draftTimer?.cancel();
    _listeners.clear();
  }

  // ── Internals ──

  void _publish() {
    _screen = BdQuizEngine.screen(config, _state, _clock());
    if (_disposed) return;
    for (final listener in List.of(_listeners)) {
      listener();
    }
  }

  void _set(BdQuizState next) {
    final finished = _state.completion == null && next.completion != null;
    _state = next;
    _publish();
    _syncClock();
    if (finished && !_disposed) onDone?.call(next.completion!);
  }

  void _syncClock() {
    final running = config.timerEnabled &&
        _state.startedAt != null &&
        _state.completion == null &&
        !_disposed;
    if (running && _ticker == null) {
      _ticker =
          Timer.periodic(const Duration(milliseconds: 500), (_) => tick());
    } else if (!running) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  static bool _sameAnswers(Map<String, BdJson> a, Map<String, BdJson> b) =>
      a.length == b.length && a.entries.every((e) => b[e.key] == e.value);

  void _scheduleDraft() {
    final saveDraft = backend?.saveDraft;
    if (saveDraft == null || config.feedbackMode != BdQuizFeedbackMode.end) {
      return;
    }
    if (config.timerEnabled && _state.startedAt == null) return;
    _draftTimer?.cancel();
    final run = _generation;
    _draftTimer = Timer(draftDelay, () async {
      final answers = _state.answers;
      if (run != _generation || _sameAnswers(answers, _lastDraft)) return;
      _lastDraft = answers;
      try {
        await saveDraft(answers);
      } catch (e) {
        if (run == _generation) {
          _set(_state.copyWith(error: _message(e, config.words.draftFailed)));
        }
      }
    });
  }

  Future<void> _submit(Map<String, BdJson> answers, String failure) async {
    _draftTimer?.cancel();
    final run = _generation;
    try {
      var completion = backend != null
          ? await backend!
              .submit(answers, [for (final q in config.questions) q.id])
          : BdQuizEngine.localCompletion(config, _state, answers, _clock());
      // Graded by BD but timed here (a practice run): add the timing.
      if (backend != null && config.local) {
        final timing = BdQuizEngine.localTiming(_state, _clock());
        completion = completion.withTiming(
          timedOut: completion.timedOut ?? timing.timedOut,
          durationSeconds: completion.durationSeconds ?? timing.durationSeconds,
        );
      }
      if (run == _generation) _set(BdQuizEngine.completed(_state, completion));
    } catch (e) {
      if (run == _generation) {
        _set(BdQuizEngine.failed(_state, _message(e, failure)));
      }
    }
  }

  Future<void> _lock(String fieldId, BdJson answer) async {
    final run = _generation;
    try {
      final BdQuizQuestionResult result;
      if (backend != null) {
        final lockAnswer = backend!.lockAnswer ??
            (throw BdFormsException(config.words.unscorable));
        result = await lockAnswer(fieldId, answer);
      } else {
        result = BdQuizEngine.localResult(config, fieldId, answer) ??
            (throw BdFormsException(config.words.unscorable));
      }
      if (run == _generation) {
        _set(BdQuizEngine.locked(
            config, _state, fieldId, answer, result, _clock()));
      }
    } catch (e) {
      if (run == _generation) {
        _set(BdQuizEngine.failed(_state, _message(e, config.words.lockFailed)));
      }
    }
  }

  /// BD's own words when it sent some (not a transport failure); otherwise the quiz's.
  static String _message(Object e, String fallback) =>
      e is BdFormsException && e.status != 0 && e.message.isNotEmpty
          ? e.message
          : fallback;
}
