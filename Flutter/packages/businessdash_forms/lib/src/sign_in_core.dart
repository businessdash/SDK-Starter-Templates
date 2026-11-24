import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show Color;
import 'package:http/http.dart' as http;

// Customer sign-in, the Dart port of the SDK's `sign-in-core`: the same steps,
// checks, words and brand colours as `<BdSignIn>` on the web, the Swift
// `BdSignInView` and the Kotlin `BdSignIn`.
//
// Every step is BD's `auth/customer/*` routes, which run it through WorkOS —
// the same accounts as BD's hosted sign-in. Nothing here keeps a password or
// checks a code itself.

// ── What BD sends ────────────────────────────────────────────────────────────

/// "Continue with …" providers, in the order the screen shows them.
enum BdOAuthProvider {
  apple('apple'),
  google('google'),
  github('github'),
  discord('discord');

  const BdOAuthProvider(this.wire);

  /// BD's name for it.
  final String wire;

  static BdOAuthProvider? fromWire(Object? value) {
    for (final p in values) {
      if (p.wire == value) return p;
    }
    return null;
  }
}

/// What the business offers on its sign-in screen (`auth/customer/options`).
@immutable
class BdSignInOptions {
  const BdSignInOptions({
    this.name,
    this.password = true,
    this.oauth = const [],
    this.primaryColor,
    this.secondaryColor,
    this.logoUrl,
  });

  factory BdSignInOptions.fromJson(Map<String, dynamic> json) => BdSignInOptions(
        name: _string(json['name']),
        password: json['password'] != false,
        oauth: [
          for (final p in (json['oauth'] is List ? json['oauth'] as List : const []))
            if (BdOAuthProvider.fromWire(p) case final provider?) provider,
        ],
        primaryColor: _string(json['primaryColor']),
        secondaryColor: _string(json['secondaryColor']),
        logoUrl: _string(json['logoUrl']),
      );

  /// The business's name, as BD knows it.
  final String? name;
  final bool password;

  /// "Continue with …" links, through WorkOS.
  final List<BdOAuthProvider> oauth;

  /// Brand colours from Settings → Branding (`#rrggbb`).
  final String? primaryColor;
  final String? secondaryColor;

  /// The business's logo (https), shown when the app gives none.
  final String? logoUrl;
}

/// A code is on its way (or would be, for an email with no account).
@immutable
class BdCodeSent {
  const BdCodeSent({required this.pendingId, required this.expiresAt});

  factory BdCodeSent.fromJson(Map<String, dynamic> json) {
    final pendingId = _string(json['pendingId']);
    if (pendingId == null) throw BdSignInException.unavailable();
    return BdCodeSent(pendingId: pendingId, expiresAt: _string(json['expiresAt']) ?? '');
  }

  final String pendingId;
  final String expiresAt;
}

@immutable
class BdSignInUser {
  const BdSignInUser({required this.id, this.email, this.firstName, this.lastName});

  factory BdSignInUser.fromJson(Map<String, dynamic> json) => BdSignInUser(
        id: _string(json['id']) ?? '',
        email: _string(json['email']),
        firstName: _string(json['firstName']),
        lastName: _string(json['lastName']),
      );

  final String id;
  final String? email;
  final String? firstName;
  final String? lastName;
}

/// Someone is signed in. [sessionToken] is theirs to keep (secure storage)
/// and send as `X-BD-Session-Token` on customer-portal calls.
@immutable
class BdSignInSession {
  const BdSignInSession({
    required this.user,
    required this.expiresAt,
    this.organizationId,
    this.role,
    this.sessionToken,
  });

  factory BdSignInSession.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    if (user is! Map<String, dynamic>) throw BdSignInException.unavailable();
    return BdSignInSession(
      user: BdSignInUser.fromJson(user),
      organizationId: _string(json['organizationId']),
      role: _string(json['role']),
      expiresAt: _string(json['expiresAt']) ?? '',
      sessionToken: _string(json['sessionToken']),
    );
  }

  final BdSignInUser user;
  final String? organizationId;
  final String? role;
  final String expiresAt;
  final String? sessionToken;
}

/// A password sign-in's answer: signed in, or — when WorkOS wants the email
/// confirmed first — a code sent to it.
sealed class BdPasswordSignIn {
  const BdPasswordSignIn();
}

final class BdSignedIn extends BdPasswordSignIn {
  const BdSignedIn(this.session);
  final BdSignInSession session;
}

final class BdConfirmEmail extends BdPasswordSignIn {
  const BdConfirmEmail(this.sent);
  final BdCodeSent sent;
}

