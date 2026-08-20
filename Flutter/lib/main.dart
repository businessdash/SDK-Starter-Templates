import 'package:flutter/material.dart';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'ui/biab_scope.dart';
import 'ui/cart_page.dart';
import 'ui/chat_page.dart';
import 'ui/storefront_page.dart';

/// Configuration comes from `--dart-define`, not a `.env` file — there is no
/// env in an APK or IPA, and dart-defines are compiled in, which is exactly
/// what an app credential is.
///
///     flutter run \
///       --dart-define=BIAB_SITE_ID=… \
///       --dart-define=BIAB_PK=pk_…
const _host = String.fromEnvironment('BIAB_HOST', defaultValue: 'https://www.biab.app');
const _siteId = String.fromEnvironment('BIAB_SITE_ID');
const _publishableKey = String.fromEnvironment('BIAB_PK');

void main() => runApp(const BiabStarterApp());

class BiabStarterApp extends StatelessWidget {
  const BiabStarterApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Null when unconfigured. Every screen falls back rather than crashing —
    // `flutter run` on a fresh clone should still launch.
    final client = (_siteId.isEmpty || _publishableKey.isEmpty)
        ? null
        : BiabClient(
            host: Uri.parse(_host),
            publishableKey: _publishableKey,
            siteId: _siteId,
          );

    return MaterialApp(
      title: 'BIAB Flutter starter',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: BiabScope(
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

  static const _pages = [StorefrontPage(), CartPage(), ChatPage()];

  @override
  Widget build(BuildContext context) {
    final configured = BiabScope.of(context).isConfigured;

    return Scaffold(
      body: Column(
        children: [
          if (!configured)
            Container(
              width: double.infinity,
              color: Colors.amber.withValues(alpha: 0.25),
              padding: const EdgeInsets.all(8),
              child: const Text(
                'Not connected to BIAB — pass --dart-define=BIAB_SITE_ID and BIAB_PK.',
                style: TextStyle(fontSize: 12),
              ),
            ),
          Expanded(child: _pages[_index]),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.storefront), label: 'Shop'),
          NavigationDestination(icon: Icon(Icons.shopping_cart), label: 'Cart'),
          NavigationDestination(icon: Icon(Icons.chat_bubble), label: 'Chat'),
        ],
      ),
    );
  }
}
