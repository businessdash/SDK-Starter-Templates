import 'dart:math';

import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ui/account_page.dart';
import 'ui/app_state.dart';
import 'ui/bd_scope.dart';
import 'ui/blog_page.dart';
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
///       --dart-define=BD_SITE_URL=https://…   # optional: a product's "Copy link"
const _host =
    String.fromEnvironment('BD_HOST', defaultValue: 'https://businessdash.us');
const _siteId = String.fromEnvironment('BD_SITE_ID');
const _publishableKey = String.fromEnvironment('BD_PK');
const _form = String.fromEnvironment('BD_FORM');
const _quiz = String.fromEnvironment('BD_QUIZ');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SharedPreferences? prefs;
  try {
    prefs = await SharedPreferences.getInstance();
  } on Exception {
    // No storage: the cart and saved lists last until the app closes.
  }
  runApp(BdStarterApp(
      visitorToken: _visitorToken(prefs), state: AppState(prefs: prefs)));
}

/// A stable per-install id for the cart, kept on the device so a cart
/// survives a relaunch. It is an opaque id, not a secret.
String _visitorToken(SharedPreferences? prefs) {
  const key = 'bd.visitor';
  final kept = prefs?.getString(key);
  if (kept != null && kept.isNotEmpty) return kept;
  final random = Random.secure();
  final token = List.generate(
      16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  prefs?.setString(key, token);
  return token;
}

class BdStarterApp extends StatelessWidget {
  const BdStarterApp(
      {super.key,
      required this.visitorToken,
      required this.state,
      this.client});

  final String visitorToken;
  final AppState state;

  /// Tests pass a client of their own; the app builds one from the
  /// dart-defines.
  final BdClient? client;

  @override
  Widget build(BuildContext context) {
    // Null when unconfigured. Every screen falls back rather than crashing —
    // `flutter run` on a fresh clone should still launch.
    final client = this.client ??
        ((_siteId.isEmpty || _publishableKey.isEmpty)
            ? null
            : BdClient(
                host: Uri.parse(_host),
                publishableKey: _publishableKey,
                siteId: _siteId,
              ));

    return MaterialApp(
      title: 'BD Flutter starter',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      // Above the navigator, so pushed screens (a product, a post) see them
      // too.
      builder: (context, child) => AppScope(
        state: state,
        child:
            BdScope(client: client, visitorToken: visitorToken, child: child!),
      ),
      home: const _Home(),
    );
  }
}

class _Home extends StatefulWidget {
  const _Home();

  @override
  State<_Home> createState() => _HomeState();
}

class _HomeState extends State<_Home> {
  bool _countedCart = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_countedCart) return;
    _countedCart = true;
    // The Cart tab's badge, from the cart this device already has.
    final scope = BdScope.of(context);
    final app = AppScope.read(context);
    scope.client
        ?.cart(scope.visitorToken)
        .then(app.noteCart, onError: (Object _) {});
  }

  static Widget _page(AppTab tab) => switch (tab) {
        AppTab.shop => const StorefrontPage(),
        AppTab.cart => const CartPage(),
        AppTab.blog => const BlogTab(),
        AppTab.chat => const ChatPage(),
        AppTab.form => const FormPage(
            host: _host, publishableKey: _publishableKey, form: _form),
        AppTab.quiz => const QuizPage(
            host: _host, publishableKey: _publishableKey, quiz: _quiz),
        AppTab.account =>
          const AccountPage(host: _host, publishableKey: _publishableKey),
      };

  @override
  Widget build(BuildContext context) {
    final configured = BdScope.of(context).isConfigured;
    final app = AppScope.of(context);
    final inCart = app.cartCount;

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
            child: MediaQuery.removePadding(
                context: context,
                removeTop: !configured,
                child: _page(app.tab)),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: app.tab.index,
        // Seven tabs: names under the chosen one only, so none are cut.
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        onDestinationSelected: (index) => app.tab = AppTab.values[index],
        destinations: [
          const NavigationDestination(
              icon: Icon(Icons.storefront), label: 'Shop'),
          NavigationDestination(
            icon: Badge.count(
                count: inCart,
                isLabelVisible: inCart > 0,
                child: const Icon(Icons.shopping_cart)),
            label: 'Cart',
          ),
          const NavigationDestination(icon: Icon(Icons.article), label: 'Blog'),
          const NavigationDestination(
              icon: Icon(Icons.chat_bubble), label: 'Chat'),
          const NavigationDestination(
              icon: Icon(Icons.assignment), label: 'Form'),
          const NavigationDestination(icon: Icon(Icons.quiz), label: 'Quiz'),
          const NavigationDestination(
              icon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}
