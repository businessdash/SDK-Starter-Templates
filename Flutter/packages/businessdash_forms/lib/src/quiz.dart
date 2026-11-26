import 'dart:async';

import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;

import 'style.dart';

/// Which BD quiz a [BdQuiz] takes.
sealed class BdQuizSource {
  const BdQuizSource();

  /// An invited quiz: the token from the invite link (`/quiz-invite/{token}`).
  /// Graded and recorded by BD.
  const factory BdQuizSource.invitation(String token) = BdQuizInvitationSource;

  /// A practice quiz the org lets apps run: graded by BD, never recorded,
  /// and it can be retaken. [seed] pins one order; null shuffles anew each
  /// run. [questionLimit] asks only that many questions.
  const factory BdQuizSource.practice(String slug,
      {String? seed, int? questionLimit}) = BdQuizPracticeSource;
}

class BdQuizInvitationSource extends BdQuizSource {
  const BdQuizInvitationSource(this.token);

  final String token;

  @override
  bool operator ==(Object other) =>
      other is BdQuizInvitationSource && other.token == token;

  @override
  int get hashCode => token.hashCode;
}

class BdQuizPracticeSource extends BdQuizSource {
  const BdQuizPracticeSource(this.slug, {this.seed, this.questionLimit});

  final String slug;
  final String? seed;
  final int? questionLimit;

  @override
  bool operator ==(Object other) =>
      other is BdQuizPracticeSource &&
      other.slug == slug &&
      other.seed == seed &&
      other.questionLimit == questionLimit;

  @override
  int get hashCode => Object.hash(slug, seed, questionLimit);
}

/// The sign-in action's href when the host handles sign-in (it never leaves the app).
const _signInHref = 'bd-quiz:sign-in';

/// A BD quiz in native widgets (Material on Android, Cupertino on iOS): the
/// page header (name, time, attempts), the sign-in prompt when the invitation
/// needs the invited account, then the quiz itself: lettered choices, typed
/// answers, "I don't know", a countdown that submits on its own, each
/// answer's verdict and why (immediate feedback) or the results at the end.
///
/// ```dart
/// final quizzes = BdQuizzes.packageApi(publishableKey: 'pk_live_…', sessionToken: session?.sessionToken);
/// BdQuiz(source: BdQuizSource.invitation(token), quizzes: quizzes, onSignIn: showSignIn)
/// ```
///
/// Signing in gives a new [quizzes] (`withSession`), which reloads the
/// invitation as the signed-in customer. A new [source], [quizzes] or
/// [words] reloads too.
///
/// [BdQuiz.controller] draws a quiz you run yourself: a local quiz whose
/// fields carry answer keys, or one with your own [BdQuizBackend].
class BdQuiz extends StatefulWidget {
  const BdQuiz({
    super.key,
    required BdQuizSource this.source,
    required BdQuizzes this.quizzes,
    this.words = const BdQuizWords(),
    this.style = const BdFormStyle(),
    this.showsHeader = true,
    this.scrollable = true,
    this.onSignIn,
    this.onSwitchAccount,
    this.onDone,
  })  : controller = null,
        page = const BdQuizPage();

  /// ```dart
  /// late final quiz = BdQuizController(BdQuizOptions(fields: fields, feedbackMode: BdQuizFeedbackMode.immediate));
  /// BdQuiz.controller(quiz)
  /// ```
  ///
  /// The controller stays yours: dispose it when you're done with it. [page]
  /// adds a header (or a gate) above the quiz.
  const BdQuiz.controller(
    BdQuizController this.controller, {
    super.key,
    this.page = const BdQuizPage(),
    this.style = const BdFormStyle(),
    this.scrollable = true,
    this.onSignIn,
    this.onDone,
  })  : source = null,
        quizzes = null,
        words = const BdQuizWords(),
        showsHeader = true,
        onSwitchAccount = null;

  final BdQuizSource? source;
  final BdQuizzes? quizzes;
  final BdQuizController? controller;
  final BdQuizPage page;
  final BdQuizWords words;

  /// The form style: [BdFormStyle.controls], tint, error color, corner
  /// radius, spacing and padding apply.
  final BdFormStyle style;
  final bool showsHeader;

  /// Scrolls on its own. False: the quiz sizes to its content, for a parent
  /// that scrolls.
  final bool scrollable;

  /// Shows your sign-in screen. Without it the sign-in prompts have no button.
  final VoidCallback? onSignIn;

  /// Signs the customer out so the invited one can sign in (the invitation
  /// is for someone else's account).
  final VoidCallback? onSwitchAccount;

  /// Called once, when the quiz ends.
  final void Function(BdQuizCompletion completion)? onDone;

  @override
  State<BdQuiz> createState() => _BdQuizState();
}

enum _Load { loading, failed, ready }

class _BdQuizState extends State<BdQuiz> {
  var _load = _Load.loading;
  String? _failure;
  BdQuizPage _page = const BdQuizPage();
  BdQuizController? _owned;
  BdQuizController? _attached;
  var _loadRun = 0;

