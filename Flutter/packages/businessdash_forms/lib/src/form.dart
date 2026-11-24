import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'icons.dart';
import 'primitives.dart';
import 'style.dart';
import 'tree.dart';

/// A BusinessDash form, drawn with native widgets: Material on Android,
/// Cupertino on iOS. Validation, conditions, steps, calculations, uploads
/// and submit all run through [BdFormController], the same rules as every
/// web binding.
///
/// ```dart
/// BdForm(form: 'contact', publishableKey: 'pk_live_…')
/// ```
class BdForm extends StatefulWidget {
  /// Fetches [form] from BusinessDash with a publishable key.
  const BdForm({
    super.key,
    required String this.form,
    required String this.publishableKey,
    this.host = bdDefaultHost,
    this.submitOptions = const BdSubmitOptions(),
    this.style = const BdFormStyle(),
    this.strings = const BdFormStrings(),
    this.renderers = const BdFieldRenderers(),
    this.pickFiles,
    this.collectPayment,
    this.openLink,
    this.timeZone,
    this.scrollable = true,
    this.onSubmitted,
    this.onSubmitError,
    this.successBuilder,
  })  : backend = null,
        controller = null,
        schema = null;

  /// Fetches and submits [form] through your own backend.
  const BdForm.backend({
    super.key,
    required String this.form,
    required BdFormsBackend this.backend,
    this.host = bdDefaultHost,
    this.submitOptions = const BdSubmitOptions(),
    this.style = const BdFormStyle(),
    this.strings = const BdFormStrings(),
    this.renderers = const BdFieldRenderers(),
    this.pickFiles,
    this.collectPayment,
    this.openLink,
    this.timeZone,
    this.scrollable = true,
    this.onSubmitted,
    this.onSubmitError,
    this.successBuilder,
  })  : publishableKey = null,
        controller = null,
        schema = null;

  /// A form you already have (prefetched, bundled, or built in code). Pass
  /// a backend to be able to submit it.
  const BdForm.schema({
    super.key,
    required BdFormSchema this.schema,
    this.backend,
    this.host = bdDefaultHost,
    this.submitOptions = const BdSubmitOptions(),
    this.style = const BdFormStyle(),
    this.strings = const BdFormStrings(),
    this.renderers = const BdFieldRenderers(),
    this.pickFiles,
    this.collectPayment,
    this.openLink,
    this.timeZone,
    this.scrollable = true,
    this.onSubmitted,
    this.onSubmitError,
    this.successBuilder,
  })  : form = null,
        publishableKey = null,
        controller = null;

  /// Draws a controller you own: read and write its answers from outside,
  /// keep it across screens. You dispose it.
  const BdForm.controller({
    super.key,
    required BdFormController this.controller,
    this.host = bdDefaultHost,
    this.style = const BdFormStyle(),
    this.strings = const BdFormStrings(),
    this.renderers = const BdFieldRenderers(),
    this.pickFiles,
    this.collectPayment,
    this.openLink,
    this.timeZone,
    this.scrollable = true,
    this.onSubmitted,
    this.onSubmitError,
    this.successBuilder,
  })  : form = null,
        publishableKey = null,
        backend = null,
        schema = null,
        submitOptions = const BdSubmitOptions();

  /// The form's slug (Forms → Share in BusinessDash).
  final String? form;

  /// A publishable `pk_…` key. Never a secret (`bd_…`) key: it ships in the app.
  final String? publishableKey;
  final BdFormsBackend? backend;
  final BdFormController? controller;
  final BdFormSchema? schema;

  /// BusinessDash's address, for the form and its icons.
  final String host;

  /// Provenance and recipient passthrough merged into the submission.
  final BdSubmitOptions submitOptions;
  final BdFormStyle style;
  final BdFormStrings strings;
  final BdFieldRenderers renderers;

  /// Opens the document or photo picker for file and image fields.
  final BdFilePicker? pickFiles;

