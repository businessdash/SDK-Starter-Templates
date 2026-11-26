import 'dart:convert';

import 'package:bd_starter/main.dart';
import 'package:bd_starter/ui/app_state.dart';
import 'package:businessdash_forms/businessdash_forms.dart'
    show BdSignInSession, BdSignInUser;
import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A small BD: a store with two categories, a cart that takes a coupon, a
/// blog, and fourteen business reviews. It records what the app sent.
class FakeBd {
  final requests = <http.Request>[];
  final cart = <Map<String, Object?>>[];
  String? coupon;
  var likes = 3;
  var liked = false;
  final comments = <Map<String, Object?>>[];
  Map<String, Object?>? review;

  static const products = [
    {
      'id': 'p1',
      'name': 'Trail Runner',
      'categoryId': 'c1',
      'cheapestPriceCents': 12000,
      'hasMultipleVariants': true,
      'isNew': true,
      'avgRating': 4.5,
      'reviewCount': 2
    },
    {
      'id': 'p2',
      'name': 'Road Racer',
      'categoryId': 'c1',
      'cheapestPriceCents': 9900,
      'isOnSale': true,
      'comparePriceCents': 11900
    },
    {
      'id': 'p3',
      'name': 'Wool Socks',
      'categoryId': 'c2',
      'cheapestPriceCents': 1800
    },
  ];

  static final reviews = [
    for (var i = 0; i < 14; i++)
      {
        'id': 'r$i',
        'source': i.isEven ? 'google' : 'yelp',
        'rating': i < 8 ? 5 : 4,
        'text': 'Review number $i',
        'reviewUrl':
            i == 0 ? 'javascript:alert(1)' : 'https://example.com/r/$i',
        'reviewerName': 'Customer $i',
        'reviewerImageUrl': null,
        'timeCreated': '2026-11-20T12:00:00Z',
        'verified': i < 3,
      },
  ];

  Map<String, Object?> _cart() => {
        'items': cart,
        'subtotal':
            cart.fold<num>(0, (sum, line) => sum + (line['subtotal'] as num)),
        'currency': 'USD',
        'couponCode': coupon,
        'itemCount':
            cart.fold<int>(0, (sum, line) => sum + (line['quantity'] as int)),
      };