  final _scroll = ScrollController();
  final Map<String, TextEditingController> _texts = {};
  BdQuizConfig? _textsFor;
  String? _place;

  BdQuizController? get _controller => widget.controller ?? _owned;

  @override
  void initState() {
    super.initState();
    if (widget.controller case final controller?) {
      _load = _Load.ready;
      _attach(controller);
    } else {
      unawaited(_reload());
    }
  }

  @override
  void didUpdateWidget(BdQuiz old) {
    super.didUpdateWidget(old);
    if (widget.controller != null) {
      if (!identical(widget.controller, _attached)) {
        _detach();
        _owned?.dispose();
        _owned = null;
        _load = _Load.ready;
        _attach(widget.controller!);
      }
    } else if (old.controller != null ||
        old.source != widget.source ||
        old.quizzes != widget.quizzes ||
        !identical(old.words, widget.words) ||
        (old.onSignIn == null) != (widget.onSignIn == null)) {
      unawaited(_reload());
    }
  }

  @override
  void dispose() {
    _loadRun++;
    _detach();
    _owned?.dispose();
    _scroll.dispose();
    for (final text in _texts.values) {
      text.dispose();
    }
    super.dispose();
  }

  Future<void> _reload() async {
    final run = ++_loadRun;
    _detach();
    _owned?.dispose();
    _owned = null;
    if (mounted) setState(() => _load = _Load.loading);
    try {
      final (page, controller) = await _fetch();
      if (!mounted || run != _loadRun) {
        controller?.dispose();
        return;
      }
      setState(() {
        _page = page;
        _owned = controller;
        _load = _Load.ready;
      });
      if (controller != null) _attach(controller);
    } catch (e) {
      if (!mounted || run != _loadRun) return;
      setState(() {
        _load = _Load.failed;
        // BD's own words; a transport failure gets the quiz's.
        _failure =
            e is BdFormsException && e.status != 0 && e.message.isNotEmpty
                ? e.message
                : null;
      });
    }
  }

  Future<(BdQuizPage, BdQuizController?)> _fetch() async {
    final quizzes = widget.quizzes!;
    final words = widget.words;
    switch (widget.source!) {
      case BdQuizInvitationSource(:final token):
        BdQuizInvitation? invitation;
        try {
          invitation = await quizzes.invitation(token);
        } on BdFormsException catch (e) {
          if (e.status != 404) rethrow;
        }
        final page = BdQuizPage.invitation(invitation, words: words);
        if (invitation == null || page.gate != null) return (page, null);
        final options = invitation.options(
            signInHref: widget.onSignIn != null ? _signInHref : null,
            words: words);
        return (
          page,
          BdQuizController(options,
              backend: quizzes.invitationBackend(token),
              initial: invitation.initial()),
        );
      case BdQuizPracticeSource(:final slug, :final seed, :final questionLimit):
        final practice = await quizzes.practice(slug);
        final options = practice.options(
            seed: seed, questionLimit: questionLimit, words: words);
        return (
          BdQuizPage.practice(practice, words: words),
          BdQuizController(options, backend: quizzes.practiceBackend(slug))
        );
    }
  }

  void _attach(BdQuizController controller) {
    _attached = controller;
    controller.addListener(_changed);
    // Owned controllers always report here; the app's own only when asked.
    if (!identical(controller, widget.controller) || widget.onDone != null) {
      controller.onDone = (completion) => widget.onDone?.call(completion);
    }
    _place = _placeOf(controller);
  }

  void _detach() {
    final controller = _attached;
    if (controller == null) return;
    controller.removeListener(_changed);
    if (!identical(controller, widget.controller) || widget.onDone != null) {
      controller.onDone = null;
    }
    _attached = null;
  }

  /// Where the taker is: a new question or the results scroll back to the top.
  /// (Not the "3 of 5 answered" line, which changes with every answer.)
  static String _placeOf(BdQuizController controller) {
    final phase = controller.screen.phase;
    return phase == BdQuizPhase.all
        ? 'all'
        : '${controller.state.index}|${phase == BdQuizPhase.done}';
  }

