import 'dart:async';

// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/services.dart';

import 'icons.dart' show BdSvg;
import 'sign_in_core.dart';
import 'style.dart' show BdControlStyle;

/// The business's own sign-in screen — the same screen as `<BdSignIn>` on the
/// web, the Swift `BdSignInView` and the Kotlin `BdSignIn`, drawn the way
/// [BdForm] draws its fields (Material on Android, Cupertino on iOS):
///
/// - its name, logo and brand colours from BD (Settings → Branding): the
///   primary on the main button, the secondary on links;
/// - each box checked when the person leaves it, and every box when they
///   press the button — the same rules BD runs again;
/// - password sign-in, create account and reset with an emailed code, and
///   "Continue with Google / Apple / GitHub / Discord" — whichever the
///   business offers — all through WorkOS, behind BD's `auth/customer/*`.
///
/// ```dart
/// BdSignIn(
///   backend: BdBusinessDashSignInBackend(publishableKey: 'pk_live_…'),
///   authenticate: (url, scheme) => FlutterWebAuth2.authenticate(
///     url: url.toString(), callbackUrlScheme: scheme).then(Uri.parse),
///   callbackScheme: 'bdstarter',
///   onSignedIn: (session) => save(session.sessionToken),
/// )
/// ```
class BdSignIn extends StatefulWidget {
  const BdSignIn({
    super.key,
    required this.backend,
    required this.onSignedIn,
    this.start = BdSignInStart.signIn,
    this.businessName,
    this.tagline,
    this.logo,
    this.strings = const BdSignInStrings(),
    this.authenticate,
    this.callbackScheme,
    this.controls = BdControlStyle.adaptive,
    this.padding = const EdgeInsets.fromLTRB(24, 32, 24, 24),
  });

  final BdSignInBackend backend;

  /// Called once someone is signed in. Keep [BdSignInSession.sessionToken]
  /// in secure storage.
  final FutureOr<void> Function(BdSignInSession session) onSignedIn;
  final BdSignInStart start;

  /// The business's name. Null: the name BD has for the business.
  final String? businessName;

  /// A line under the sign-in title.
  final String? tagline;

  /// The app's own logo. Null: the logo from BD's branding settings.
  final Widget? logo;
  final BdSignInStrings strings;

  /// Opens a provider's page in a browser auth session. Null: no
  /// "Continue with …" buttons.
  final BdWebAuthenticate? authenticate;

  /// The app's URL scheme; provider sign-ins come back to `{scheme}://bd-oauth`.
  final String? callbackScheme;
  final BdControlStyle controls;
  final EdgeInsets padding;

  @override
  State<BdSignIn> createState() => _BdSignInState();
}

class _BdSignInState extends State<BdSignIn> {
  late BdSignInController _c;
  final Map<BdSignInBox, FocusNode> _focus = {};
  final Map<BdSignInBox, TextEditingController> _text = {};
  int _focusHandled = 0;

  @override
  void initState() {
    super.initState();
    for (final box in BdSignInBox.values) {
      final node = FocusNode();
      node.addListener(() {
        if (!node.hasFocus) _c.blur(box);
      });
      _focus[box] = node;
      _text[box] = TextEditingController();
    }
    _c = _make();
  }

  BdSignInController _make() {
    final controller = BdSignInController(
      backend: widget.backend,
      onSignedIn: (session) => widget.onSignedIn(session),
      start: widget.start,
      businessName: widget.businessName,
      tagline: widget.tagline,
      strings: widget.strings,
      authenticate: widget.authenticate,
      callbackScheme: widget.callbackScheme,
    )..addListener(_changed);
    unawaited(controller.load());
    return controller;
  }

  @override
  void didUpdateWidget(BdSignIn old) {
    super.didUpdateWidget(old);
    if (old.backend != widget.backend || old.start != widget.start) {
      _c
        ..removeListener(_changed)
        ..dispose();
      _c = _make();
    }
  }