/// What went wrong, in words the person can act on. [code] is BD's
/// (`invalid_credentials`, `invalid_code`, `code_expired`, `weak_password`…).
class BdSignInException implements Exception {
  const BdSignInException(this.code, this.message);

  factory BdSignInException.unavailable() =>
      const BdSignInException('unavailable', "Sign-in isn't available just now. Try again in a minute.");

  factory BdSignInException.offline() =>
      const BdSignInException('offline', "You're offline. Check your connection and try again.");

  final String code;
  final String message;

  @override
  String toString() => message;
}

/// Thrown by a [BdWebAuthenticate] when the person closes the browser.
class BdSignInCancelled implements Exception {
  const BdSignInCancelled();
}

/// Opens [url] in a browser auth session (ASWebAuthenticationSession on iOS,
/// a Custom Tab on Android — the browser's own sign-in, where the person may
/// already be signed in to the provider; Google refuses embedded web views)
/// and returns the URL it comes back to on [callbackScheme]. Throw
/// [BdSignInCancelled] when the person closes it. `flutter_web_auth_2`'s
/// `FlutterWebAuth2.authenticate` does exactly this.
typedef BdWebAuthenticate = Future<Uri> Function(Uri url, String callbackScheme);

// ── Where sign-in goes ───────────────────────────────────────────────────────

abstract interface class BdSignInBackend {
  Future<BdSignInOptions> options();
  Future<BdPasswordSignIn> signIn(String email, String password);

  /// Emails a code. The account is made when the code comes back ([verify]).
  Future<BdCodeSent> startSignUp({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
  });

  /// Emails a code for a new password. Unknown emails get the same answer.
  Future<BdCodeSent> startReset(String email);

  /// The emailed code: makes the account, or sets [newPassword], and signs in.
  Future<BdSignInSession> verify({required String pendingId, required String code, String? newPassword});

  /// WorkOS's page for [provider]; it comes back to [redirectUri] with a code.
  Future<Uri> startOAuth({
    required BdOAuthProvider provider,
    required String redirectUri,
    required String codeChallenge,
  });

  /// Redeems the code a provider sign-in came back with.
  Future<BdSignInSession> finishOAuth({required String code, required String codeVerifier});
}

/// Straight to BD with the business's publishable `pk_…` key — what an app
/// holds. The session (with its token) comes back to the app.
class BdBusinessDashSignInBackend implements BdSignInBackend {
  BdBusinessDashSignInBackend({
    required String publishableKey,
    Uri? host,
    http.Client? httpClient,
  })  : _key = publishableKey.trim(),
        _base = _customerBase(host ?? Uri.parse('https://businessdash.us')),
        _http = httpClient ?? http.Client() {
    // A throw, not an assert: release builds drop asserts, and they're the
    // ones that ship. Allow, don't deny: secret keys start with bd_.
    if (_key.isNotEmpty && !_key.startsWith('pk_')) {
      throw ArgumentError('An app holds the publishable pk_ key, never a secret key.');
    }
  }

  final String _key;
  final Uri _base;
  final http.Client _http;

  static Uri _customerBase(Uri host) =>
      host.replace(path: '${host.path.replaceAll(RegExp(r'/+$'), '')}/api/package/v1/auth/customer');

  Future<Map<String, dynamic>> _call(String path, [Map<String, Object?>? body]) async {
    final uri = _base.replace(path: '${_base.path}/$path');
    final headers = {
      'Authorization': 'Bearer $_key',
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };
    http.Response response;
    try {
      response = body == null
          ? await _http.get(uri, headers: headers)
          : await _http.post(uri, headers: headers, body: jsonEncode(body));
    } on http.ClientException {
      throw BdSignInException.offline();
    } on Exception {
      throw BdSignInException.unavailable();
    }
    Object? parsed;
    try {
      parsed = response.body.isEmpty ? null : jsonDecode(response.body);
    } on FormatException {
      parsed = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final problem = parsed is Map ? parsed : const {};
      final message = problem['message'];
      if (message is String && message.trim().isNotEmpty) {
        final code = problem['error'];
        throw BdSignInException(code is String ? code : 'failed', message);
      }
      throw response.statusCode == 429
          ? const BdSignInException('too_many_tries', "That's a lot of tries. Wait a few minutes, then try again.")
          : BdSignInException.unavailable();
    }
    if (parsed is! Map<String, dynamic>) throw BdSignInException.unavailable();
    return parsed;
  }