  void _changed() {
    final controller = _attached;
    if (controller == null || !mounted) return;
    final place = _placeOf(controller);
    if (place != _place) {
      _place = place;
      if (widget.scrollable) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _scroll.hasClients) {
            unawaited(_scroll.animateTo(0,
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut));
          }
        });
      }
    }
    setState(() {});
  }

  /// A typed answer's text box. The box keeps the text, so the caret never
  /// jumps; the controller gets every change. A retake starts them over.
  TextEditingController _text(
      BdQuizController controller, BdQuizQuestion question) {
    if (!identical(_textsFor, controller.config)) {
      for (final text in _texts.values) {
        text.dispose();
      }
      _texts.clear();
      _textsFor = controller.config;
    }
    return _texts.putIfAbsent(question.field.id, () {
      final initial = switch (question.value) {
        BdStr(:final value) => value,
        BdNum(:final value) => BdJS.string(BdNum(value)),
        _ => '',
      };
      return TextEditingController(text: initial);
    });
  }

  bool get _cupertino => switch (widget.style.controls) {
        BdControlStyle.material => false,
        BdControlStyle.cupertino => true,
        BdControlStyle.adaptive =>
          defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS,
      };

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    final tint = widget.style.tint;
    final theme = tint == null
        ? base
        : base.copyWith(
            colorScheme: base.colorScheme.copyWith(
              primary: tint,
              onPrimary:
                  ThemeData.estimateBrightnessForColor(tint) == Brightness.dark
                      ? Colors.white
                      : Colors.black,
            ),
            cupertinoOverrideTheme: CupertinoThemeData(
                primaryColor: tint, brightness: base.brightness),
          );
    return Theme(
      data: theme,
      child: Builder(builder: (context) {
        final look = _Look(context, widget.style, _cupertino);
        return switch (_load) {
          _Load.loading => _centered(look, [
              look.spinner(),
              Text(widget.words.loading, style: TextStyle(color: look.muted))
            ]),
          _Load.failed => _centered(look, [
              Icon(
                  look.icon(Icons.warning_amber_rounded,
                      CupertinoIcons.exclamationmark_triangle_fill),
                  color: look.error,
                  size: 40),
              Text(widget.words.loadFailed,
                  style: look.text.titleMedium, textAlign: TextAlign.center),
              if (_failure case final message?)
                Text(message,
                    style: TextStyle(color: look.muted),
                    textAlign: TextAlign.center),
              look.button(widget.words.tryAgain, () => unawaited(_reload()),
                  primary: false),
            ]),
          _Load.ready => _pageView(look),
        };
      }),
    );
  }

  Widget _centered(_Look look, List<Widget> children) {
    final column = Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final child in children)
            Padding(
                padding: const EdgeInsets.symmetric(vertical: 6), child: child)
        ],
      ),
    );
    return widget.scrollable
        ? Center(child: SingleChildScrollView(child: column))
        : column;
  }

  Widget _pageView(_Look look) {
    final page = widget.controller == null && !widget.showsHeader
        ? _page.withoutHeader()
        : (widget.controller != null ? widget.page : _page);
    final controller = _controller;
    final gate = page.gate;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: _spaced(widget.style.spacing, [
        if (page.header case final header?) _header(look, header),
        if (gate != null)
          _gate(look, gate)
        else if (controller != null)
          _body(look, controller),
      ]),
    );
    final framed = Center(
      child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640), child: content),
    );
    if (!widget.scrollable) {
      return Padding(padding: widget.style.padding, child: framed);
    }
    return SingleChildScrollView(
      controller: _scroll,
      padding: widget.style.padding,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: framed,
    );
  }

  // ── The page ──

  Widget _header(_Look look, BdQuizPageHeader header) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            header.eyebrow.toUpperCase(),
            style: look.text.labelMedium?.copyWith(
                color: look.primary,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8),
          ),
          const SizedBox(height: 6),
          Semantics(
              header: true,
              child: Text(header.title, style: look.text.headlineSmall)),
          if (header.description case final description?) ...[
            const SizedBox(height: 6),
            Text(description,
                style: look.text.bodyMedium?.copyWith(color: look.muted)),
          ],
          if (header.facts.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final fact in header.facts)
                  DecoratedBox(
                    decoration: ShapeDecoration(
                        shape: const StadiumBorder(), color: look.fill),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      child: Text(fact, style: look.text.labelMedium),
                    ),
                  ),
              ],
            ),
          ],
        ],
      );

  Widget _gate(_Look look, BdQuizGate gate) {
    final account = gate.kind == BdQuizGateKind.signIn ||
        gate.kind == BdQuizGateKind.switchAccount;
    final run = switch (gate.action?.id) {
      BdQuizGateKind.signIn => widget.onSignIn,
      BdQuizGateKind.switchAccount => widget.onSwitchAccount,
      _ => null,
    };
    return look.card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _spaced(10, [
          Icon(
            account
                ? look.icon(Icons.lock_outline, CupertinoIcons.lock_fill)
                : look.icon(Icons.info_outline, CupertinoIcons.info),
            color: account ? look.primary : look.muted,
          ),
          if (gate.title case final title?)
            Text(title, style: look.text.titleMedium),
          Text(gate.body,
              style: look.text.bodyMedium?.copyWith(color: look.muted)),
          if (gate.action case final action? when run != null)
            look.button(action.label, run),
        ]),
      ),
    );
  }

  // ── The quiz ──

  Widget _body(_Look look, BdQuizController controller) {
    final screen = controller.screen;
    BdQuizActionId? primary;
    for (final action in screen.actions) {
      if (action.primary && action.enabled) {
        primary = action.id;
        break;
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: _spaced(16, [
        ...switch (screen.phase) {
          BdQuizPhase.empty => [
              Text(screen.empty ?? '', style: TextStyle(color: look.muted))
            ],
          BdQuizPhase.ready => [
              if (screen.ready case final ready?) _ready(look, ready)
            ],
          BdQuizPhase.done => [
              if (screen.done case final done?) _done(look, done)
            ],
          BdQuizPhase.question || BdQuizPhase.all || BdQuizPhase.feedback => [
              if (screen.timer case final timer?) _timer(look, timer),
              if (screen.progress case final progress?)
                _progress(look, progress),
              if (screen.notice case final notice?)
                Text(notice,
                    style: look.text.bodySmall?.copyWith(color: look.muted)),
              for (final question in screen.questions)
                _question(look, controller, question,
                    numbered: screen.phase == BdQuizPhase.all,
                    primary: primary),
              if (screen.feedback case final feedback?)
                _BdQuizFeedbackCard(look: look, feedback: feedback),
            ],
        },
        if (screen.error case final message?)
          Row(
            children: [
              Icon(
                  look.icon(Icons.warning_amber_rounded,
                      CupertinoIcons.exclamationmark_triangle_fill),
                  color: look.error,
                  size: 18),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(message,
                      style:
                          look.text.bodyMedium?.copyWith(color: look.error))),
            ],
          ),
        if (screen.actions.isNotEmpty) _actions(look, controller, screen),
      ]),
    );
  }

  Widget _ready(_Look look, BdQuizReady ready) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: _spaced(12, [
            look.disc(
              Icon(
                ready.icon == 'hourglass'
                    ? look.icon(Icons.hourglass_empty, CupertinoIcons.hourglass)
                    : look.icon(Icons.schedule, CupertinoIcons.clock),
                color: look.primary,
                size: 32,
              ),
              size: 64,
            ),
            Text(ready.title,
                style: look.text.titleLarge, textAlign: TextAlign.center),
            Text(ready.body,
                style: look.text.bodyMedium?.copyWith(color: look.muted),
                textAlign: TextAlign.center),
          ]),
        ),
      );

  Widget _timer(_Look look, BdQuizTimer timer) {
    final warn = timer.warning;
    final foreground = warn ? look.onErrorContainer : look.onSurface;
    return Semantics(
      liveRegion: warn,
      label: '${timer.label} ${timer.value}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          // iOS fills are translucent already; Material's surface needs thinning.
          color: warn
              ? look.errorContainer
              : (look.cupertino ? look.fill : look.fill.withValues(alpha: 0.6)),
          borderRadius: BorderRadius.circular(widget.style.cornerRadius),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Column(
            children: [
              Row(
                children: [
                  Icon(
                    timer.countdown
                        ? look.icon(
                            Icons.hourglass_empty, CupertinoIcons.hourglass)
                        : look.icon(Icons.schedule, CupertinoIcons.clock),
                    size: 18,
                    color: foreground,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(timer.label,
                          style: look.text.labelLarge
                              ?.copyWith(color: foreground))),
                  if (timer.paused) ...[
                    Text(timer.pausedLabel,
                        style:
                            look.text.labelMedium?.copyWith(color: look.muted)),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    timer.value,
                    style: look.text.titleMedium?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              if (timer.progress case final percent?) ...[
                const SizedBox(height: 8),
                look.bar(percent, warn ? look.error : look.primary),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _progress(_Look look, BdQuizProgress progress) => Column(
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(progress.position, style: look.text.labelLarge)),
              if (progress.note case final note?)
                Text(note,
                    style: look.text.labelMedium?.copyWith(color: look.muted)),
            ],
          ),
          const SizedBox(height: 6),
          look.bar(progress.percent, look.primary),
        ],
      );

  Widget _question(
    _Look look,
    BdQuizController controller,
    BdQuizQuestion question, {
    required bool numbered,
    required BdQuizActionId? primary,
  }) {
    final id = question.field.id;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: _spaced(10, [
        Semantics(
          header: true,
          child: Text(
              numbered
                  ? '${question.number}. ${question.label}'
                  : question.label,
              style: look.text.titleMedium),
        ),
        if (question.choices case final choices?)
          for (final choice in choices)
            _BdQuizChoiceRow(
              look: look,
              letter: choice.letter,
              label: choice.label,
              selected: choice.selected,
              state: choice.state,
              multiple: question.multiple,
              locked: question.locked,
              onTap: () => controller.choose(id, choice.label),
            )
        else
          _answerInput(look, controller, question, primary),
        if (question.dontKnow case final dontKnow?)
          _BdQuizChoiceRow(
            look: look,
            letter: '?',
            label: dontKnow.label,
            selected: dontKnow.selected,
            state: dontKnow.state,
            multiple: false,
            locked: question.locked,
            onTap: () => controller.chooseDontKnow(id),
          ),
        if (question.error case final error?)
          Text(error, style: look.text.bodySmall?.copyWith(color: look.error)),
      ]),
    );
  }

  /// A typed answer: open questions, numbers, yes/no, a dropdown.
  Widget _answerInput(_Look look, BdQuizController controller,
      BdQuizQuestion question, BdQuizActionId? primary) {
    final field = question.field;
    final id = field.id;
    final enabled = !question.locked;
    final words = controller.config.words;
    void submit() {
      if (primary != null) unawaited(controller.perform(primary));
    }

    switch (field.type) {
      case 'boolean':
        final value = question.value?.boolValue;
        if (look.cupertino) {
          return IgnorePointer(
            ignoring: !enabled,
            child: Opacity(
              opacity: enabled ? 1 : 0.6,
              child: CupertinoSlidingSegmentedControl<bool>(
                groupValue: value,
                children: {
                  true: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(words.yes)),
                  false: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(words.no)),
                },
                onValueChanged: (picked) {
                  if (picked != null) controller.setAnswer(id, BdBool(picked));
                },
              ),
            ),
          );
        }
        return SegmentedButton<bool>(
          segments: [
            ButtonSegment(value: true, label: Text(words.yes)),
            ButtonSegment(value: false, label: Text(words.no)),
          ],
          selected: {if (value != null) value},
          emptySelectionAllowed: true,
          showSelectedIcon: false,
          onSelectionChanged: enabled
              ? (picked) {
                  if (picked.isNotEmpty) {
                    controller.setAnswer(id, BdBool(picked.first));
                  }
                }
              : null,
        );
      case 'select':
        final options = field.options ?? const <String>[];
        final current = question.value?.stringValue ?? '';
        return look.cupertino
            ? _cupertinoSelect(look, controller, question, options, current)
            : InputDecorator(
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                      borderRadius:
                          BorderRadius.circular(widget.style.cornerRadius)),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  enabled: enabled,
                  errorText: question.error == null ? null : '',
                  errorStyle: const TextStyle(height: 0, fontSize: 0),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: options.contains(current) ? current : null,
                    hint: Text(field.placeholder ?? '—'),
                    items: [
                      for (final option in options)
                        DropdownMenuItem(value: option, child: Text(option))
                    ],
                    onChanged: enabled
                        ? (picked) =>
                            controller.setAnswer(id, BdStr(picked ?? ''))
                        : null,
                  ),
                ),
              );
      case 'textarea' || 'richtext':
        return look.textBox(
          controller: _text(controller, question),
          enabled: enabled,
          error: question.error != null,
          placeholder: field.placeholder,
          minLines: 4,
          maxLines: 12,
          onChanged: (text) => controller.setAnswer(id, BdStr(text)),
        );
      case 'number' || 'currency' || 'slider':
        return look.textBox(
          controller: _text(controller, question),
          enabled: enabled,
          error: question.error != null,
          placeholder: field.placeholder,
          keyboard: const TextInputType.numberWithOptions(
              decimal: true, signed: true),
          onSubmitted: submit,
          onChanged: (raw) {
            final trimmed = raw.trim();
            final n = double.tryParse(trimmed);
            controller.setAnswer(
              id,
              trimmed.isEmpty
                  ? const BdStr('')
                  : n != null && n.isFinite
                      ? BdNum(n)
                      : BdStr(raw),
            );
          },
        );
      default:
        return look.textBox(
          controller: _text(controller, question),
          enabled: enabled,
          error: question.error != null,
          placeholder: field.placeholder,
          onSubmitted: submit,
          onChanged: (text) => controller.setAnswer(id, BdStr(text)),
        );
    }
  }

  Widget _cupertinoSelect(
    _Look look,
    BdQuizController controller,
    BdQuizQuestion question,
    List<String> options,
    String current,
  ) {
    final enabled = !question.locked;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: !enabled
          ? null
          : () => showCupertinoModalPopup<void>(
                context: context,
                builder: (sheet) => CupertinoActionSheet(
                  title: Text(question.label),
                  actions: [
                    for (final option in options)
                      CupertinoActionSheetAction(
                        isDefaultAction: option == current,
                        onPressed: () {
                          controller.setAnswer(
                              question.field.id, BdStr(option));
                          Navigator.of(sheet).pop();
                        },
                        child: Text(option),
                      ),
                  ],
                  cancelButton: CupertinoActionSheetAction(
                    onPressed: () => Navigator.of(sheet).pop(),
                    child: Text(
                        MaterialLocalizations.of(context).cancelButtonLabel),
                  ),
                ),
              ),
      child: Opacity(
        opacity: enabled ? 1 : 0.6,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: look.fill,
            borderRadius: BorderRadius.circular(widget.style.cornerRadius),
            border:
                question.error == null ? null : Border.all(color: look.error),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    current.isEmpty
                        ? (question.field.placeholder ?? '—')
                        : current,
                    style: TextStyle(
                        color: current.isEmpty ? look.muted : look.onSurface),
                  ),
                ),
                Icon(CupertinoIcons.chevron_up_chevron_down,
                    size: 16, color: look.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _done(_Look look, BdQuizDone done) => switch (done) {
        BdQuizResults() => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                children: _spaced(6, [
                  Text(done.eyebrow.toUpperCase(),
                      style: look.text.labelMedium
                          ?.copyWith(color: look.primary, letterSpacing: 0.8)),
                  Text(done.score,
                      style: look.text.displayMedium?.copyWith(
                          fontWeight: FontWeight.bold, color: look.onSurface)),
                  if (done.tally case final tally?)
                    Text(tally,
                        style:
                            look.text.titleSmall?.copyWith(color: look.muted)),
                  Text(
                    done.summary,
                    textAlign: TextAlign.center,
                    style: look.text.titleMedium?.copyWith(
                      color: switch (done.passed) {
                        true => look.tone(BdQuizTone.correct),
                        false => look.error,
                        null => look.onSurface,
                      },
                    ),
                  ),
                  if (done.message case final message?)
                    Text(message,
                        style: look.text.bodyMedium,
                        textAlign: TextAlign.center),
                  if (done.timing case final timing?)
                    Text(timing,
                        style:
                            look.text.bodySmall?.copyWith(color: look.muted)),
                ]),
              ),
              const SizedBox(height: 16),
              for (final item in done.items)
                _BdQuizResultRow(
                    key: ValueKey('${item.number}|${item.label}'),
                    look: look,
                    item: item),
            ],
          ),
        BdQuizSubmitted() => _endCard(
            look,
            look.icon(Icons.check_circle, CupertinoIcons.checkmark_circle_fill),
            done.eyebrow,
            done.title,
            done.body),
        BdQuizResultsLocked() => _endCard(
            look,
            look.icon(Icons.lock, CupertinoIcons.lock_fill),
            done.eyebrow,
            done.title,
            done.body),
      };

  Widget _endCard(_Look look, IconData icon, String eyebrow, String title,
          String body) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: _spaced(10, [
            look.disc(Icon(icon, color: look.primary, size: 40), size: 72),
            Text(eyebrow.toUpperCase(),
                style: look.text.labelMedium
                    ?.copyWith(color: look.primary, letterSpacing: 0.8)),
            Text(title,
                style: look.text.headlineSmall, textAlign: TextAlign.center),
            Text(body,
                style: look.text.bodyMedium?.copyWith(color: look.muted),
                textAlign: TextAlign.center),
          ]),
        ),
      );

  Widget _actions(
          _Look look, BdQuizController controller, BdQuizScreen screen) =>
      Row(
        children: _spaced(
          12,
          [
            for (final action in screen.actions)
              () {
                final run = !action.enabled
                    ? null
                    : action.id == BdQuizActionId.signIn
                        ? widget.onSignIn
                        : () => unawaited(controller.perform(action.id));
                final button = look.button(
                  action.label,
                  run,
                  primary: action.primary,
                  busy: action.primary && screen.busy && !action.enabled,
                );
                return action.primary ? Expanded(child: button) : button;
              }(),
          ],
          horizontal: true,
        ),
      );
}