  /// Collects a card for `credit_card` fields: present Stripe's sheet with
  /// the intent and return its id.
  final BdPaymentHandler? collectPayment;

  /// Opens links (choice cards' "View", links in rich text).
  final BdLinkOpener? openLink;

  /// The visitor's IANA time zone (`America/Chicago`), sent with a booked
  /// time so confirmations read in their zone. Dart can't read it on its
  /// own; `flutter_timezone` can. Without it, BusinessDash uses UTC.
  final String? timeZone;

  /// The form scrolls itself (default). Pass false inside your own
  /// scrolling view.
  final bool scrollable;
  final void Function(BdSubmitSuccess result)? onSubmitted;
  final void Function(BdSubmitFailure result)? onSubmitError;

  /// Replaces the thank-you screen. Call `reset` to start a new response.
  final Widget Function(BuildContext context, BdSubmitSuccess result, VoidCallback reset)? successBuilder;

  @override
  State<BdForm> createState() => _BdFormState();
}

class _BdFormState extends State<BdForm> {
  late BdFormController _controller;
  var _owns = false;
  final _scrollTargets = <String, GlobalKey>{};

  @override
  void initState() {
    super.initState();
    _attach();
  }

  BdFormController _make() {
    final w = widget;
    if (w.controller case final c?) return c;
    if (w.schema case final s?) return BdFormController.fromSchema(s, backend: w.backend, submitOptions: w.submitOptions);
    final backend = w.backend ?? BdPackageFormsBackend(publishableKey: w.publishableKey!, host: w.host);
    return BdFormController(w.form!, backend: backend, submitOptions: w.submitOptions);
  }

