import 'package:businessdash_forms/businessdash_forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

/// The app's URL scheme. "Continue with Google / Apple / GitHub / Discord"
/// comes back to `bdstarter://bd-oauth`; on Android, flutter_web_auth_2's
/// `CallbackActivity` has to be registered for it in AndroidManifest.xml
/// (see the README). iOS needs nothing.
const bdCallbackScheme = 'bdstarter';

/// The customer's account. Signed out, it's the business's own sign-in
/// screen (`BdSignIn` from businessdash_forms): its name, logo and brand
/// colours from BD; password, emailed codes, and the provider links the
/// business has switched on — WorkOS underneath, through BD's
/// `auth/customer/*` routes, with the publishable key.
class AccountPage extends StatefulWidget {
  const AccountPage({super.key, required this.host, required this.publishableKey});

  final String host;
  final String publishableKey;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  late final BdSignInBackend? _backend = widget.publishableKey.isEmpty
      ? null
      : BdBusinessDashSignInBackend(publishableKey: widget.publishableKey, host: Uri.parse(widget.host));

  // A real app keeps `session.sessionToken` in the Keychain / Keystore
  // (flutter_secure_storage) so a sign-in survives a relaunch, and sends it
  // as `X-BD-Session-Token` on customer-portal calls.
  BdSignInSession? _session;

  /// The browser's own sign-in (ASWebAuthenticationSession / a Custom Tab),
  /// back on [scheme] with the result.
  Future<Uri> _authenticate(Uri url, String scheme) async {
    try {
      return Uri.parse(await FlutterWebAuth2.authenticate(url: url.toString(), callbackUrlScheme: scheme));
    } on PlatformException catch (error) {
      if (error.code == 'CANCELED') throw const BdSignInCancelled();
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final backend = _backend;
    final session = _session;
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: switch ((backend, session)) {
        (null, _) => const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Pass --dart-define=BD_PK to sign in.', textAlign: TextAlign.center),
            ),
          ),
        (final backend?, null) => BdSignIn(
            backend: backend,
            tagline: 'Sign in to see your jobs, quotes and invoices.',
            authenticate: _authenticate,
            callbackScheme: bdCallbackScheme,
            onSignedIn: (signedIn) => setState(() => _session = signedIn),
          ),
        (_, final session?) => Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: 12,
              children: [
                Text('Signed in as ${session.user.email ?? 'a customer'}.'),
                FilledButton.tonal(
                  onPressed: () => setState(() => _session = null),
                  child: const Text('Sign out'),
                ),
              ],
            ),
          ),
      },
    );
  }
}