List<Widget> _spaced(double gap, List<Widget> children,
        {bool horizontal = false}) =>
    [
      for (var i = 0; i < children.length; i++) ...[
        if (i > 0)
          SizedBox(
              width: horizontal ? gap : null, height: horizontal ? null : gap),
        children[i],
      ],
    ];

/// Colors, text and controls, Material or Cupertino.
class _Look {
  _Look(this.context, this.style, this.cupertino)
      : scheme = Theme.of(context).colorScheme,
        text = Theme.of(context).textTheme;

  final BuildContext context;
  final BdFormStyle style;
  final bool cupertino;
  final ColorScheme scheme;
  final TextTheme text;

  bool get dark => Theme.of(context).brightness == Brightness.dark;
  Color get primary => scheme.primary;
  Color get onSurface => scheme.onSurface;
  Color get error =>
      style.errorColor ??
      (cupertino
          ? CupertinoColors.systemRed.resolveFrom(context)
          : scheme.error);
  Color get errorContainer =>
      cupertino ? error.withValues(alpha: 0.14) : scheme.errorContainer;
  Color get onErrorContainer => cupertino ? error : scheme.onErrorContainer;
  Color get muted => cupertino
      ? CupertinoColors.secondaryLabel.resolveFrom(context)
      : scheme.onSurfaceVariant;
  Color get outline => cupertino
      ? CupertinoColors.separator.resolveFrom(context)
      : scheme.outlineVariant;
  Color get fill => cupertino
      ? CupertinoColors.tertiarySystemFill.resolveFrom(context)
      : scheme.surfaceContainerHighest;
  Color get surface => cupertino
      ? CupertinoColors.secondarySystemGroupedBackground.resolveFrom(context)
      : scheme.surfaceContainerLow;