  Future<http.Response> handle(http.Request request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/package/v1/', '');
    final query = request.url.queryParameters;
    final body = request.body.isEmpty
        ? const <String, Object?>{}
        : jsonDecode(request.body) as Map<String, Object?>;
    Object? answer;
    var status = 200;
    switch ((request.method, path)) {
      case ('GET', 'storefront/products'):
        final items = products.where((product) {
          final category = query['categoryId'];
          final search = query['search']?.toLowerCase();
          return (category == null || product['categoryId'] == category) &&
              (search == null ||
                  (product['name'] as String).toLowerCase().contains(search));
        }).toList();
        answer = {
          'items': items,
          'categoryCounts': [
            {'categoryId': 'c1', 'count': 2},
            {'categoryId': 'c2', 'count': 1},
          ],
          'priceRange': {'minDollars': 18, 'maxDollars': 120},
        };
      case ('GET', 'storefront/categories'):
        answer = {
          'items': [
            {'id': 'c1', 'name': 'Shoes'},
            {'id': 'c2', 'name': 'Socks'},
          ],
        };
      case ('GET', 'sites/site-1/marketing/bundle'):
        answer = {
          'reviews': {
            'rating': 4.6,
            'totalCount': 14,
            'counts': [
              {'rating': 5, 'count': 8},
              {'rating': 4, 'count': 6},
            ],
            'items': <Object>[],
          },
        };
      case ('GET', 'storefront/products/p1'):
        answer = {
          'id': 'p1',
          'name': 'Trail Runner',
          'description': 'Grippy and light.',
          'category': {'name': 'Shoes'},
          'productImages': <Object>[],
          'variants': [
            {'id': 'v1', 'name': 'Onyx', 'price': 120},
          ],
          'crossVariantTitles': [
            {'id': 't1', 'title': 'Size', 'variantId': null},
          ],
          'crossVariants': [
            {
              'id': 'o2',
              'crossVariantTitleId': 't1',
              'value': 'M',
              'price': 120
            },
            {
              'id': 'o1',
              'crossVariantTitleId': 't1',
              'value': 'S',
              'price': 120
            },
          ],
          'specifications': {
            'features': ['Rock plate'],
            'groups': [
              {
                'name': 'Fit',
                'rows': [
                  {'label': 'Drop', 'value': '8 mm'},
                ],
              },
            ],
          },
        };
      case ('GET', 'storefront/products/p1/related'):
        answer = {
          'items': [
            {'id': 'p2', 'name': 'Road Racer', 'minPriceDollars': 99},
          ],
        };
      case ('GET', 'storefront/products/p1/reviews'):
        answer = {
          'items': [
            {
              'id': 'pr1',
              'rating': 5,
              'title': 'Great grip',
              'body': 'Held on wet rock.',
              'reviewerName': 'Sam'
            },
          ],
          'avgRating': 5,
          'totalCount': 1,
        };
      case ('GET', 'storefront/products/p1/addons'):
        answer = {'items': <Object>[]};
      case ('GET', 'cart'):
        answer = _cart();
      case ('POST', 'cart/items'):
        final options = body['options'] as Map<String, Object?>?;
        cart.add({
          'id': 'line${cart.length + 1}',
          'productId': body['productId'],
          'variantId': body['variantId'],
          'productName': 'Trail Runner',
          'variantTitle': [
            'Onyx',
            if (options != null) 'Size ${options['Size']}'
          ].join(' · '),
          'quantity': body['quantity'],
          'unitPrice': 120,
          'subtotal': 120 * (body['quantity'] as int),
        });
        answer = _cart();
      case ('POST', 'cart/coupon'):
        if (body['code'] == 'RUN10') {
          coupon = 'RUN10';
          answer = _cart();
        } else {
          status = 400;
          answer = {'message': 'That code has expired.'};
        }
      case ('GET', 'blog/categories'):
        answer = {'items': <Object>[]};
      case ('GET', 'blog/tags'):
        answer = {
          'items': ['gear', 'training'],
        };
      case ('GET', 'blog/posts'):
        answer = {
          'items': [
            {
              'id': 'b1',
              'slug': 'first-run',
              'title': 'Your first run',
              'excerpt': 'Start slow.',
              'tags': ['training'],
              'publishedAt': '2026-11-10T00:00:00Z'
            },
            {
              'id': 'b2',
              'slug': 'shoe-guide',
              'title': 'Choosing a shoe',
              'isPinned': true,
              'tags': ['gear'],
              'publishedAt': '2026-11-01T00:00:00Z'
            },
          ],
          'nextCursor': null,
        };
      case ('GET', 'blog/posts/shoe-guide'):
        answer = {
          'post': {
            'id': 'b2',
            'slug': 'shoe-guide',
            'title': 'Choosing a shoe',
            'content':
                '<h2>Fit first</h2><p>Try them <strong>late</strong> in the day.</p><script>alert(1)</script>',
            'tags': ['gear'],
            'likes': 3,
            'ctaLabel': 'Book a fitting',
            'ctaHref': 'https://example.com/fit',
          },
          'access': 'public',
        };
      case ('GET', 'blog/posts/shoe-guide/like'):
        answer = {'liked': liked, 'likesCount': likes};
      case ('POST', 'blog/posts/shoe-guide/like'):
        liked = !liked;
        likes += liked ? 1 : -1;
        answer = {'liked': liked, 'likesCount': likes};
      case ('GET', 'blog/posts/shoe-guide/comments'):
        answer = {'items': comments};
      case ('POST', 'blog/posts/shoe-guide/comments'):
        comments.add({
          'id': 'k${comments.length}',
          'content': body['content'],
          'authorName': 'Ada'
        });
        answer = {
          'comment': comments.last,
          'moderation': {'status': 'approved', 'isApproved': true},
        };
      case ('GET', 'reviews'):
        final source = query['source'];
        final offset = int.parse(query['offset'] ?? '0');
        final limit = int.parse(query['limit'] ?? '10');
        final matched = reviews
            .where((review) => source == null || review['source'] == source)
            .toList();
        final end = (offset + limit).clamp(0, matched.length);
        answer = {
          'items': matched.sublist(offset, end),
          'nextOffset': end < matched.length ? end : null,
          'totalCount': matched.length,
        };
      case ('POST', 'customer-portal/reviews'):
        review = body;
        answer = {'id': 'new', 'status': 'pending'};
      default:
        status = 404;
        answer = {'message': 'No route for ${request.method} $path'};
    }
    return http.Response(jsonEncode(answer), status,
        headers: {'content-type': 'application/json'});
  }

