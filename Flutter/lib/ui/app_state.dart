import 'dart:convert';

import 'package:businessdash_forms/businessdash_forms.dart'
    show BdSignInSession;
import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The app's tabs, in order.
enum AppTab { shop, cart, blog, chat, form, quiz, account }

/// What a saved list keeps of a product: enough to draw a card without a
/// fetch.
class SavedProduct {
  const SavedProduct(
      {required this.id, required this.name, this.image, this.priceCents});

  final String id;
  final String name;
  final String? image;

  /// **Integer cents.**
  final int? priceCents;

  Map<String, Object?> toJson() =>
      {'id': id, 'name': name, 'image': image, 'priceCents': priceCents};

  static SavedProduct? fromJson(Object? json) {
    if (json is! Map ||
        json['id'] is! String ||
        (json['id'] as String).isEmpty) {
      return null;
    }
    return SavedProduct(
      id: json['id'] as String,
      name: json['name'] is String ? json['name'] as String : '',
      image: json['image'] is String ? json['image'] as String : null,
      priceCents: json['priceCents'] is num
          ? (json['priceCents'] as num).toInt()
          : null,
    );
  }

  factory SavedProduct.fromCard(Product product) => SavedProduct(
        id: product.id,
        name: product.name,
        image: product.coverImage,
        priceCents: product.cheapestPriceCents,
      );
}

/// A list kept on the device: the wishlist, the compare picks, recently
/// viewed. Nothing reaches the server; a wishlist that follows a signed-in
/// customer between devices would need a table of its own. The web
/// starters keep the same three lists, with the same limits.
class SavedList {
  SavedList._(this._key, this.limit, this._prefs, this._changed)
      : _items = _read(_prefs, _key, limit);

  final String _key;
  final int limit;
  final SharedPreferences? _prefs;
  final VoidCallback _changed;
  List<SavedProduct> _items;

  List<SavedProduct> get items => List.unmodifiable(_items);
  bool get isFull => _items.length >= limit;
  bool contains(String id) => _items.any((item) => item.id == id);

  /// Adds or removes; returns whether it is in the list afterwards. A full
  /// list (compare holds four) adds nothing.
  bool toggle(SavedProduct product) {
    if (contains(product.id)) {
      _set(_items.where((item) => item.id != product.id).toList());
      return false;
    }
    if (isFull) return false;
    _set([..._items, product]);
    return true;
  }

  /// Puts it first (recently viewed), dropping the oldest past the limit.
  void add(SavedProduct product) =>
      _set([product, ..._items.where((item) => item.id != product.id)]);

  void remove(String id) =>
      _set(_items.where((item) => item.id != id).toList());

  void clear() => _set([]);

  void _set(List<SavedProduct> next) {
    _items = next.take(limit).toList();
    // A failed write just doesn't persist; the list on screen is right.
    _prefs?.setString(
        _key, jsonEncode(_items.map((item) => item.toJson()).toList()));
    _changed();
  }

  static List<SavedProduct> _read(
      SharedPreferences? prefs, String key, int limit) {
    try {
      final raw = prefs?.getString(key);
      final decoded = raw == null ? const [] : jsonDecode(raw);
      return (decoded is List ? decoded : const [])
          .map(SavedProduct.fromJson)
          .whereType<SavedProduct>()
          .take(limit)
          .toList();
    } on FormatException {
      return [];
    }
  }
}

/// App-wide state the screens share: the tab, the signed-in customer's
/// session, how many things are in the cart (the Cart tab's badge), and the
/// saved lists.
class AppState extends ChangeNotifier {
  AppState({SharedPreferences? prefs}) {
    wishlist = SavedList._('bd.wishlist', 60, prefs, notifyListeners);
    compare = SavedList._('bd.compare', 4, prefs, notifyListeners);
    recentlyViewed =
        SavedList._('bd.recently-viewed', 12, prefs, notifyListeners);
  }

  late final SavedList wishlist;

  /// The compare table fits four.
  late final SavedList compare;
  late final SavedList recentlyViewed;

  AppTab _tab = AppTab.shop;
  AppTab get tab => _tab;
  set tab(AppTab value) {
    if (value == _tab) return;
    _tab = value;
    notifyListeners();
  }

  /// The signed-in customer, set by the Account tab. A real app keeps
  /// `sessionToken` in the Keychain / Keystore (flutter_secure_storage) so a
  /// sign-in survives a relaunch. Liking, commenting and writing a review
  /// send it as `X-BD-Session-Token`.
  BdSignInSession? _session;
  BdSignInSession? get session => _session;
  set session(BdSignInSession? value) {
    if (identical(value, _session)) return;
    _session = value;
    notifyListeners();
  }

  String? get sessionToken => _session?.sessionToken;

  /// The business the customer signed in to; the portal needs it with the
  /// token.
  String? get organizationId => _session?.organizationId;
  bool get signedIn => sessionToken != null;

  /// Back to the tabs, on [tab]: "Sign in to …" goes to Account, "View
  /// cart" to Cart.
  void showTab(BuildContext context, AppTab tab) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    this.tab = tab;
  }

  int _cartCount = 0;
  int get cartCount => _cartCount;

  /// Every screen that changes the cart passes the cart it got back, so
  /// the badge follows without another fetch.
  void noteCart(CartSnapshot? cart) {
    final count = cart?.units ?? 0;
    if (count == _cartCount) return;
    _cartCount = count;
    notifyListeners();
  }
}

/// Hands [AppState] down the tree; reading it rebuilds on change.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found in the widget tree.');
    return scope!.notifier!;
  }

  /// For a callback (a button's onPressed): no rebuild on change.
  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found in the widget tree.');
    return scope!.notifier!;
  }
}
