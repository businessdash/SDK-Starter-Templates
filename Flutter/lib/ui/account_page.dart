import 'package:businessdash_forms/businessdash_forms.dart';
import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import 'app_state.dart';

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

  // Account calls belong to the business the key is for, not to a site, so
  // this client needs no site id.
  late final BdClient? _client = widget.publishableKey.isEmpty
      ? null
      : BdClient(host: Uri.parse(widget.host), publishableKey: widget.publishableKey, siteId: '');
  bool _deleting = false;

  static const _deleteFailed = "Your account couldn't be deleted just now. Please try again in a minute.";

  /// Asks, then deletes the customer's account with this business and signs
  /// them out here.
  Future<void> _confirmDelete(BdSignInSession session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text(
          "Your profile, saved settings and cart are deleted and you're signed out. This can't be undone.",
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    final client = _client;
    final token = session.sessionToken;
    if (confirmed != true || !mounted || client == null || token == null) return;

    setState(() => _deleting = true);
    String? problem;
    var signedOut = false;
    try {
      await client.deleteAccount(token);
      signedOut = true;
    } on BdHttpException catch (error) {
      signedOut = error.status == 401;
      problem = signedOut ? 'Your sign-in has expired. Sign in again, then delete your account.' : _deleteFailed;
    } on Exception {
      problem = _deleteFailed;
    }
    if (!mounted) return;
    setState(() => _deleting = false);
    if (signedOut) AppScope.read(context).session = null;
    if (problem != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(problem)));
    }
  }

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
    // The session lives in AppState: the blog and reviews send it too, and
    // it outlasts this tab. A real app keeps `session.sessionToken` in the
    // Keychain / Keystore (flutter_secure_storage) so a sign-in survives a
    // relaunch, and sends it as `X-BD-Session-Token` on customer-portal calls.
    final app = AppScope.of(context);
    final session = app.session;
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
            onSignedIn: (signedIn) => app.session = signedIn,
          ),
        (_, final session?) => Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: 12,
              children: [
                Text('Signed in as ${session.user.email ?? 'a customer'}.'),
                FilledButton.tonal(
                  onPressed: () => app.session = null,
                  child: const Text('Sign out'),
                ),
                // Google Play and the App Store require it in the app, not on a website.
                TextButton(
                  onPressed: _deleting ? null : () => _confirmDelete(session),
                  style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
                  child: const Text('Delete account'),
                ),
                Text(
                  'Deletes your account with us. Records of past orders and invoices stay with us, as the law asks.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
      },
    );
  }
}
