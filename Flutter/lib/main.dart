import 'package:flutter/material.dart';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'ui/account_page.dart';
import 'ui/bd_scope.dart';
import 'ui/cart_page.dart';
import 'ui/chat_page.dart';
import 'ui/form_page.dart';
import 'ui/quiz_page.dart';
import 'ui/storefront_page.dart';

/// Configuration comes from `--dart-define`, not a `.env` file — there is no
/// env in an APK or IPA, and dart-defines are compiled in, which is exactly
/// what an app credential is.
///
///     flutter run \
///       --dart-define=BD_SITE_ID=… \
///       --dart-define=BD_PK=pk_… \
///       --dart-define=BD_FORM=contact   # optional: the Form tab's live form
///       --dart-define=BD_QUIZ=onboarding   # optional: the Quiz tab's practice quiz
const _host = String.fromEnvironment('BD_HOST', defaultValue: 'https://businessdash.us');
const _siteId = String.fromEnvironment('BD_SITE_ID');
const _publishableKey = String.fromEnvironment('BD_PK');
const _form = String.fromEnvironment('BD_FORM');
const _quiz = String.fromEnvironment('BD_QUIZ');

void main() => runApp(const BdStarterApp());

class BdStarterApp extends StatelessWidget {
  const BdStarterApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Null when unconfigured. Every screen falls back rather than crashing —
    // `flutter run` on a fresh clone should still launch.
    final client = (_siteId.isEmpty || _publishableKey.isEmpty)
        ? null
        : BdClient(
            host: Uri.parse(_host),
            publishableKey: _publishableKey,
            siteId: _siteId,
          );

    return MaterialApp(
      title: 'BD Flutter starter',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: BdScope(
        client: client,
        // A real app persists this (shared_preferences) so a cart survives a
        // relaunch. It is an opaque id, not a secret.
        visitorToken: DateTime.now().microsecondsSinceEpoch.toString(),
        child: const _Home(),
      ),
    );
  }
}

class _Home extends StatefulWidget {
  const _Home();

  @override
  State<_Home> createState() => _HomeState();
}

class _HomeState extends State<_Home> {
  int _index = 0;

  static const _pages = [
    StorefrontPage(),
    CartPage(),
    ChatPage(),
    FormPage(host: _host, publishableKey: _publishableKey, form: _form),
    QuizPage(host: _host, publishableKey: _publishableKey, quiz: _quiz),
    AccountPage(host: _host, publishableKey: _publishableKey),
  ];

  @override
  Widget build(BuildContext context) {
    final configured = BdScope.of(context).isConfigured;

    return Scaffold(
      body: Column(
        children: [
          if (!configured)
            // The banner takes the status bar's space, so the page below
            // doesn't pad for it again.
            Container(
              width: double.infinity,
              color: Colors.amber.withValues(alpha: 0.25),
              child: const SafeArea(
                bottom: false,
                child: Padding(
                  padding: EdgeInsets.all(8),
                  child: Text(
                    'Not connected to BD — pass --dart-define=BD_SITE_ID and BD_PK.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ),
            ),
          Expanded(
            child: MediaQuery.removePadding(context: context, removeTop: !configured, child: _pages[_index]),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.storefront), label: 'Shop'),
          NavigationDestination(icon: Icon(Icons.shopping_cart), label: 'Cart'),
          NavigationDestination(icon: Icon(Icons.chat_bubble), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.assignment), label: 'Form'),
          NavigationDestination(icon: Icon(Icons.quiz), label: 'Quiz'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}