  IconData icon(IconData material, IconData cupertinoIcon) =>
      cupertino ? cupertinoIcon : material;

  Color tone(BdQuizTone tone) => switch (tone) {
        BdQuizTone.correct => cupertino
            ? CupertinoColors.systemGreen.resolveFrom(context)
            : (dark ? const Color(0xFF81C995) : const Color(0xFF1E8E3E)),
        BdQuizTone.partial => cupertino
            ? CupertinoColors.systemOrange.resolveFrom(context)
            : (dark ? const Color(0xFFFDD663) : const Color(0xFFB06000)),
        BdQuizTone.incorrect => error,
        BdQuizTone.pending => cupertino
            ? CupertinoColors.systemIndigo.resolveFrom(context)
            : scheme.tertiary,
        BdQuizTone.unscored || BdQuizTone.unsure => muted,
      };

  static Color on(Color color) =>
      ThemeData.estimateBrightnessForColor(color) == Brightness.dark
          ? Colors.white
          : Colors.black;

  Widget spinner({double size = 28, Color? color}) => cupertino
      ? CupertinoActivityIndicator(radius: size / 2.4, color: color)
      : SizedBox.square(
          dimension: size,
          child: CircularProgressIndicator(
              strokeWidth: size < 20 ? 2 : 3, color: color));