  late final client = BdClient(
    host: Uri.parse('https://bd.test'),
    publishableKey: 'pk_test',
    siteId: 'site-1',
    httpClient: MockClient(handle),
  );
}

const _customer = BdSignInSession(
  user: BdSignInUser(id: 'u1', email: 'ada@example.com'),
  expiresAt: '2099-01-01T00:00:00Z',
  organizationId: 'org-1',
  sessionToken: 'tok-1',
);

void main() {
  late FakeBd bd;
  late AppState state;

  /// The test font's glyphs are wider than real ones, so the screen is a
  /// large phone; [height] fits a whole list where a test counts its rows.
  Future<void> start(WidgetTester tester, {double height = 1200}) async {
    tester.view.physicalSize = Size(1280, height * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    bd = FakeBd();
    state = AppState();
    await tester.pumpWidget(BdStarterApp(
        visitorToken: 'visitor-1', state: state, client: bd.client));
    await tester.pumpAndSettle();
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.ensureVisible(find.text(text).first);
    await tester.tap(find.text(text).first);
    await tester.pumpAndSettle();
  }

  testWidgets(
      'the store: rating, categories with counts, and a category filter',
      (tester) async {
    await start(tester);
    expect(find.text('4.6'), findsOneWidget);
    expect(find.text('3 products'), findsOneWidget);
    expect(find.text('Shoes 2'), findsOneWidget);
    expect(find.text('From \$120.00'), findsOneWidget);
    expect(find.text('New'), findsOneWidget);

    await tapText(tester, 'Socks 1');
    expect(find.text('1 product'), findsOneWidget);
    expect(find.text('Wool Socks'), findsOneWidget);
    expect(find.text('Trail Runner'), findsNothing);
    expect(bd.requests.last.url.queryParameters['categoryId'], 'c2');
  });

  testWidgets('a product: choose a size, add to cart, the badge counts it',
      (tester) async {
    await start(tester);
    await tapText(tester, 'Trail Runner');
    expect(find.text('Choose options'), findsOneWidget);
    expect(find.text('Rock plate'), findsOneWidget);
    expect(find.text('8 mm'), findsOneWidget);
    expect(find.text('Great grip'), findsOneWidget);
    expect(find.text('You may also like'), findsOneWidget);

    // Sizes go smallest first.
    final sizes = tester
        .widgetList<ChoiceChip>(find.byType(ChoiceChip))
        .map((chip) => (chip.label as Text).data);
    expect(sizes, ['S', 'M']);

    await tapText(tester, 'M');
    expect(find.text('Size: M'), findsOneWidget);
    await tapText(tester, 'Add to cart');
    final added = jsonDecode(bd.requests
        .lastWhere((request) => request.url.path.endsWith('cart/items'))
        .body);
    expect(added, {
      'productId': 'p1',
      'quantity': 1,
      'variantId': 'v1',
      'options': {'Size': 'M'}
    });
    expect(state.cartCount, 1);
    expect(state.recentlyViewed.items.single.id, 'p1');

    // "View cart" goes back to the tabs, on Cart.
    await tester.tap(find.text('View cart'));
    await tester.pumpAndSettle();
    expect(state.tab, AppTab.cart);
    expect(find.text('Onyx · Size M'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')),
        findsOneWidget);
  });

  testWidgets('the cart: a bad coupon says why; a good one applies',
      (tester) async {
    await start(tester);
    bd.cart.add({
      'id': 'line1',
      'productName': 'Trail Runner',
      'variantTitle': 'Onyx',
      'quantity': 2,
      'unitPrice': 120,
      'subtotal': 240
    });
    state.tab = AppTab.cart;
    await tester.pumpAndSettle();
    expect(find.text('\$240.00'), findsWidgets);

    await tester.enterText(find.byType(TextField), 'OLD5');
    await tapText(tester, 'Apply');
    expect(find.text('That code has expired.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'RUN10');
    await tapText(tester, 'Apply');
    expect(find.text('Coupon RUN10 applied'), findsOneWidget);
  });

  testWidgets(
      'the blog: pinned first, a tag filter, and a post to like and comment on',
      (tester) async {
    await start(tester);
    state.tab = AppTab.blog;
    await tester.pumpAndSettle();
    final titles = tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data)
        .where((data) => data == 'Your first run' || data == 'Choosing a shoe')
        .toList();
    expect(titles, ['Choosing a shoe', 'Your first run']);
    expect(find.text('Pinned'), findsOneWidget);

    await tapText(tester, '#training');
    expect(find.text('Your first run'), findsOneWidget);
    expect(find.text('Choosing a shoe'), findsNothing);
    await tapText(tester, '#training');

    await tapText(tester, 'Choosing a shoe');
    expect(find.text('Fit first'), findsOneWidget);
    expect(find.textContaining('alert'), findsNothing);
    expect(find.text('Book a fitting'), findsOneWidget);
    expect(find.text('Sign in to like'), findsOneWidget);
    expect(find.text('Sign in to comment'), findsOneWidget);

    // Signing in (on the Account tab) reloads the post as the customer.
    state.session = _customer;
    await tester.pumpAndSettle();
    await tapText(tester, 'Like');
    expect(find.text('4 likes'), findsOneWidget);
    final like = bd.requests.lastWhere((request) =>
        request.method == 'POST' && request.url.path.endsWith('/like'));
    expect(like.headers['X-BD-Session-Token'], 'tok-1');

    await tester.enterText(find.byType(TextField), 'Size up for trails.');
    await tester.pumpAndSettle();
    await tapText(tester, 'Post comment');
    expect(find.text('Comment posted.'), findsOneWidget);
    expect(find.text('Size up for trails.'), findsOneWidget);
    expect(find.text('Comments (1)'), findsOneWidget);
  });

  testWidgets('reviews: the summary, more, a platform filter, and writing one',
      (tester) async {
    await start(tester, height: 4000);
    await tapText(tester, '4.6');
    expect(find.text('14 reviews'), findsOneWidget);
    expect(find.text('8'), findsOneWidget);
    expect(find.text('Sign in to write a review'), findsOneWidget);
    expect(find.text('Verified'), findsNWidgets(3));
    // Review 0's link isn't a web address, so it has none.
    expect(find.text('Read on Google'), findsNWidgets(4));
    expect(find.text('Read on Yelp'), findsNWidgets(5));

    await tapText(tester, 'Show more');
    expect(find.text('Review number 13'), findsOneWidget);
    expect(find.text('Show more'), findsNothing);

    await tapText(tester, 'Yelp');
    expect(find.text('Review number 1'), findsOneWidget);
    expect(find.text('Review number 2'), findsNothing);
    expect(bd.requests.last.url.queryParameters['source'], 'yelp');

    state.session = _customer;
    await tester.pumpAndSettle();
    await tapText(tester, 'Write a review');
    await tapText(tester, 'Send review');
    expect(find.text('Choose a rating from 1 to 5 stars.'), findsOneWidget);

    await tester.tap(find.byTooltip('4 stars'));
    await tester.enterText(find.widgetWithText(TextField, 'Your review'),
        '  Friendly and quick.  ');
    await tapText(tester, 'Send review');
    expect(find.text(Reviews.sent), findsOneWidget);
    expect(bd.review, {'rating': 4, 'body': 'Friendly and quick.'});
    final sent = bd.requests.lastWhere(
        (request) => request.url.path.endsWith('customer-portal/reviews'));
    expect(sent.headers['X-BD-Session-Token'], 'tok-1');
  });

  testWidgets(
      'saved lists: compare holds four, and the lists outlast a relaunch',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final first = AppState(prefs: prefs);
    for (var i = 0; i < 5; i++) {
      first.compare.toggle(SavedProduct(id: 'p$i', name: 'Product $i'));
    }
    first.wishlist.toggle(
        const SavedProduct(id: 'p1', name: 'Product 1', priceCents: 1200));
    expect(
        first.compare.items.map((item) => item.id), ['p0', 'p1', 'p2', 'p3']);

    final relaunched = AppState(prefs: prefs);
    expect(relaunched.compare.items.length, 4);
    expect(relaunched.wishlist.items.single.priceCents, 1200);
    expect(
        relaunched.wishlist
            .toggle(const SavedProduct(id: 'p1', name: 'Product 1')),
        isFalse);
    expect(relaunched.wishlist.items, isEmpty);
  });
}