  @override
  Future<BdSignInOptions> options() async => BdSignInOptions.fromJson(await _call('options'));

  @override
  Future<BdPasswordSignIn> signIn(String email, String password) async {
    final json = await _call('sign-in', {'email': email, 'password': password});
    if (json['pendingId'] is String && !json.containsKey('sessionToken')) {
      return BdConfirmEmail(BdCodeSent.fromJson(json));
    }
    return BdSignedIn(BdSignInSession.fromJson(json));
  }

  @override
  Future<BdCodeSent> startSignUp({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
  }) async =>
      BdCodeSent.fromJson(await _call('sign-up', {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      }));

  @override
  Future<BdCodeSent> startReset(String email) async =>
      BdCodeSent.fromJson(await _call('forgot-password', {'email': email}));

  @override
  Future<BdSignInSession> verify({required String pendingId, required String code, String? newPassword}) async =>
      BdSignInSession.fromJson(await _call('verify', {
        'pendingId': pendingId,
        'code': code,
        'newPassword': newPassword,
      }));

  @override
  Future<Uri> startOAuth({
    required BdOAuthProvider provider,
    required String redirectUri,
    required String codeChallenge,
  }) async {
    final json = await _call('oauth/start', {
      'provider': provider.wire,
      'redirectUri': redirectUri,
      'returnTo': null,
      'codeChallenge': codeChallenge,
    });
    final url = Uri.tryParse(_string(json['url']) ?? '');
    if (url == null || !url.hasScheme) throw BdSignInException.unavailable();
    return url;
  }

  @override
  Future<BdSignInSession> finishOAuth({required String code, required String codeVerifier}) async =>
      BdSignInSession.fromJson(await _call('oauth/exchange', {'code': code, 'codeVerifier': codeVerifier}));
}

/// A PKCE pair (RFC 7636, S256): the verifier stays in the app, the
/// challenge goes to BD, and only the pair redeems a provider's code.
({String verifier, String challenge}) bdNewPkcePair([math.Random? random]) {
  final r = random ?? math.Random.secure();
  final verifier = _base64Url(List<int>.generate(32, (_) => r.nextInt(256)));
  final challenge = _base64Url(crypto.sha256.convert(ascii.encode(verifier)).bytes);
  return (verifier: verifier, challenge: challenge);
}

String _base64Url(List<int> bytes) => base64Url.encode(bytes).replaceAll('=', '');

// ── Words ────────────────────────────────────────────────────────────────────

/// Every word the screen shows. `{name}` is the business's name and `{email}`
/// the address a code went to. The same words as the web, Swift and Kotlin
/// screens.
@immutable
class BdSignInStrings {
  const BdSignInStrings({
    this.signInTitle = 'Sign in to {name}',
    this.createTitle = 'Create your {name} account',
    this.createSubtitle = "Your account with {name}. We'll email you a code to confirm it.",
    this.signInTitleNoName = 'Sign in',
    this.createTitleNoName = 'Create your account',
    this.createSubtitleNoName = "We'll email you a code to confirm it.",
    this.forgotTitle = 'Reset your password',
    this.forgotSubtitle = "Enter your email and we'll send you a code.",
    this.codeTitle = 'Check your email',
    this.codeSubtitle = 'We sent a 6-digit code to {email}.',
    this.codeResetSubtitle = 'We sent a 6-digit code to {email}. Enter it with your new password.',
    this.email = 'Email',
    this.password = 'Password',
    this.newPassword = 'New password',
    this.firstName = 'First name',
    this.lastName = 'Last name',
    this.code = '6-digit code',
    this.passwordRule = 'At least 10 characters.',
    this.signIn = 'Sign in',
    this.createAccount = 'Create account',
    this.sendCode = 'Send code',
    this.confirm = 'Continue',
    this.resendCode = 'Send a new code',
    this.codeResent = 'A new code is on its way.',
    this.forgotPassword = 'Forgot password?',
    this.noAccount = 'New here? Create an account',
    this.haveAccount = 'Already have an account? Sign in',
    this.backToSignIn = 'Back to sign in',
    this.or = 'or',
    this.continueWithApple = 'Continue with Apple',
    this.continueWithGoogle = 'Continue with Google',
    this.continueWithGitHub = 'Continue with GitHub',
    this.continueWithDiscord = 'Continue with Discord',
    this.enterEmail = 'Enter your email.',
    this.invalidEmail = 'Enter a full email address, like name@example.com.',
    this.enterPassword = 'Enter your password.',
    this.enterCode = 'Enter the 6-digit code from the email.',
    this.passwordTooShort = 'Use at least 10 characters for your password.',
    this.passwordTooLong = 'Use 256 characters or fewer for your password.',
    this.nameTooLong = 'Use 100 characters or fewer.',
  });

