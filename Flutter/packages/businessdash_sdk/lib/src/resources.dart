import 'client.dart';
import 'models.dart';

/// The read/write surface, grouped the way the other starters group it.
extension BdResources on BdClient {
  // ── Storefront ────────────────────────────────────────────────────────

  Future<List<Product>> products({int? limit}) async {
    final body = await get('storefront/products',
        query: {'limit': limit?.toString()});
    return ((body['items'] as List?) ?? [])
        .map((p) => Product.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// The full shop grid: enriched cards plus `categoryCounts` and the
  /// catalog-wide `priceRange` for a filter UI.
  ///
  /// `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
  Future<List<Product>> productGrid({String? search, String? sort}) async {
    final body = await get('storefront/products', query: {
      'meta': '1',
      'search': (search?.isEmpty ?? true) ? null : search,
      'sort': sort,
      'limit': '24',
    });
    return ((body['items'] as List?) ?? [])
        .map((p) => Product.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<Product> product(String id) async =>
      Product.fromJson(await get('storefront/products/${Uri.encodeComponent(id)}'));

  // ── Cart + checkout ───────────────────────────────────────────────────

  Map<String, String> _cartHeaders(String visitorToken) =>
      {'X-BD-Cart-Visitor': visitorToken};

  Future<CartSnapshot> cart(String visitorToken) async =>
      CartSnapshot.fromJson(await get('cart', headers: _cartHeaders(visitorToken)));

  Future<CartSnapshot> cartAdd(
    String visitorToken, {
    required String productId,
    int quantity = 1,
  }) async =>
      CartSnapshot.fromJson(await post(
        'cart/items',
        body: {'productId': productId, 'quantity': quantity},
        headers: _cartHeaders(visitorToken),
      ));

  Future<CartSnapshot> cartSetQuantity(
    String visitorToken, {
    required String itemId,
    required int quantity,
  }) async =>
      CartSnapshot.fromJson(await patch(
        'cart/items/${Uri.encodeComponent(itemId)}',
        body: {'quantity': quantity},
        headers: _cartHeaders(visitorToken),
      ));

  Future<CartSnapshot> cartRemove(String visitorToken, String itemId) async =>
      CartSnapshot.fromJson(await delete(
        'cart/items/${Uri.encodeComponent(itemId)}',
        headers: _cartHeaders(visitorToken),
      ));

  /// Hand off to Stripe. Open [CheckoutSession.stripeUrl] in a browser — no
  /// card data touches this process, which keeps the app out of PCI scope.
  Future<CheckoutSession> startCheckout(
    String visitorToken, {
    required String successUrl,
    required String cancelUrl,
  }) async =>
      CheckoutSession.fromJson(await post(
        'checkout/start',
        body: {'successUrl': successUrl, 'cancelUrl': cancelUrl},
        headers: _cartHeaders(visitorToken),
      ));

  // ── Content ───────────────────────────────────────────────────────────

  Future<List<BlogPost>> posts({int limit = 20}) async {
    final body = await get('blog/posts', query: {'limit': '$limit'});
    return ((body['items'] as List?) ?? [])
        .map((p) => BlogPost.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<List<Review>> reviews({int limit = 10, int offset = 0}) async {
    final body = await get('reviews', query: {'limit': '$limit', 'offset': '$offset'});
    return ((body['items'] as List?) ?? [])
        .map((r) => Review.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<List<SubscriptionPlan>> subscriptionPlans() async {
    final body = await get('subscriptions');
    return ((body['items'] as List?) ?? [])
        .map((s) => SubscriptionPlan.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Schema-driven, so this returns the raw map — read it with the
  /// `BdBundle` extension and always supply a local fallback.
  Future<Map<String, dynamic>> pageBundle([String pageKey = 'home']) =>
      get(sitePath('marketing/bundle'), query: {'pageKey': pageKey});

  // ── Forms ─────────────────────────────────────────────────────────────

  /// The one surface a native app genuinely reimplements: `<bd-form>` is a
  /// DOM web component with no Flutter counterpart, so the app fetches the
  /// schema and renders it with its own widgets.
  Future<FormSchema> formSchema(String slug) async =>
      FormSchema.fromJson(await get('forms/${Uri.encodeComponent(slug)}'));

  /// Also the documented CREATE path for a custom collection — point a form's
  /// output at the collection and post here. There is deliberately no direct
  /// row-insert API, which keeps validation on the platform.
  Future<bool> submitForm(
    String slug, {
    required Map<String, String> data,
    String? submitterEmail,
  }) async {
    final body = await post('forms/${Uri.encodeComponent(slug)}', body: {
      'data': data,
      if (submitterEmail != null) 'submitterEmail': submitterEmail,
      'source': 'flutter-app',
    });
    return body['ok'] as bool? ?? false;
  }

  // ── Custom database ───────────────────────────────────────────────────

  /// `object` is the object's `universalIdentifier`, NOT its display name:
  /// the name can be renamed in the dashboard without breaking this code.
  ///
  /// Reads need `metadata:read_records` on the key, and a publishable token
  /// only ever sees objects marked `public`.
  Future<List<DataModelRecord>> records(String object, {int limit = 200}) async {
    final all = <DataModelRecord>[];
    String? cursor;

    // Bounded so a malformed cursor can't spin forever.
    for (var page = 0; page < 50; page++) {
      final body = await get(sitePath('data-model/records'), query: {
        'object': object,
        'limit': '$limit',
        'cursor': cursor,
      });

      all.addAll(((body['records'] as List?) ?? [])
          .map((r) => DataModelRecord.fromJson(r as Map<String, dynamic>)));

      cursor = body['nextCursor'] as String?;
      if (cursor == null) break;
    }

    return all;
  }
}