  Widget bar(double percent, Color color) {
    final value = (percent / 100).clamp(0.0, 1.0);
    if (!cupertino) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: LinearProgressIndicator(
            value: value, color: color, backgroundColor: fill, minHeight: 4),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: SizedBox(
        height: 4,
        width: double.infinity,
        child: Stack(
          children: [
            Positioned.fill(child: ColoredBox(color: fill)),
            FractionallySizedBox(
              alignment: AlignmentDirectional.centerStart,
              widthFactor: value,
              heightFactor: 1,
              child: ColoredBox(color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget disc(Widget child, {required double size}) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            shape: BoxShape.circle, color: primary.withValues(alpha: 0.14)),
        child: child,
      );

  Widget card(Widget child) => DecoratedBox(
        decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(style.cornerRadius)),
        child: Padding(padding: const EdgeInsets.all(20), child: child),
      );

  Widget button(String label, VoidCallback? onPressed,
      {bool primary = true, bool busy = false}) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy) ...[
          spinner(size: 16, color: cupertino ? null : muted),
          const SizedBox(width: 8)
        ],
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
    if (cupertino) {
      return primary
          ? CupertinoButton.filled(
              onPressed: onPressed,
              borderRadius: BorderRadius.circular(style.cornerRadius),
              child: content)
          : CupertinoButton(onPressed: onPressed, child: content);
    }
    final shape = RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(style.cornerRadius));
    final padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 14);
    return primary
        ? FilledButton(
            onPressed: onPressed,
            style: FilledButton.styleFrom(shape: shape, padding: padding),
            child: content)
        : OutlinedButton(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(shape: shape, padding: padding),
            child: content);
  }

  Widget textBox({
    required TextEditingController controller,
    required bool enabled,
    required bool error,
    required ValueChanged<String> onChanged,
    String? placeholder,
    int minLines = 1,
    int maxLines = 1,
    TextInputType? keyboard,
    VoidCallback? onSubmitted,
  }) {
    final multiline = maxLines > 1;
    final action = multiline ? TextInputAction.newline : TextInputAction.done;
    final type =
        keyboard ?? (multiline ? TextInputType.multiline : TextInputType.text);
    if (cupertino) {
      // A locked answer: Cupertino's box has no disabled look of its own here.
      final box = CupertinoTextField(
        controller: controller,
        enabled: enabled,
        placeholder: placeholder,
        minLines: minLines,
        maxLines: maxLines,
        keyboardType: type,
        textInputAction: action,
        onChanged: onChanged,
        onSubmitted: onSubmitted == null ? null : (_) => onSubmitted(),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(style.cornerRadius),
          border: error ? Border.all(color: this.error) : null,
        ),
      );
      return enabled ? box : Opacity(opacity: 0.6, child: box);
    }
    final radius = BorderRadius.circular(style.cornerRadius);
    return TextField(
      controller: controller,
      enabled: enabled,
      minLines: minLines,
      maxLines: maxLines,
      keyboardType: type,
      textInputAction: action,
      onChanged: onChanged,
      onSubmitted: onSubmitted == null ? null : (_) => onSubmitted(),
      decoration: InputDecoration(
        hintText: placeholder,
        border: OutlineInputBorder(borderRadius: radius),
        enabledBorder: error
            ? OutlineInputBorder(
                borderRadius: radius, borderSide: BorderSide(color: this.error))
            : null,
        focusedBorder: error
            ? OutlineInputBorder(
                borderRadius: radius,
                borderSide: BorderSide(color: this.error, width: 2))
            : null,
      ),
    );
  }
}