  void _changed() {
    // What the controller holds wins: it filters the code box and clears
    // boxes on a step change.
    for (final box in BdSignInBox.values) {
      final value = _c.value(box);
      final text = _text[box]!;
      if (text.text != value) {
        text.value = TextEditingValue(
            text: value,
            selection: TextSelection.collapsed(offset: value.length));
      }
    }
    if (_c.focusTick != _focusHandled) {
      _focusHandled = _c.focusTick;
      final box = _c.focus;
      if (box != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _focus[box]?.requestFocus();
        });
      }
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _c
      ..removeListener(_changed)
      ..dispose();
    for (final node in _focus.values) {
      node.dispose();
    }
    for (final text in _text.values) {
      text.dispose();
    }
    super.dispose();
  }

  bool get _cupertino => switch (widget.controls) {
        BdControlStyle.material => false,
        BdControlStyle.cupertino => true,
        BdControlStyle.adaptive =>
          defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS,
      };

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    final dark = base.brightness == Brightness.dark;
    final palette = BdSignInPalette.from(
        _c.options.primaryColor, _c.options.secondaryColor);
    final scheme = palette == null
        ? base.colorScheme
        : base.colorScheme
            .copyWith(primary: palette.accent, onPrimary: palette.onAccent);
    final theme = base.copyWith(
      colorScheme: scheme,
      cupertinoOverrideTheme: CupertinoThemeData(
          primaryColor: scheme.primary, brightness: base.brightness),
    );
    final link = palette?.link(dark: dark) ?? scheme.primary;
    final cupertino = _cupertino;
    final strings = widget.strings;
    final busy = _c.busy;
    final boxes = _c.boxes;
    final names = boxes
        .where((b) => b == BdSignInBox.firstName || b == BdSignInBox.lastName)
        .toList();
    final rest = boxes.where((b) => !names.contains(b)).toList();
    final order = [...names, ...rest];
    final providers = _c.providers;
    final logoUrl = _c.options.logoUrl;
    final muted = cupertino
        ? CupertinoColors.secondaryLabel.resolveFrom(context)
        : scheme.onSurfaceVariant;
    final errorColor = cupertino
        ? CupertinoColors.systemRed.resolveFrom(context)
        : scheme.error;

    Widget field(BdSignInBox box) => _Field(
          box: box,
          label: strings.label(box),
          controller: _text[box]!,
          focusNode: _focus[box]!,
          error: _c.error(box),
          hint: (box == BdSignInBox.password || box == BdSignInBox.newPassword)
              ? _c.hint
              : null,
          creating: _c.step is BdSignInStepCreate,
          cupertino: cupertino,
          enabled: !busy,
          last: order.last == box,
          errorColor: errorColor,
          muted: muted,
          onChanged: (text) => _c.setValue(box, text),
          onSubmitted: () {
            final i = order.indexOf(box);
            if (i + 1 < order.length) {
              _focus[order[i + 1]]?.requestFocus();
            } else {
              unawaited(_c.submit());
            }
          },
        );

    return Theme(
      data: theme,
      child: AutofillGroup(
        child: SingleChildScrollView(
          padding: widget.padding,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 16,
                children: [
                  if (widget.logo != null)
                    Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: widget.logo)
                  else if (logoUrl != null)
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Image.network(
                        logoUrl,
                        height: 48,
                        fit: BoxFit.contain,
                        semanticLabel: _c.options.name,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      ),
                    ),
                  Semantics(
                    header: true,
                    child: Text(_c.title,
                        style: theme.textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  if (_c.subtitle != null)
                    Text(_c.subtitle!,
                        style:
                            theme.textTheme.bodyMedium?.copyWith(color: muted)),
                  if (providers.isNotEmpty)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 12,
                      children: [
                        for (final p in providers)
                          OutlinedButton(
                            onPressed: busy
                                ? null
                                : () => unawaited(_c.continueWith(p)),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(48),
                              foregroundColor: scheme.onSurface,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                      cupertino ? 12 : 24)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              spacing: 10,
                              children: [
                                _ProviderMark(
                                    provider: p, color: scheme.onSurface),
                                Text(strings.continueWith(p)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  if (providers.isNotEmpty && boxes.isNotEmpty)
                    Row(
                      spacing: 12,
                      children: [
                        Expanded(child: Divider(color: theme.dividerColor)),
                        Text(strings.or,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: muted)),
                        Expanded(child: Divider(color: theme.dividerColor)),
                      ],
                    ),
                  if (names.isNotEmpty)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 12,
                      children: [
                        for (final b in names) Expanded(child: field(b))
                      ],
                    ),
                  for (final b in rest) field(b),
                  if (_c.problem != null)
                    Semantics(
                      liveRegion: true,
                      child: Text(_c.problem!,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: errorColor)),
                    ),
                  if (_c.notice != null)
                    Semantics(
                      liveRegion: true,
                      child: Text(_c.notice!,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: muted)),
                    ),
                  _PrimaryButton(
                    label: _c.primaryLabel,
                    busy: busy,
                    cupertino: cupertino,
                    color: scheme.primary,
                    onColor: scheme.onPrimary,
                    onPressed: () => unawaited(_c.submit()),
                  ),
                  Column(
                    spacing: 4,
                    children: [
                      for (final (id, label) in _c.links)
                        TextButton(
                          onPressed: busy && id != BdSignInLink.backToSignIn
                              ? null
                              : () => _c.follow(id),
                          style: TextButton.styleFrom(foregroundColor: link),
                          child: Text(label, textAlign: TextAlign.center),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.box,
    required this.label,
    required this.controller,
    required this.focusNode,
    required this.error,
    required this.hint,
    required this.creating,
    required this.cupertino,
    required this.enabled,
    required this.last,
    required this.errorColor,
    required this.muted,
    required this.onChanged,
    required this.onSubmitted,
  });

  final BdSignInBox box;
  final String label;
  final TextEditingController controller;
  final FocusNode focusNode;
  final String? error;
  final String? hint;
  final bool creating;
  final bool cupertino;
  final bool enabled;
  final bool last;
  final Color errorColor;
  final Color muted;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;

  bool get _secret =>
      box == BdSignInBox.password || box == BdSignInBox.newPassword;

  TextInputType get _keyboard => switch (box) {
        BdSignInBox.email => TextInputType.emailAddress,
        BdSignInBox.code => TextInputType.number,
        BdSignInBox.firstName || BdSignInBox.lastName => TextInputType.name,
        _ => TextInputType.visiblePassword,
      };

  List<String> get _autofill => switch (box) {
        BdSignInBox.firstName => const [AutofillHints.givenName],
        BdSignInBox.lastName => const [AutofillHints.familyName],
        BdSignInBox.email => const [AutofillHints.email],
        BdSignInBox.password => [
            if (creating) AutofillHints.newPassword else AutofillHints.password
          ],
        BdSignInBox.newPassword => const [AutofillHints.newPassword],
        BdSignInBox.code => const [AutofillHints.oneTimeCode],
      };

  List<TextInputFormatter> get _formatters => box == BdSignInBox.code
      ? [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6)
        ]
      : const [];

  TextCapitalization get _capitalization =>
      box == BdSignInBox.firstName || box == BdSignInBox.lastName
          ? TextCapitalization.words
          : TextCapitalization.none;

  @override
  Widget build(BuildContext context) {
    final action = last ? TextInputAction.go : TextInputAction.next;
    if (cupertino) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 4,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: muted)),
          CupertinoTextField(
            controller: controller,
            focusNode: focusNode,
            enabled: enabled,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: CupertinoColors.tertiarySystemFill.resolveFrom(context),
              borderRadius: BorderRadius.circular(10),
              border: error != null
                  ? Border.all(color: errorColor, width: 1.5)
                  : null,
            ),
            obscureText: _secret,
            keyboardType: _keyboard,
            textCapitalization: _capitalization,
            autocorrect: false,
            enableSuggestions: false,
            autofillHints: _autofill,
            inputFormatters: _formatters,
            textInputAction: action,
            onChanged: onChanged,
            onSubmitted: (_) => onSubmitted(),
          ),
          if (error != null)
            Text(error!, style: TextStyle(fontSize: 13, color: errorColor))
          else if (hint != null)
            Text(hint!, style: TextStyle(fontSize: 13, color: muted)),
        ],
      );
    }
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: color, width: width),
        );
    final scheme = Theme.of(context).colorScheme;
    return TextField(
      controller: controller,
      focusNode: focusNode,
      enabled: enabled,
      decoration: InputDecoration(
        labelText: label,
        errorText: error,
        helperText: error == null ? hint : null,
        border: border(scheme.outline),
        enabledBorder: border(scheme.outline),
        focusedBorder: border(scheme.primary, 2),
        errorBorder: border(errorColor),
        focusedErrorBorder: border(errorColor, 2),
      ),
      obscureText: _secret,
      keyboardType: _keyboard,
      textCapitalization: _capitalization,
      autocorrect: false,
      enableSuggestions: false,
      autofillHints: _autofill,
      inputFormatters: _formatters,
      textInputAction: action,
      onChanged: onChanged,
      onSubmitted: (_) => onSubmitted(),
      onTapOutside: (_) => focusNode.unfocus(),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.busy,
    required this.cupertino,
    required this.color,
    required this.onColor,
    required this.onPressed,
  });

  final String label;
  final bool busy;
  final bool cupertino;
  final Color color;
  final Color onColor;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? SizedBox.square(
            dimension: 20,
            child: cupertino
                ? CupertinoActivityIndicator(color: onColor)
                : CircularProgressIndicator(strokeWidth: 2, color: onColor),
          )
        : Text(label);
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: busy,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          foregroundColor: onColor,
          disabledBackgroundColor: color.withValues(alpha: 0.6),
          disabledForegroundColor: onColor,
          minimumSize: Size.fromHeight(cupertino ? 50 : 48),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(cupertino ? 12 : 24)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        child: child,
      ),
    );
  }
}