  final String signInTitle;
  final String createTitle;
  final String createSubtitle;
  final String signInTitleNoName;
  final String createTitleNoName;
  final String createSubtitleNoName;
  final String forgotTitle;
  final String forgotSubtitle;
  final String codeTitle;
  final String codeSubtitle;
  final String codeResetSubtitle;
  final String email;
  final String password;
  final String newPassword;
  final String firstName;
  final String lastName;
  final String code;
  final String passwordRule;
  final String signIn;
  final String createAccount;
  final String sendCode;
  final String confirm;
  final String resendCode;
  final String codeResent;
  final String forgotPassword;
  final String noAccount;
  final String haveAccount;
  final String backToSignIn;
  final String or;
  final String continueWithApple;
  final String continueWithGoogle;
  final String continueWithGitHub;
  final String continueWithDiscord;
  final String enterEmail;
  final String invalidEmail;
  final String enterPassword;
  final String enterCode;
  final String passwordTooShort;
  final String passwordTooLong;
  final String nameTooLong;

  String continueWith(BdOAuthProvider provider) => switch (provider) {
        BdOAuthProvider.apple => continueWithApple,
        BdOAuthProvider.google => continueWithGoogle,
        BdOAuthProvider.github => continueWithGitHub,
        BdOAuthProvider.discord => continueWithDiscord,
      };

  String label(BdSignInBox box) => switch (box) {
        BdSignInBox.firstName => firstName,
        BdSignInBox.lastName => lastName,
        BdSignInBox.email => email,
        BdSignInBox.password => password,
        BdSignInBox.code => code,
        BdSignInBox.newPassword => newPassword,
      };
}

String _fill(String template, Map<String, String> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values[m[1]] ?? m[0]!);

// ── Checks ───────────────────────────────────────────────────────────────────

/// The boxes the sign-in screen can show.
enum BdSignInBox { firstName, lastName, email, password, code, newPassword }

/// What's wrong with one box, or null — the same rules as the web, Swift and
/// Kotlin screens and BD's own `auth/customer/` routes. The screen runs them
/// when the person leaves a box they've typed in, and for every box when
/// they press the button; BD checks again on its side.
abstract final class BdSignInChecks {
  /// A new password's minimum length — BD's rule.
  static const minPasswordLength = 10;
  static const maxPasswordLength = 256;
  static const maxEmailLength = 320;
  static const maxNameLength = 100;

  /// Local part @ domain . TLD (≥ 2) — the rule BD's forms use for email.
  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  /// [newPassword]: the password box is choosing one (a new account), not
  /// just signing in — BD's minimum applies.
  static String? problem(
    BdSignInBox box,
    String value, {
    required bool newPassword,
    BdSignInStrings strings = const BdSignInStrings(),
  }) {
    switch (box) {
      case BdSignInBox.firstName || BdSignInBox.lastName:
        return value.trim().length > maxNameLength ? strings.nameTooLong : null;
      case BdSignInBox.email:
        final email = value.trim();
        if (email.isEmpty) return strings.enterEmail;
        if (email.length > maxEmailLength || !_email.hasMatch(email)) return strings.invalidEmail;
        return null;
      case BdSignInBox.password:
        if (newPassword) return _choosing(value, strings);
        if (value.isEmpty) return strings.enterPassword;
        return value.length > maxPasswordLength ? strings.passwordTooLong : null;
      case BdSignInBox.newPassword:
        return _choosing(value, strings);
      case BdSignInBox.code:
        return RegExp(r'^\d{6}$').hasMatch(value) ? null : strings.enterCode;
    }
  }

  static String? _choosing(String value, BdSignInStrings strings) {
    if (value.length < minPasswordLength) return strings.passwordTooShort;
    if (value.length > maxPasswordLength) return strings.passwordTooLong;
    return null;
  }

  /// BD's answers that are about one box, so they show under it.
  static BdSignInBox? boxFor(String code, List<BdSignInBox> shown) {
    final candidates = switch (code) {
      'weak_password' || 'password_too_short' => [BdSignInBox.newPassword, BdSignInBox.password],
      'invalid_code' || 'code_expired' => [BdSignInBox.code],
      'invalid_email' => [BdSignInBox.email],
      _ => const <BdSignInBox>[],
    };
    for (final box in candidates) {
      if (shown.contains(box)) return box;
    }
    return null;
  }
}

