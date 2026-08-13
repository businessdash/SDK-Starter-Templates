import 'package:flutter/widgets.dart';

import 'package:biab/biab.dart';

/// App-wide BIAB state, handed down the tree.
///
/// `configuration` is nullable on purpose: when the app hasn't been given a
/// site id and key, screens render local fallbacks and a setup notice rather
/// than empty lists. A starter you can't run before signing up isn't a
/// starter.
class BiabScope extends InheritedWidget {
  const BiabScope({
    super.key,
    required this.client,
    required this.visitorToken,
    required super.child,
  });

  /// Null until configured.
  final BiabClient? client;

  /// Stable per-install id for the cart. Generated locally — there is no
  /// endpoint that mints one, and the platform keys the cart on whatever
  /// arrives in `X-BIAB-Cart-Visitor`. It is NOT a secret, so ordinary
  /// storage is correct for it.
  final String visitorToken;

  bool get isConfigured => client != null;

  static BiabScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<BiabScope>();
    assert(scope != null, 'No BiabScope found in the widget tree.');
    return scope!;
  }

  @override
  bool updateShouldNotify(BiabScope oldWidget) =>
      client != oldWidget.client || visitorToken != oldWidget.visitorToken;
}