/// The providers' own marks (the same as the web screen's).
class _ProviderMark extends StatelessWidget {
  const _ProviderMark({required this.provider, required this.color});

  final BdOAuthProvider provider;
  final Color color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: CustomPaint(
            size: const Size.square(18),
            painter: _MarkPainter(provider, color)),
      );
}

class _MarkPainter extends CustomPainter {
  _MarkPainter(this.provider, this.color);

  final BdOAuthProvider provider;
  final Color color;

  static final Map<BdOAuthProvider, List<(Path, Color?)>> _parsed = {};

  @override
  void paint(Canvas canvas, Size size) {
    final parts = _parsed.putIfAbsent(
      provider,
      () => [
        for (final (d, fill) in _marks[provider]!) (BdSvg.parsePath(d), fill)
      ],
    );
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    for (final (path, fill) in parts) {
      canvas.drawPath(path, Paint()..color = fill ?? color);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter old) =>
      old.provider != provider || old.color != color;
}

const Map<BdOAuthProvider, List<(String, Color?)>> _marks = {
  BdOAuthProvider.apple: [
    (
      'M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z',
      null,
    ),
  ],
  BdOAuthProvider.google: [
    (
      'M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z',
      Color(0xFF4285F4)
    ),
    (
      'M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z',
      Color(0xFF34A853)
    ),
    (
      'M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z',
      Color(0xFFFBBC05)
    ),
    (
      'M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z',
      Color(0xFFEA4335)
    ),
  ],
  BdOAuthProvider.github: [
    (
      'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z',
      null,
    ),
  ],
  BdOAuthProvider.discord: [
    (
      'M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z',
      Color(0xFF5865F2),
    ),
  ],
};