  void _attach() {
    _controller = _make();
    _owns = widget.controller == null;
    _controller.addListener(_changed);
    _controller.onSuccess = (r) => widget.onSubmitted?.call(r);
    _controller.onFailure = (r) => widget.onSubmitError?.call(r);
    _controller.paymentHandler = widget.collectPayment;
    _controller.messages = widget.strings.messages;
    if (_controller.phase is! BdPhaseReady) {
      // After this frame: loading publishes a new state.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _controller.load();
      });
    }
  }

  void _detach() {
    _controller.removeListener(_changed);
    if (_owns) _controller.dispose();
  }

  bool _sameSource(BdForm a, BdForm b) =>
      a.controller == b.controller &&
      a.form == b.form &&
      a.publishableKey == b.publishableKey &&
      a.host == b.host &&
      a.backend == b.backend &&
      a.schema == b.schema;

  @override
  void didUpdateWidget(BdForm old) {
    super.didUpdateWidget(old);
    if (!_sameSource(old, widget)) {
      _detach();
      _attach();
    } else {
      _controller.paymentHandler = widget.collectPayment;
      _controller.messages = widget.strings.messages;
      if (_owns) _controller.submitOptions = widget.submitOptions;
    }
  }

  @override
  void dispose() {
    _detach();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  bool _cupertino(BuildContext context) => switch (widget.style.controls) {
        BdControlStyle.material => false,
        BdControlStyle.cupertino => true,
        BdControlStyle.adaptive => switch (Theme.of(context).platform) {
            TargetPlatform.iOS || TargetPlatform.macOS => true,
            _ => false,
          },
      };

  ThemeData _tinted(ThemeData theme) {
    final tint = widget.style.tint;
    if (tint == null) return theme;
    final onTint = tint.computeLuminance() > 0.5 ? Colors.black : Colors.white;
    return theme.copyWith(
      colorScheme: theme.colorScheme.copyWith(primary: tint, onPrimary: onTint, surfaceTint: tint),
      cupertinoOverrideTheme: CupertinoThemeData(primaryColor: tint),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = _controller.state;
    final Widget body = switch (state.phase) {
      BdPhaseIdle() || BdPhaseLoading() => _Centered(scrollable: widget.scrollable, child: const _Loading()),
      BdPhaseFailed(:final message) => _Centered(
          scrollable: widget.scrollable,
          child: _Failed(message, onRetry: _controller.load),
        ),
      BdPhaseReady() => switch (state.result) {
          final BdSubmitSuccess success => widget.successBuilder?.call(context, success, _controller.reset) ??
              _Centered(scrollable: widget.scrollable, child: const _Success()),
          _ => _Body(scrollable: widget.scrollable),
        },
    };

    Widget tree = Theme(
      data: _tinted(Theme.of(context)),
      child: BdFormScope(
        controller: _controller,
        state: state,
        style: widget.style,
        strings: widget.strings,
        renderers: widget.renderers,
        cupertino: _cupertino(context),
        iconBaseUrl: widget.host.replaceFirst(RegExp(r'/+$'), ''),
        pickFiles: widget.pickFiles,
        openLink: widget.openLink,
        timeZone: widget.timeZone,
        scrollTargets: _scrollTargets,
        // Material widgets need a Material above them, which a Cupertino
        // app doesn't give.
        child: Material(type: MaterialType.transparency, child: body),
      ),
    );
    // Date formats and pickers read MaterialLocalizations, which a
    // Cupertino app doesn't provide.
    if (Localizations.of<MaterialLocalizations>(context, MaterialLocalizations) == null) {
      tree = Localizations.override(
        context: context,
        delegates: const [DefaultMaterialLocalizations.delegate],
        child: tree,
      );
    }
    return tree;
  }
}

/// A [Listenable] over a [BdFormController], for `ListenableBuilder` and
/// `AnimatedBuilder` when you draw your own form.
extension BdFormControllerListenable on BdFormController {
  Listenable get listenable => _ControllerListenable(this);
}

class _ControllerListenable implements Listenable {
  const _ControllerListenable(this.controller);

  final BdFormController controller;

  @override
  void addListener(VoidCallback listener) => controller.addListener(listener);

  @override
  void removeListener(VoidCallback listener) => controller.removeListener(listener);

  @override
  bool operator ==(Object other) => other is _ControllerListenable && other.controller == controller;

  @override
  int get hashCode => controller.hashCode;
}

// ── Phases ───────────────────────────────────────────────────────────────

class _Centered extends StatelessWidget {
  const _Centered({required this.scrollable, required this.child});

  final bool scrollable;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: const EdgeInsets.all(32), child: child);
    if (!scrollable) return content;
    return Center(child: SingleChildScrollView(child: content));
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 12,
      children: [
        const BdSpinner(size: 32),
        Text(scope.strings.loading, style: TextStyle(color: BdColors.of(context).muted)),
      ],
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed(this.message, {required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 12,
      children: [
        Icon(scope.cupertino ? CupertinoIcons.exclamationmark_triangle_fill : Icons.warning_rounded, color: colors.error, size: 40),
        Text(scope.strings.loadFailed, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        Text(message, textAlign: TextAlign.center, style: TextStyle(color: colors.muted)),
        BdButton(label: scope.strings.retry, onPressed: onRetry),
      ],
    );
  }
}

/// The thank-you screen.
class _Success extends StatelessWidget {
  const _Success();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 12,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.primaryContainer),
          child: Icon(
            scope.cupertino ? CupertinoIcons.check_mark_circled_solid : Icons.check_circle,
            size: 44,
            color: colors.primary,
          ),
        ),
        Semantics(
          header: true,
          child: Text(scope.strings.successTitle, textAlign: TextAlign.center, style: theme.textTheme.headlineSmall),
        ),
        Text(scope.strings.successMessage, textAlign: TextAlign.center, style: TextStyle(color: colors.muted)),
        BdButton(label: scope.strings.submitAnother, onPressed: scope.controller.reset),
      ],
    );
  }
}

// ── Body ─────────────────────────────────────────────────────────────────

class _Body extends StatefulWidget {
  const _Body({required this.scrollable});