// ── Brand colours ────────────────────────────────────────────────────────────

/// A business's two brand colours (Settings → Branding in BD) as the screen
/// uses them: the primary on the main button, exactly as set, with black or
/// white text — whichever reads; the secondary (else the primary) on links,
/// nudged only as far as it takes to read at 4.5:1 on a light or dark screen.
@immutable
class BdSignInPalette {
  const BdSignInPalette({
    required this.accent,
    required this.onAccent,
    required this.linkLight,
    required this.linkDark,
  });

  final Color accent;
  final Color onAccent;
  final Color linkLight;
  final Color linkDark;

  Color link({required bool dark}) => dark ? linkDark : linkLight;

  /// Null when [primary] isn't `#rrggbb` (or `#rgb`).
  static BdSignInPalette? from(String? primary, String? secondary) {
    final accent = _Rgb.parse(primary);
    if (accent == null) return null;
    final linkBase = _Rgb.parse(secondary) ?? accent;
    return BdSignInPalette(
      accent: accent.color,
      onAccent: (accent.contrast(_Rgb.white) >= accent.contrast(_Rgb.ink) ? _Rgb.white : _Rgb.ink).color,
      linkLight: linkBase.legible(_Rgb.white, 4.5).color,
      linkDark: linkBase.legible(_Rgb.ink, 4.5).color,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is BdSignInPalette &&
      other.accent == accent &&
      other.onAccent == onAccent &&
      other.linkLight == linkLight &&
      other.linkDark == linkDark;

  @override
  int get hashCode => Object.hash(accent, onAccent, linkLight, linkDark);
}

/// An sRGB colour, 0…255 per channel.
class _Rgb {
  const _Rgb(this.r, this.g, this.b);

  final int r;
  final int g;
  final int b;

  static const white = _Rgb(255, 255, 255);
  static const black = _Rgb(0, 0, 0);

  /// Near-black text, and the dark screen links must read on (#111827).
  static const ink = _Rgb(17, 24, 39);

  Color get color => Color(0xff000000 | (r << 16) | (g << 8) | b);

  double get luminance {
    double lin(int c) {
      final v = c / 255;
      return v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
    }

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  double contrast(_Rgb other) {
    final a = luminance, o = other.luminance;
    return (math.max(a, o) + 0.05) / (math.min(a, o) + 0.05);
  }

  _Rgb _mixed(_Rgb toward, double t) => _Rgb(
        (r + (toward.r - r) * t).round(),
        (g + (toward.g - g) * t).round(),
        (b + (toward.b - b) * t).round(),
      );

  /// Darkened (light surface) or lightened (dark one) just enough to read.
  _Rgb legible(_Rgb surface, double minimum) {
    final toward = surface.luminance > 0.5 ? black : white;
    for (var step = 0; step <= 40; step++) {
      final candidate = _mixed(toward, step / 40);
      if (candidate.contrast(surface) >= minimum) return candidate;
    }
    return toward;
  }

  static _Rgb? parse(String? hex) {
    var text = hex?.trim().toLowerCase();
    if (text == null || !text.startsWith('#')) return null;
    text = text.substring(1);
    if (text.length == 3) text = text.split('').map((c) => '$c$c').join();
    if (text.length != 6) return null;
    final value = int.tryParse(text, radix: 16);
    if (value == null) return null;
    return _Rgb((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  }
}

// ── The screen's state ───────────────────────────────────────────────────────

/// The screen a sign-in starts on.
enum BdSignInStart { signIn, createAccount }

/// Which step the screen is on.
sealed class BdSignInStep {
  const BdSignInStep();
}

final class BdSignInStepSignIn extends BdSignInStep {
  const BdSignInStepSignIn();
}

final class BdSignInStepCreate extends BdSignInStep {
  const BdSignInStepCreate();
}

final class BdSignInStepForgot extends BdSignInStep {
  const BdSignInStepForgot();
}

/// Why a code was sent.
enum BdCodePurpose { signUp, reset, verify }

final class BdSignInStepCode extends BdSignInStep {
  const BdSignInStepCode({required this.sent, required this.purpose, required this.email});
  final BdCodeSent sent;
  final BdCodePurpose purpose;
  final String email;
}

/// The links under the button.
enum BdSignInLink { forgotPassword, createAccount, haveAccount, backToSignIn, resendCode }

/// The sign-in screen's logic, without the drawing — what `BdSignIn` shows.
/// The same steps as the SDK's `createSignInController`.
class BdSignInController extends ChangeNotifier {
  BdSignInController({
    required this.backend,
    required this.onSignedIn,
    BdSignInStart start = BdSignInStart.signIn,
    this.businessName,
    this.tagline,
    this.strings = const BdSignInStrings(),
    this.authenticate,
    this.callbackScheme,
  }) : _step = start == BdSignInStart.createAccount ? const BdSignInStepCreate() : const BdSignInStepSignIn();

  final BdSignInBackend backend;
  final FutureOr<void> Function(BdSignInSession session) onSignedIn;
  final String? businessName;
  final String? tagline;
  final BdSignInStrings strings;

  /// Opens a provider's page in a browser auth session. Null: no provider
  /// buttons.
  final BdWebAuthenticate? authenticate;

  /// The app's URL scheme; provider sign-ins come back to `{scheme}://bd-oauth`.
  final String? callbackScheme;

  BdSignInStep _step;
  final Map<BdSignInBox, String> _values = {for (final b in BdSignInBox.values) b: ''};
  Map<BdSignInBox, String> _errors = {};
  final Set<BdSignInBox> _edited = {};
  bool _busy = false;
  String? _problem;
  String? _notice;
  BdSignInOptions _options = const BdSignInOptions();
  BdSignInBox? _focus;
  int _focusTick = 0;
  bool _disposed = false;

  BdSignInStep get step => _step;
  bool get busy => _busy;
  String? get problem => _problem;
  String? get notice => _notice;
  BdSignInOptions get options => _options;

  /// The box that should have focus — set on a step change or a problem.
  BdSignInBox? get focus => _focus;

  /// Bumps each time [focus] is asked for, so the screen acts once per ask.
  int get focusTick => _focusTick;

  String value(BdSignInBox box) => _values[box] ?? '';
  String? error(BdSignInBox box) => _errors[box];

  String? get _name {
    final given = (businessName ?? '').trim();
    if (given.isNotEmpty) return given;
    final fromBD = (_options.name ?? '').trim();
    return fromBD.isEmpty ? null : fromBD;
  }

  /// Which boxes this step shows, in order. First and last name share a row.
  List<BdSignInBox> get boxes => switch (_step) {
        BdSignInStepSignIn() => const [BdSignInBox.email, BdSignInBox.password],
        BdSignInStepCreate() => const [
            BdSignInBox.firstName,
            BdSignInBox.lastName,
            BdSignInBox.email,
            BdSignInBox.password,
          ],
        BdSignInStepForgot() => const [BdSignInBox.email],
        BdSignInStepCode(:final purpose) => purpose == BdCodePurpose.reset
            ? const [BdSignInBox.code, BdSignInBox.newPassword]
            : const [BdSignInBox.code],
      };

  String get title {
    final name = _name;
    return switch (_step) {
      BdSignInStepSignIn() => name == null ? strings.signInTitleNoName : _fill(strings.signInTitle, {'name': name}),
      BdSignInStepCreate() => name == null ? strings.createTitleNoName : _fill(strings.createTitle, {'name': name}),
      BdSignInStepForgot() => strings.forgotTitle,
      BdSignInStepCode() => strings.codeTitle,
    };
  }

  String? get subtitle {
    final name = _name;
    return switch (_step) {
      BdSignInStepSignIn() => (tagline ?? '').trim().isEmpty ? null : tagline!.trim(),
      BdSignInStepCreate() =>
        name == null ? strings.createSubtitleNoName : _fill(strings.createSubtitle, {'name': name}),
      BdSignInStepForgot() => strings.forgotSubtitle,
      BdSignInStepCode(:final purpose, :final email) => _fill(
          purpose == BdCodePurpose.reset ? strings.codeResetSubtitle : strings.codeSubtitle,
          {'email': email},
        ),
    };
  }

  /// Under the password box: the new-password rule, when it applies.
  String? get hint => switch (_step) {
        BdSignInStepCreate() => strings.passwordRule,
        BdSignInStepCode(:final purpose) when purpose == BdCodePurpose.reset => strings.passwordRule,
        _ => null,
      };

  String get primaryLabel => switch (_step) {
        BdSignInStepSignIn() => strings.signIn,
        BdSignInStepCreate() => strings.createAccount,
        BdSignInStepForgot() => strings.sendCode,
        BdSignInStepCode() => strings.confirm,
      };

  List<(BdSignInLink, String)> get links => switch (_step) {
        BdSignInStepSignIn() => _options.password
            ? [
                (BdSignInLink.forgotPassword, strings.forgotPassword),
                (BdSignInLink.createAccount, strings.noAccount),
              ]
            : const [],
        BdSignInStepCreate() => [(BdSignInLink.haveAccount, strings.haveAccount)],
        BdSignInStepForgot() => [(BdSignInLink.backToSignIn, strings.backToSignIn)],
        BdSignInStepCode() => [
            (BdSignInLink.resendCode, strings.resendCode),
            (BdSignInLink.backToSignIn, strings.backToSignIn),
          ],
      };

  /// The "Continue with …" buttons, in order: the providers the business
  /// has switched on, when the app can open a browser auth session.
  List<BdOAuthProvider> get providers {
    final offers = _step is BdSignInStepSignIn || _step is BdSignInStepCreate;
    if (!offers || authenticate == null || (callbackScheme ?? '').isEmpty) return const [];
    return [
      for (final p in BdOAuthProvider.values)
        if (_options.oauth.contains(p)) p,
    ];
  }

  bool get _newPassword => _step is BdSignInStepCreate;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void _askFocus(BdSignInBox? box) {
    _focus = box;
    _focusTick += 1;
  }

  void _go(BdSignInStep next) {
    _problem = null;
    _notice = null;
    _errors = {};
    _edited.clear();
    _values[BdSignInBox.code] = '';
    _values[BdSignInBox.newPassword] = '';
    _step = next;
    _askFocus(switch (next) {
      BdSignInStepCreate() => BdSignInBox.firstName,
      BdSignInStepCode() => BdSignInBox.code,
      _ => BdSignInBox.email,
    });
    _emit();
  }

  String? _check(BdSignInBox box) =>
      BdSignInChecks.problem(box, value(box), newPassword: _newPassword, strings: strings);

  void _setError(BdSignInBox box, String? message) {
    if (message != null) {
      _errors = {..._errors, box: message};
    } else if (_errors.containsKey(box)) {
      _errors = Map.of(_errors)..remove(box);
    }
  }

  /// Every box on the step, as the button is pressed. False (and the first
  /// wrong box focused) when any is wrong — nothing is sent.
  bool _checkAll() {
    final next = <BdSignInBox, String>{};
    BdSignInBox? first;
    for (final box in boxes) {
      final message = _check(box);
      if (message == null) continue;
      next[box] = message;
      first ??= box;
    }
    _errors = next;
    if (first == null) return true;
    _askFocus(first);
    _emit();
    return false;
  }

  Future<void> _run(Future<void> Function() work) async {
    _busy = true;
    _emit();
    try {
      await work();
    } on BdSignInException catch (error) {
      final box = BdSignInChecks.boxFor(error.code, boxes);
      if (box != null) {
        _setError(box, error.message);
        _askFocus(box);
      } else {
        _problem = error.message;
      }
    } catch (_) {
      _problem = BdSignInException.unavailable().message;
    } finally {
      _busy = false;
      _emit();
    }
  }

  String get _email => value(BdSignInBox.email).trim();

  String? _clean(String text) => text.trim().isEmpty ? null : text.trim();

  /// Loads the business's name, colours and providers from BD.
  Future<void> load() async {
    try {
      _options = await backend.options();
      _emit();
    } catch (_) {
      // Keep the defaults: email and password, no providers.
    }
  }

  void setValue(BdSignInBox box, String text) {
    var next = text;
    if (box == BdSignInBox.code) {
      next = text.replaceAll(RegExp(r'\D'), '');
      if (next.length > 6) next = next.substring(0, 6);
    }
    if (value(box) == next) {
      if (next != text) _emit();
      return;
    }
    _values[box] = next;
    _edited.add(box);
    // A box already marked wrong is re-checked as it's typed in, so the
    // message goes the moment it's right (and never appears early).
    if (_errors.containsKey(box)) _setError(box, _check(box));
    _emit();
    final step = _step;
    if (box == BdSignInBox.code && next.length == 6 && step is BdSignInStepCode && step.purpose != BdCodePurpose.reset) {
      unawaited(submit());
    }
  }

  /// The person left a box: check it, if they typed in it.
  void blur(BdSignInBox box) {
    if (!_edited.contains(box) || !boxes.contains(box)) return;
    final before = _errors[box];
    _setError(box, _check(box));
    if (_errors[box] != before) _emit();
  }

  Future<void> submit() async {
    if (_busy) return;
    _problem = null;
    _notice = null;
    if (!_checkAll()) return;
    final current = _step;
    switch (current) {
      case BdSignInStepSignIn():
        return _run(() async {
          final to = _email;
          switch (await backend.signIn(to, value(BdSignInBox.password))) {
            case BdConfirmEmail(:final sent):
              // WorkOS wants the email confirmed; it has sent a code.
              _go(BdSignInStepCode(sent: sent, purpose: BdCodePurpose.verify, email: to));
            case BdSignedIn(:final session):
              await onSignedIn(session);
          }
        });
      case BdSignInStepCreate():
        return _run(() async {
          final to = _email;
          final sent = await backend.startSignUp(
            email: to,
            password: value(BdSignInBox.password),
            firstName: _clean(value(BdSignInBox.firstName)),
            lastName: _clean(value(BdSignInBox.lastName)),
          );
          _go(BdSignInStepCode(sent: sent, purpose: BdCodePurpose.signUp, email: to));
        });
      case BdSignInStepForgot():
        return _run(() async {
          final to = _email;
          final sent = await backend.startReset(to);
          _go(BdSignInStepCode(sent: sent, purpose: BdCodePurpose.reset, email: to));
        });
      case BdSignInStepCode(:final sent, :final purpose):
        return _run(() async {
          await onSignedIn(await backend.verify(
            pendingId: sent.pendingId,
            code: value(BdSignInBox.code),
            newPassword: purpose == BdCodePurpose.reset ? value(BdSignInBox.newPassword) : null,
          ));
        });
    }
  }

  void _resend() {
    final step = _step;
    if (step is! BdSignInStepCode || _busy) return;
    _problem = null;
    unawaited(_run(() async {
      final BdCodeSent sent;
      switch (step.purpose) {
        case BdCodePurpose.signUp:
          sent = await backend.startSignUp(
            email: step.email,
            password: value(BdSignInBox.password),
            firstName: _clean(value(BdSignInBox.firstName)),
            lastName: _clean(value(BdSignInBox.lastName)),
          );
        case BdCodePurpose.verify:
          switch (await backend.signIn(step.email, value(BdSignInBox.password))) {
            case BdSignedIn(:final session):
              await onSignedIn(session);
              return;
            case BdConfirmEmail(sent: final again):
              sent = again;
          }
        case BdCodePurpose.reset:
          sent = await backend.startReset(step.email);
      }
      _step = BdSignInStepCode(sent: sent, purpose: step.purpose, email: step.email);
      _values[BdSignInBox.code] = '';
      _setError(BdSignInBox.code, null);
      _notice = strings.codeResent;
      _askFocus(BdSignInBox.code);
    }));
  }

  void follow(BdSignInLink link) {
    if (_busy && link != BdSignInLink.backToSignIn) return;
    switch (link) {
      case BdSignInLink.forgotPassword:
        _go(const BdSignInStepForgot());
      case BdSignInLink.createAccount:
        _go(const BdSignInStepCreate());
      case BdSignInLink.haveAccount || BdSignInLink.backToSignIn:
        _go(const BdSignInStepSignIn());
      case BdSignInLink.resendCode:
        _resend();
    }
  }

  /// "Continue with …": WorkOS's page for [provider] in a browser auth
  /// session, then the code it comes back with redeemed for a session.
  Future<void> continueWith(BdOAuthProvider provider) async {
    final open = authenticate;
    final scheme = callbackScheme;
    if (_busy || open == null || scheme == null || !providers.contains(provider)) return;
    _problem = null;
    await _run(() async {
      final pkce = bdNewPkcePair();
      final url = await backend.startOAuth(
        provider: provider,
        redirectUri: '$scheme://bd-oauth',
        codeChallenge: pkce.challenge,
      );
      final Uri back;
      try {
        back = await open(url, scheme);
      } on BdSignInCancelled {
        return;
      }
      final failed = back.queryParameters['bd_oauth_error'];
      if (failed != null && failed.isNotEmpty) {
        if (failed == 'cancelled') return;
        final message = back.queryParameters['bd_oauth_message'];
        throw BdSignInException(
          'oauth_failed',
          message != null && message.isNotEmpty ? message : "Sign-in didn't finish. Try again.",
        );
      }
      final code = back.queryParameters['bd_oauth_code'];
      if (code == null || code.isEmpty) {
        throw const BdSignInException('oauth_failed', "Sign-in didn't finish. Try again.");
      }
      await onSignedIn(await backend.finishOAuth(code: code, codeVerifier: pkce.verifier));
    });
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

String? _string(Object? value) => value is String && value.isNotEmpty ? value : null;