/// A lettered choice: picked, then right, wrong or dimmed once its verdict is in.
class _BdQuizChoiceRow extends StatelessWidget {
  const _BdQuizChoiceRow({
    required this.look,
    required this.letter,
    required this.label,
    required this.selected,
    required this.state,
    required this.multiple,
    required this.locked,
    required this.onTap,
  });

  final _Look look;
  final String letter;
  final String label;
  final bool selected;
  final BdQuizChoiceState state;
  final bool multiple;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = switch (state) {
      BdQuizChoiceState.correct => look.tone(BdQuizTone.correct),
      BdQuizChoiceState.incorrect => look.error,
      BdQuizChoiceState.selected => look.primary,
      BdQuizChoiceState.idle || BdQuizChoiceState.dimmed => look.outline,
    };
    final marked = state == BdQuizChoiceState.correct ||
        state == BdQuizChoiceState.incorrect ||
        state == BdQuizChoiceState.selected;
    final radius = BorderRadius.circular(look.style.cornerRadius);
    final row = Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                shape: BoxShape.circle, color: marked ? accent : look.fill),
            child: Text(
              letter,
              style: look.text.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: marked ? _Look.on(accent) : look.muted,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: look.text.bodyLarge)),
          if (state == BdQuizChoiceState.correct)
            Icon(look.icon(Icons.check, CupertinoIcons.checkmark),
                color: accent)
          else if (state == BdQuizChoiceState.incorrect)
            Icon(look.icon(Icons.close, CupertinoIcons.xmark), color: accent),
        ],
      ),
    );
    final decorated = Ink(
      decoration: BoxDecoration(
        borderRadius: radius,
        border: Border.all(color: accent, width: marked ? 2 : 1),
        color: marked ? accent.withValues(alpha: 0.08) : null,
      ),
      child: look.cupertino
          ? GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: locked ? null : onTap,
              child: row)
          : InkWell(
              borderRadius: radius, onTap: locked ? null : onTap, child: row),
    );
    return Semantics(
      checked: multiple ? selected : null,
      selected: multiple ? null : selected,
      inMutuallyExclusiveGroup: multiple ? null : true,
      enabled: !locked,
      child: Opacity(
        opacity: state == BdQuizChoiceState.dimmed ? 0.6 : 1,
        child: Material(type: MaterialType.transparency, child: decorated),
      ),
    );
  }
}