  final bool scrollable;

  @override
  State<_Body> createState() => _BodyState();
}

class _BodyState extends State<_Body> {
  final _scroll = ScrollController();
  final _top = GlobalKey();
  int? _shownStep;
  var _errorToken = 0;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// The first field with an error, in the order the visitor sees them.
  String? _firstErrorKey(BdFormController c) {
    final order = <String>[];
    void walk(List<BdFormField> nodes, String prefix) {
      for (final n in nodes) {
        order.add(prefix + n.id);
        if (n.type == 'multi_populator') {
          final count = c.value(n.id)?.arrayValue?.length ?? 1;
          for (var i = 0; i < (count < 1 ? 1 : count); i++) {
            walk(n.children ?? const [], '$prefix${n.id}[$i].');
          }
        } else {
          walk(n.children ?? const [], prefix);
        }
      }
    }

    walk(c.visibleFields, '');
    final errors = c.errors;
    for (final key in order) {
      if (errors[key] != null) return key;
    }
    return null;
  }

  void _reveal(GlobalKey key) {
    final target = key.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      alignment: 0.1,
    );
  }

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final state = scope.state;
    final style = scope.style;

    // An attempt that surfaced errors: bring the first one into view.
    if (state.errorScrollToken != _errorToken) {
      _errorToken = state.errorScrollToken;
      if (_errorToken != 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final key = _firstErrorKey(c);
          final target = key == null ? null : scope.scrollTargets[key];
          if (target != null) _reveal(target);
        });
      }
    }
    // A new step starts at its top.
    final step = c.currentStep;
    if (_shownStep != null && _shownStep != step) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (widget.scrollable && _scroll.hasClients) {
          _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        } else {
          _reveal(_top);
        }
      });
    }
    _shownStep = step;

    final content = Padding(
      key: _top,
      padding: style.padding,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: style.spacing,
          children: const [_Header(), _Steps(), _Footer()],
        ),
      ),
    );

    final guarded = _ExitGuard(child: content);
    if (!widget.scrollable) return guarded;
    return SingleChildScrollView(
      controller: _scroll,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: guarded,
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final style = scope.style;
    final theme = Theme.of(context);
    final title = style.showsTitle ? c.schema?.title.nonEmpty : null;
    final description = style.showsDescription ? c.schema?.description.nonEmpty : null;
    final showProgress = style.showsProgress && c.isConsecutive && c.settings.showProgress != false && c.stepCount > 1;
    if (title == null && description == null && !showProgress) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        if (title != null) Semantics(header: true, child: Text(title, style: theme.textTheme.headlineSmall)),
        if (description != null)
          Text(description, style: theme.textTheme.bodyLarge?.copyWith(color: BdColors.of(context).muted)),
        if (showProgress) const _Progress(),
      ],
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final colors = BdColors.of(context);
    final current = c.currentStep;
    final count = c.stepCount;
    final caption = '${scope.strings.format(scope.strings.stepOf, [current + 1, count])} · ${c.stepTitle(current)}';
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 6,
        children: [
          if (c.settings.progressStyle == 'steps')
            Row(
              spacing: 6,
              children: [
                for (var i = 0; i < count; i++)
                  Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      height: 4,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: i <= current ? colors.primary : colors.fill,
                      ),
                    ),
                  ),
              ],
            )
          else
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: c.progress),
                duration: const Duration(milliseconds: 250),
                builder: (context, v, _) => LinearProgressIndicator(
                  value: v,
                  minHeight: 4,
                  color: colors.primary,
                  backgroundColor: colors.fill,
                ),
              ),
            ),
          Text(caption, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: colors.muted)),
        ],
      ),
    );
  }
}

