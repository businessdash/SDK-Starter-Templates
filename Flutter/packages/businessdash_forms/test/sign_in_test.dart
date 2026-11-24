import 'dart:convert';

import 'package:businessdash_forms/businessdash_forms.dart';
import 'package:crypto/crypto.dart' as crypto;
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// A backend that answers from a script, recording what it was asked.
class _FakeBackend implements BdSignInBackend {
  final calls = <String>[];
  BdSignInOptions answerOptions = const BdSignInOptions(name: 'Acme', oauth: [BdOAuthProvider.github]);
  BdPasswordSignIn? answerSignIn;
  Object? failWith;

  static const session = BdSignInSession(user: BdSignInUser(id: 'u1', email: 'a@b.co'), expiresAt: '2030-01-01T00:00:00Z', sessionToken: 'tok');
  static const sent = BdCodeSent(pendingId: 'p1', expiresAt: '2030-01-01T00:00:00Z');

  Future<T> _answer<T>(String call, T value) async {
    calls.add(call);
    final fail = failWith;
    if (fail != null) throw fail;
    return value;
  }

  @override
  Future<BdSignInOptions> options() => _answer('options', answerOptions);
  @override
  Future<BdPasswordSignIn> signIn(String email, String password) =>
      _answer('signIn $email', answerSignIn ?? const BdSignedIn(session));
  @override
  Future<BdCodeSent> startSignUp({required String email, required String password, String? firstName, String? lastName}) =>
      _answer('signUp $email $firstName', sent);
  @override
  Future<BdCodeSent> startReset(String email) => _answer('reset $email', sent);
  @override
  Future<BdSignInSession> verify({required String pendingId, required String code, String? newPassword}) =>
      _answer('verify $pendingId $code $newPassword', session);
  @override
  Future<Uri> startOAuth({required BdOAuthProvider provider, required String redirectUri, required String codeChallenge}) =>
      _answer('oauthStart ${provider.wire} $redirectUri', Uri.parse('https://auth.example/authorize'));
  @override
  Future<BdSignInSession> finishOAuth({required String code, required String codeVerifier}) =>
      _answer('oauthFinish $code', session);
}

