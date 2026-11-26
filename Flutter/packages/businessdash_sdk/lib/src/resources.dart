import 'client.dart';
import 'models.dart';
import 'reviews.dart';
import 'shop.dart';

/// The read/write surface, grouped the way the other starters group it.
extension BdResources on BdClient {
  // ── Storefront ────────────────────────────────────────────────────────

  Future<List<Product>> products({int? limit}) async {
    final body =
        await get('storefront/products', query: {'limit': limit?.toString()});
    return ((body['items'] as List?) ?? [])
        .map((p) => Product.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// The full shop grid: enriched cards plus `categoryCounts` and the
  /// catalog-wide `priceRange` for a filter UI.
  ///
  /// `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
  Future<List<Product>> productGrid({String? search, String? sort}) async =>
      (await productListing(search: search, sort: sort)).items;

  /// The store grid with its filters, and what a filter UI needs: each
  /// category's count and the catalogue's price range.
  ///
  /// Prices filter in **cents**. `sort` is one of featured | newest |
  /// price-asc | price-desc | rating-desc; `minRating` is whole stars.
  Future<ProductListing> productListing({
    String? search,
    String? categoryId,
    int? minPriceCents,
    int? maxPriceCents,
    int? minRating,
    String? sort,
    int limit = 24,
  }) async =>
      ProductListing.fromJson(await get('storefront/products', query: {
        'meta': '1',
        'search': (search?.isEmpty ?? true) ? null : search,
        'categoryId': categoryId,
        'minPriceCents': minPriceCents?.toString(),
        'maxPriceCents': maxPriceCents?.toString(),
        'minRating': minRating?.toString(),
        'sort': sort,
        'limit': '$limit',
      }));

  Future<List<ProductCategory>> categories() async {
    final body = await get('storefront/categories');
    return ((body['items'] as List?) ?? [])
        .map((c) => ProductCategory.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<Product> product(String id) async => Product.fromJson(
      await get('storefront/products/${Uri.encodeComponent(id)}'));

  /// One product shaped for its page: photos per style, option groups,
  /// prices and specs (see [ProductView]).
  Future<ProductView> productDetail(String id) async => ProductView.fromJson(
      await get('storefront/products/${Uri.encodeComponent(id)}'));

  Future<List<RelatedProduct>> relatedProducts(String id,
      {int limit = 6}) async {
    final body = await get(
        'storefront/products/${Uri.encodeComponent(id)}/related',
        query: {'limit': '$limit'});
    return ((body['items'] as List?) ?? [])
        .map((p) => RelatedProduct.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// A product's own reviews, newest first. "Show more" asks for a longer
  /// page (up to 100).
  Future<ProductReviewPage> productReviews(String id, {int limit = 10}) async =>
      ProductReviewPage.fromJson(await get(
          'storefront/products/${Uri.encodeComponent(id)}/reviews',
          query: {'limit': '$limit'}));

  Future<List<ProductAddon>> productAddons(String id) async {
    final body =
        await get('storefront/products/${Uri.encodeComponent(id)}/addons');
    return ((body['items'] as List?) ?? [])
        .map((a) => ProductAddon.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  // ── Cart + checkout ───────────────────────────────────────────────────

  Map<String, String> _cartHeaders(String visitorToken) =>
      {'X-BD-Cart-Visitor': visitorToken};

  Future<CartSnapshot> cart(String visitorToken) async => CartSnapshot.fromJson(
      await get('cart', headers: _cartHeaders(visitorToken)));

  /// [options] are the chosen option groups, `{'Size': 'M'}`
  /// ([ProductView.chosenOptions]).
  Future<CartSnapshot> cartAdd(
    String visitorToken, {
    required String productId,
    String? variantId,
    Map<String, String>? options,
    int quantity = 1,
  }) async =>
      CartSnapshot.fromJson(await post(
        'cart/items',
        body: {
          'productId': productId,
          'quantity': quantity,
          if (variantId != null) 'variantId': variantId,
          if (options != null && options.isNotEmpty) 'options': options,
        },
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

  /// A code the business doesn't have answers 400 ([BdHttpException]) with
  /// a message to show.
  Future<CartSnapshot> cartApplyCoupon(
          String visitorToken, String code) async =>
      CartSnapshot.fromJson(await post('cart/coupon',
          body: {'code': code}, headers: _cartHeaders(visitorToken)));

  Future<CartSnapshot> cartRemoveCoupon(String visitorToken) async =>
      CartSnapshot.fromJson(
          await delete('cart/coupon', headers: _cartHeaders(visitorToken)));

  Future<CartSnapshot> cartClear(String visitorToken) async =>
      CartSnapshot.fromJson(
          await post('cart/clear', headers: _cartHeaders(visitorToken)));

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

  /// Back from Stripe: whether the order is paid.
  Future<CheckoutStatus> checkoutStatus(String sessionId) async =>
      CheckoutStatus.fromJson(
          await get('checkout/${Uri.encodeComponent(sessionId)}'));

  // ── Blog ──────────────────────────────────────────────────────────────
  //
  // Liking and commenting are done as the signed-in customer: their session
  // token goes out as `X-BD-Session-Token` (the portal's header, not the
  // `x-bd-session` that sign-in's `auth/me` takes).

  Map<String, String> _session(String? token) =>
      token == null ? const {} : {'X-BD-Session-Token': token};

  Future<List<BlogPost>> posts({int limit = 20}) async =>
      (await blogPage(limit: limit)).items;

  /// A page of posts; pass [BlogPage.nextCursor] back for the next.
  Future<BlogPage> blogPage(
          {int limit = 20, int? cursor, String? categoryId}) async =>
      BlogPage.fromJson(await get('blog/posts', query: {
        'limit': '$limit',
        'cursor': cursor?.toString(),
        'categoryId': categoryId,
      }));

  Future<List<BlogCategory>> blogCategories() async {
    final body = await get('blog/categories');
    return ((body['items'] as List?) ?? [])
        .map((c) => BlogCategory.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<List<String>> blogTags() async {
    final body = await get('blog/tags');
    return ((body['items'] as List?) ?? []).whereType<String>().toList();
  }

  /// One post. Signed in, a members-only post comes with its body.
  Future<BlogPostDetail> blogPost(String slug, {String? sessionToken}) async =>
      BlogPostDetail.fromJson(await get(
          'blog/posts/${Uri.encodeComponent(slug)}',
          headers: _session(sessionToken)));

  /// The like count, and whether this customer liked it (signed in).
  Future<PostLikes> postLikes(String slug, {String? sessionToken}) async =>
      PostLikes.fromJson(await get(
          'blog/posts/${Uri.encodeComponent(slug)}/like',
          headers: _session(sessionToken)));

  Future<PostLikes> togglePostLike(String slug,
          {required String sessionToken}) async =>
      PostLikes.fromJson(await post(
          'blog/posts/${Uri.encodeComponent(slug)}/like',
          headers: _session(sessionToken)));

  Future<List<BlogComment>> postComments(String slug, {int limit = 50}) async {
    final body = await get('blog/posts/${Uri.encodeComponent(slug)}/comments',
        query: {'limit': '$limit'});
    return ((body['items'] as List?) ?? [])
        .map((c) => BlogComment.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<CommentPosted> postComment(String slug, String content,
          {required String sessionToken}) async =>
      CommentPosted.fromJson(await post(
        'blog/posts/${Uri.encodeComponent(slug)}/comments',
        body: {'content': content},
        headers: _session(sessionToken),
      ));

  // ── Business reviews ──────────────────────────────────────────────────

  Future<List<Review>> reviews({int limit = 10, int offset = 0}) async =>
      (await reviewPage(limit: limit, offset: offset)).items;

  /// A page of the business's reviews, newest first. [source] is one of
  /// [Reviews.sources].
  Future<ReviewPage> reviewPage(
          {int limit = Reviews.pageSize,
          int offset = 0,
          String? source}) async =>
      ReviewPage.fromJson(await get('reviews', query: {
        'limit': '$limit',
        'offset': '$offset',
        'source': source,
      }));

  /// The average, the count and the count per star, from the marketing
  /// bundle; null when the business shows no reviews.
  Future<ReviewTotals?> reviewTotals() async {
    final bundle = await pageBundle();
    final reviews = bundle['reviews'];
    return reviews is Map<String, dynamic>
        ? ReviewTotals.fromJson(reviews)
        : null;
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
  Future<List<DataModelRecord>> records(String object,
      {int limit = 200}) async {
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