/// One verdict: the badge, the answer given, what's accepted, and why.
class _BdQuizFeedbackCard extends StatelessWidget {
  const _BdQuizFeedbackCard({required this.look, required this.feedback});

  final _Look look;
  final BdQuizFeedback feedback;

  Widget _labeled(String label, String text) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: look.text.labelMedium?.copyWith(color: look.muted)),
          const SizedBox(height: 2),
          Text(text, style: look.text.bodyMedium),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final color = look.tone(feedback.badge.tone);
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(look.style.cornerRadius),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: _spaced(10, [
              Row(
                children: [
                  DecoratedBox(
                    decoration: ShapeDecoration(
                        shape: const StadiumBorder(),
                        color: color.withValues(alpha: 0.14)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      child: Text(feedback.badge.label,
                          style: look.text.labelLarge?.copyWith(
                              color: color, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  if (feedback.accuracy case final accuracy?) ...[
                    const SizedBox(width: 10),
                    Text(accuracy,
                        style:
                            look.text.labelMedium?.copyWith(color: look.muted)),
                  ],
                ],
              ),
              _labeled(feedback.answerLabel, feedback.answer),
              if (feedback.accepted case final accepted?)
                _labeled(feedback.acceptedLabel, accepted),
              if (feedback.why case final why?)
                _labeled(feedback.whyLabel, why),
              for (final note in feedback.selected)
                _labeled(note.option, note.explanation),
              if (feedback.others case final others?) ...[
                Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(others.label, style: look.text.labelLarge)),
                for (final note in others.items)
                  _labeled(note.option, note.explanation),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// A question in the results: tap to see its verdict.
class _BdQuizResultRow extends StatefulWidget {
  const _BdQuizResultRow({super.key, required this.look, required this.item});

  final _Look look;
  final BdQuizResultItem item;

  @override
  State<_BdQuizResultRow> createState() => _BdQuizResultRowState();
}

class _BdQuizResultRowState extends State<_BdQuizResultRow> {
  var _open = false;

  @override
  Widget build(BuildContext context) {
    final look = widget.look;
    final item = widget.item;
    final color = look.tone(item.tone);
    final radius = BorderRadius.circular(look.style.cornerRadius);
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Row(
        children: [
          Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
          const SizedBox(width: 10),
          Expanded(
              child: Text('${item.number}. ${item.label}',
                  style: look.text.bodyLarge)),
          const SizedBox(width: 8),
          Text(item.feedback.badge.label,
              style: look.text.labelMedium?.copyWith(color: color)),
          const SizedBox(width: 4),
          Icon(
            _open
                ? look.icon(Icons.keyboard_arrow_up, CupertinoIcons.chevron_up)
                : look.icon(
                    Icons.keyboard_arrow_down, CupertinoIcons.chevron_down),
            size: 20,
            color: look.muted,
          ),
        ],
      ),
    );
    void toggle() => setState(() => _open = !_open);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          expanded: _open,
          child: look.cupertino
              ? GestureDetector(
                  behavior: HitTestBehavior.opaque, onTap: toggle, child: row)
              : Material(
                  type: MaterialType.transparency,
                  child:
                      InkWell(borderRadius: radius, onTap: toggle, child: row)),
        ),
        AnimatedSize(
          duration: look.style.animated
              ? const Duration(milliseconds: 200)
              : Duration.zero,
          alignment: Alignment.topCenter,
          child: _open
              ? Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child:
                      _BdQuizFeedbackCard(look: look, feedback: item.feedback))
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