class _Steps extends StatelessWidget {
  const _Steps();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    if (!scope.style.animated || !c.isConsecutive) return BdFieldTree(c.visibleFields, const []);
    final forward = scope.state.movingForward;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        final incoming = child.key == ValueKey(c.currentStep);
        final dx = (incoming == forward) ? 0.2 : -0.2;
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(begin: Offset(dx, 0), end: Offset.zero).animate(animation),
            child: child,
          ),
        );
      },
      child: KeyedSubtree(key: ValueKey(c.currentStep), child: BdFieldTree(c.visibleFields, const [])),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final state = scope.state;
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    String? failure;
    if (state.result case final BdSubmitFailure f when !state.isSubmitting) {
      failure = switch (f.reason) {
        BdSubmitFailureReason.clientValidationFailed || BdSubmitFailureReason.validationFailed =>
          state.errors.isEmpty ? f.message : strings.errorNotice,
        _ => f.message,
      };
    }
    BdCoupon? coupon;
    if (c.isLastStep) {
      for (final a in c.schema?.actions ?? const <BdFormAction>[]) {
        if ((a.coupon?.code ?? '').isNotEmpty) {
          coupon = a.coupon;
          break;
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        if (failure != null)
          Semantics(
            liveRegion: true,
            child: Row(
              spacing: 8,
              children: [
                Icon(scope.cupertino ? CupertinoIcons.exclamationmark_triangle_fill : Icons.warning_rounded, size: 18, color: colors.error),
                Expanded(child: Text(failure, style: theme.textTheme.bodyMedium?.copyWith(color: colors.error))),
              ],
            ),
          ),
        if (coupon != null)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              BdGlyph(BdGlyphs.tag, size: 18, color: colors.primary),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Text(
                      coupon.notice?.replaceAll('{code}', coupon.code ?? '') ??
                          strings.format(strings.couponApplied, [coupon.code ?? '']),
                      style: theme.textTheme.bodyMedium,
                    ),
                    if (coupon.finePrint.nonEmpty case final fine?)
                      Text(fine, style: theme.textTheme.bodySmall?.copyWith(color: colors.muted)),
                  ],
                ),
              ),
            ],
          ),
        const _Navigation(),
      ],
    );
  }
}

class _Navigation extends StatelessWidget {
  const _Navigation();

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final strings = scope.strings;
    final submitting = scope.state.isSubmitting;
    final isSubmit = !c.isConsecutive || c.isLastStep;
    final kind = switch (scope.style.submitButton) {
      BdButtonProminence.filled => BdButtonKind.filled,
      BdButtonProminence.tonal => BdButtonKind.tonal,
      BdButtonProminence.outlined => BdButtonKind.outlined,
    };
    void primary() {
      if (submitting) return;
      FocusScope.of(context).unfocus();
      if (isSubmit) {
        c.submit();
      } else {
        c.next();
      }
    }

    return Row(
      spacing: 12,
      children: [
        if (c.isConsecutive && !c.isFirstStep)
          BdButton(label: strings.back, onPressed: submitting ? null : c.back),
        Expanded(
          child: BdButton(
            label: isSubmit ? (submitting ? strings.sending : strings.submit) : strings.next,
            kind: kind,
            busy: submitting,
            expand: true,
            onPressed: primary,
          ),
        ),
      ],
    );
  }
}

/// Back asks before discarding answers, when the form turns that on and
/// the visitor has typed something.
class _ExitGuard extends StatelessWidget {
  const _ExitGuard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final confirm = c.settings.exitConfirm;
    final guard = confirm?.enabled == true && c.isDirty && !c.isSubmitted;
    return PopScope<Object?>(
      canPop: !guard,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final strings = scope.strings;
        final navigator = Navigator.of(context);
        final leave = await bdConfirm(
          context,
          title: strings.exitTitle,
          message: confirm?.message.nonEmpty ?? strings.exitMessage,
          confirm: strings.exitLeave,
          cancel: strings.exitStay,
          destructive: true,
        );
        if (leave && navigator.mounted) navigator.pop();
      },
      child: child,
    );
  }
}