void main() {
  group('BdSignInChecks', () {
    test('email', () {
      expect(BdSignInChecks.problem(BdSignInBox.email, ' ', newPassword: false), 'Enter your email.');
      expect(BdSignInChecks.problem(BdSignInBox.email, 'a@b', newPassword: false), startsWith('Enter a full email'));
      expect(BdSignInChecks.problem(BdSignInBox.email, ' a@b.co ', newPassword: false), isNull);
    });

    test('a password signing in only needs to be there; a new one needs 10', () {
      expect(BdSignInChecks.problem(BdSignInBox.password, 'short', newPassword: false), isNull);
      expect(BdSignInChecks.problem(BdSignInBox.password, '', newPassword: false), 'Enter your password.');
      expect(BdSignInChecks.problem(BdSignInBox.password, 'short', newPassword: true), startsWith('Use at least 10'));
      expect(BdSignInChecks.problem(BdSignInBox.newPassword, '0123456789', newPassword: false), isNull);
    });

    test('code is six digits', () {
      expect(BdSignInChecks.problem(BdSignInBox.code, '12345', newPassword: false), isNotNull);
      expect(BdSignInChecks.problem(BdSignInBox.code, '123456', newPassword: false), isNull);
    });

    test("BD's answers about one box go under it", () {
      expect(BdSignInChecks.boxFor('invalid_code', [BdSignInBox.code]), BdSignInBox.code);
      expect(BdSignInChecks.boxFor('weak_password', [BdSignInBox.email, BdSignInBox.password]), BdSignInBox.password);
      expect(BdSignInChecks.boxFor('invalid_credentials', [BdSignInBox.email]), isNull);
    });
  });

  group('BdSignInPalette', () {
    test('the primary exactly as set, with text that reads on it', () {
      final palette = BdSignInPalette.from('#ffcc00', null)!;
      expect(palette.accent, const Color(0xffffcc00));
      expect(palette.onAccent, const Color(0xff111827));
      expect(BdSignInPalette.from('#123', null)!.accent, const Color(0xff112233));
      expect(BdSignInPalette.from('blue', null), isNull);
    });

    test('links use the secondary, made legible on light and dark', () {
      final palette = BdSignInPalette.from('#000000', '#ffff00')!;
      // Pure yellow fails 4.5:1 on white, so it darkens; on near-black it reads already.
      expect(palette.linkLight, isNot(const Color(0xffffff00)));
      expect(palette.linkDark, const Color(0xffffff00));
    });
  });

  test('PKCE challenge is the S256 of the verifier', () {
    final pair = bdNewPkcePair();
    expect(pair.verifier.length, 43);
    final expected = base64Url.encode(crypto.sha256.convert(ascii.encode(pair.verifier)).bytes).replaceAll('=', '');
    expect(pair.challenge, expected);
  });

  group('BdSignInController', () {
    late _FakeBackend backend;
    late List<BdSignInSession> signedIn;
    BdSignInController make({BdWebAuthenticate? authenticate}) => BdSignInController(
          backend: backend,
          onSignedIn: signedIn.add,
          authenticate: authenticate,
          callbackScheme: authenticate == null ? null : 'bdstarter',
        );

    setUp(() {
      backend = _FakeBackend();
      signedIn = [];
    });

    test('loads the name; nothing is sent while a box is wrong', () async {
      final c = make();
      await c.load();
      expect(c.title, 'Sign in to Acme');
      await c.submit();
      expect(c.error(BdSignInBox.email), 'Enter your email.');
      expect(c.focus, BdSignInBox.email);
      expect(backend.calls, ['options']);
    });

    test('leaving a box checks it only once typed in', () {
      final c = make();
      c.blur(BdSignInBox.email);
      expect(c.error(BdSignInBox.email), isNull);
      c.setValue(BdSignInBox.email, 'nope');
      c.blur(BdSignInBox.email);
      expect(c.error(BdSignInBox.email), isNotNull);
      c.setValue(BdSignInBox.email, 'a@b.co');
      expect(c.error(BdSignInBox.email), isNull);
    });

    test('password sign-in signs in', () async {
      final c = make()
        ..setValue(BdSignInBox.email, 'a@b.co')
        ..setValue(BdSignInBox.password, 'pw');
      await c.submit();
      expect(signedIn.single.sessionToken, 'tok');
    });

    test('an unconfirmed email goes to the code, which submits itself at six digits', () async {
      backend.answerSignIn = const BdConfirmEmail(_FakeBackend.sent);
      final c = make()
        ..setValue(BdSignInBox.email, 'a@b.co')
        ..setValue(BdSignInBox.password, 'pw');
      await c.submit();
      expect(c.step, isA<BdSignInStepCode>());
      expect(c.subtitle, 'We sent a 6-digit code to a@b.co.');
      c.setValue(BdSignInBox.code, '12-34-56');
      await pumpEventQueue();
      expect(backend.calls.last, 'verify p1 123456 null');
      expect(signedIn, hasLength(1));
    });

    test('create account sends a code; BD refusing the code shows under the box', () async {
      final c = make()..follow(BdSignInLink.createAccount);
      c
        ..setValue(BdSignInBox.firstName, ' Ada ')
        ..setValue(BdSignInBox.email, 'a@b.co')
        ..setValue(BdSignInBox.password, 'long enough pw');
      await c.submit();
      expect(backend.calls.last, 'signUp a@b.co Ada');
      backend.failWith = const BdSignInException('invalid_code', 'That code is wrong.');
      c.setValue(BdSignInBox.code, '000000');
      await pumpEventQueue();
      expect(c.error(BdSignInBox.code), 'That code is wrong.');
      expect(signedIn, isEmpty);
    });

    test('providers show only with a browser to open them in', () async {
      final none = make();
      await none.load();
      expect(none.providers, isEmpty);
      final c = make(authenticate: (url, scheme) async => Uri.parse('$scheme://bd-oauth?bd_oauth_code=abc'));
      await c.load();
      expect(c.providers, [BdOAuthProvider.github]);
      await c.continueWith(BdOAuthProvider.github);
      expect(backend.calls, containsAllInOrder(['oauthStart github bdstarter://bd-oauth', 'oauthFinish abc']));
      expect(signedIn, hasLength(1));
    });

    test('a closed browser is not a problem; a failed provider is', () async {
      final closed = make(authenticate: (_, _) async => throw const BdSignInCancelled());
      await closed.load();
      await closed.continueWith(BdOAuthProvider.github);
      expect(closed.problem, isNull);
      final failed = make(
        authenticate: (url, scheme) async => Uri.parse('$scheme://bd-oauth?bd_oauth_error=failed&bd_oauth_message=Nope.'),
      );
      await failed.load();
      await failed.continueWith(BdOAuthProvider.github);
      expect(failed.problem, 'Nope.');
      expect(signedIn, isEmpty);
    });
  });

  testWidgets('BdSignIn: BD\'s name and colour, box checks, and a password sign-in', (tester) async {
    final backend = _FakeBackend()
      ..answerOptions = const BdSignInOptions(name: 'Acme', primaryColor: '#0055ff', oauth: [BdOAuthProvider.google]);
    final signedIn = <BdSignInSession>[];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: BdSignIn(
          backend: backend,
          onSignedIn: signedIn.add,
          controls: BdControlStyle.material,
          authenticate: (url, scheme) async => Uri.parse('$scheme://bd-oauth?bd_oauth_code=abc'),
          callbackScheme: 'bdstarter',
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to Acme'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);

    final button = find.widgetWithText(FilledButton, 'Sign in');
    expect(tester.widget<FilledButton>(button).style?.backgroundColor?.resolve({}), const Color(0xff0055ff));
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('Enter your email.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Email'), 'a@b.co');
    await tester.enterText(find.widgetWithText(TextField, 'Password'), 'pw');
    await tester.pump();
    expect(find.text('Enter your email.'), findsNothing);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(signedIn.single.user.email, 'a@b.co');
  });

  group('BdBusinessDashSignInBackend', () {
    test('calls auth/customer with the publishable key; passes BD refusals on', () async {
      late http.Request seen;
      final backend = BdBusinessDashSignInBackend(
        publishableKey: 'pk_test_1',
        host: Uri.parse('https://bd.example'),
        httpClient: MockClient((request) async {
          seen = request;
          return http.Response(jsonEncode({'error': 'invalid_credentials', 'message': 'Wrong email or password.'}), 401);
        }),
      );
      await expectLater(
        backend.signIn('a@b.co', 'x'),
        throwsA(isA<BdSignInException>().having((e) => e.message, 'message', 'Wrong email or password.')),
      );
      expect(seen.url.toString(), 'https://bd.example/api/package/v1/auth/customer/sign-in');
      expect(seen.headers['Authorization'], 'Bearer pk_test_1');
    });

    test('options: providers, colours and logo', () async {
      final backend = BdBusinessDashSignInBackend(
        publishableKey: 'pk_test_1',
        httpClient: MockClient((_) async => http.Response(
              jsonEncode({
                'name': 'Acme',
                'password': true,
                'oauth': ['google', 'myspace', 'discord'],
                'primaryColor': '#0055ff',
                'logoUrl': 'https://cdn.example/logo.png',
              }),
              200,
            )),
      );
      final options = await backend.options();
      expect(options.oauth, [BdOAuthProvider.google, BdOAuthProvider.discord]);
      expect(options.primaryColor, '#0055ff');
      expect(options.logoUrl, 'https://cdn.example/logo.png');
    });
  });
}
