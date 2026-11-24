import 'dart:convert';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

/// Builds a client backed by a stub transport. `http`'s `MockClient` is the
/// seam — no network, no local server, and the real decoding and error
/// mapping still run.
({BdClient client, List<http.Request> requests}) makeClient(
  String body, {
  int status = 200,
}) {
  final requests = <http.Request>[];

  final client = BdClient(
    host: Uri.parse('https://www.businessdash.us'),
    publishableKey: 'pk_test',
    siteId: 'site-123',
    httpClient: MockClient((request) async {
      requests.add(request);
      return http.Response(body, status, headers: {
        'content-type': 'application/json',
      });
    }),
  );

  return (client: client, requests: requests);
}

void main() {
  group('the token rule', () {
    BdClient build(String key) => BdClient(
          host: Uri.parse('https://www.businessdash.us'),
          publishableKey: key,
          siteId: 'site-123',
        );

    test('refuses a secret key, whatever its prefix', () {
      // Real secret keys are bd_…; sk_ stays to prove it's an allowlist.
      expect(() => build('bd_3ZxQf9'), throwsArgumentError);
      expect(() => build('sk_live_x'), throwsArgumentError);
      expect(() => build(' bd_padded '), throwsArgumentError);
    });

    test('takes a pk_ token, or nothing yet', () {
      expect(build('pk_ok').siteId, 'site-123');
      expect(build('').siteId, 'site-123');
    });
  });

  group('access gate', () {
    // The subtle one. Reads signal a lapsed plan with HTTP **200** and a body
    // flag, so a client that only checks the status code decodes an empty
    // screen and shows nothing. This test pins the check order.
    test('a 200 carrying available:false throws rather than parsing', () async {
      final stub = makeClient(jsonEncode({
        'available': false,
        'reason': 'payment_required',
        'message': 'Billing lapsed.',
        'upgradeUrl': 'https://www.businessdash.us/billing',
      }));

      await expectLater(
        stub.client.products(),
        throwsA(
          isA<BdAccessRejectedException>()
              .having((e) => e.reason, 'reason',
                  AccessRejectionReason.paymentRequired)
              .having((e) => e.isUnavailable, 'isUnavailable', true),
        ),
      );
    });

    test('plan_required is not treated as temporarily unavailable', () {
      const error = BdAccessRejectedException(
        reason: AccessRejectionReason.planRequired,
        message: '',
      );
      expect(error.isUnavailable, isFalse);
    });

    test('a real 4xx still throws an http exception', () async {
      final stub = makeClient(jsonEncode({'message': 'Nope.'}), status: 404);

      await expectLater(
        stub.client.products(),
        throwsA(isA<BdHttpException>().having((e) => e.status, 'status', 404)),
      );
    });
  });

  group('decoding', () {
    test('checkout reads stripeUrl, not url', () async {
      final stub = makeClient(jsonEncode({
        'stripeUrl': 'https://checkout.stripe.com/x',
      }));

      final session = await stub.client.startCheckout(
        'visitor-1',
        successUrl: 'a://ok',
        cancelUrl: 'a://no',
      );

      expect(session.stripeUrl, contains('checkout.stripe.com'));
    });

    test('a new nullable field does not break parsing', () async {
      final stub = makeClient(jsonEncode({
        'items': [
          {
            'id': 'p1',
            'name': 'Widget',
            'cheapestPriceCents': 1999,
            'somethingAddedNextRelease': true,
          }
        ],
      }));

      final products = await stub.client.products();
      expect(products, hasLength(1));
      expect(products.first.cheapestPriceCents, 1999);
    });

    // The platform keys EVERY list response `items` — not `products`,
    // `posts` or `reviews`. Getting it wrong parses to an empty list rather
    // than throwing, so a screen renders "no products" against a full catalog
    // and nothing looks broken. Pinned for that reason.
    test('list responses parse from `items`, not the plural of the thing', () async {
      final stub = makeClient(jsonEncode({
        'items': [
          {'id': 'p1', 'name': 'Widget', 'cheapestPriceCents': 500}
        ],
      }));

      final products = await stub.client.products();
      expect(products, hasLength(1));
      expect(products.first.name, 'Widget');
    });

    // The item fields use the platform's names, not the obvious ones. Each
    // decodes to null rather than throwing when guessed wrong, which is why
    // they're pinned.
    test("item fields use the platform's names", () async {
      final stub = makeClient(jsonEncode({
        'items': [
          {
            'id': 'p1',
            'name': 'Widget',
            'description': 'd',
            'coverImage': 'http://i',
            'cheapestPriceCents': 1999,
            'avgRating': 4.5,
          }
        ],
      }));

      final card = (await stub.client.productGrid()).first;
      expect(card.cheapestPriceCents, 1999);
      expect(card.coverImage, 'http://i');
      expect(card.avgRating, 4.5);
    });

    test('a relation parses from a link object or a bare id', () {
      DataModelRecord record(Object? todo) =>
          DataModelRecord.fromJson({'id': 't', 'fields': {'todo': todo}});

      expect(record({'id': 'parent-1'}).relationId('todo'), 'parent-1');
      expect(record('parent-2').relationId('todo'), 'parent-2');
      expect(record(null).relationId('todo'), isNull);
    });
  });

  group('request building', () {
    test('null query values are dropped, not sent as empty', () async {
      final stub = makeClient(jsonEncode({'items': []}));

      await stub.client.productGrid(search: null, sort: 'newest');

      final url = stub.requests.single.url.toString();
      expect(url, contains('sort=newest'));
      expect(url, isNot(contains('search')));
    });

    test('the bearer token and site path are applied', () async {
      final stub = makeClient(jsonEncode({}));

      await stub.client.pageBundle();

      final request = stub.requests.single;
      expect(request.headers['Authorization'], 'Bearer pk_test');
      expect(request.url.path, contains('/sites/site-123/marketing/bundle'));
    });

    test('the cart visitor header is applied', () async {
      final stub = makeClient(jsonEncode({'items': []}));

      await stub.client.cart('visitor-9');

      expect(stub.requests.single.headers['X-BD-Cart-Visitor'], 'visitor-9');
    });
  });

  group('money', () {
    // The two shapes are a 100× error apart, which is why they are separate
    // functions rather than one overloaded helper.
    test('cents divides by 100; amount does not', () {
      expect(Money.cents(1999), r'$19.99');
      expect(Money.amount(19.99), r'$19.99');
      expect(Money.cents(null), '');
      expect(Money.amount(null), '');
    });

    test('an unknown currency falls back to a code prefix', () {
      expect(Money.cents(1999, currency: 'JPY'), 'JPY 19.99');
    });
  });

  group('marketing bundle access', () {
    final bundle = <String, dynamic>{
      'sections': {
        'hero': {'headline': 'Real headline', 'subhead': ''},
        'about': <String, dynamic>{},
      },
    };

    test('a key path reads through nested objects', () {
      expect(bundle.string(['sections', 'hero', 'headline']), 'Real headline');
    });

    // An author who cleared a field wants the local default back, not a blank
    // heading — so an empty string reads as missing.
    test('an empty string is treated as missing', () {
      expect(bundle.string(['sections', 'hero', 'subhead']), isNull);
    });

    test('a missing key path is null, not a crash', () {
      expect(bundle.string(['sections', 'nope', 'headline']), isNull);
      expect(bundle.string(['sections', 'about', 'title']), isNull);
    });
  });

  group('donations', () {
    // The platform's own coverFeeCents output, also pinned in the JS SDK — a
    // page must show the cents the checkout charges.
    test('cover fees matches the platform to the cent', () {
      const reference = [
        [2500, 0, 106],
        [5000, 0, 181],
        [10000, 100, 438],
        [1999, 0, 91],
        [123456, 250, 7079],
        [500, 0, 46],
      ];
      for (final r in reference) {
        expect(
          donationCoverFeeCents(r[0], rateBps: 290 + r[1], fixedCents: 30),
          r[2],
        );
      }
      expect(donationCoverFeeCents(0, rateBps: 290, fixedCents: 30), 0);
    });

    test('the giving page decodes, including the tax statement', () async {
      final stub = makeClient(jsonEncode({
        'orgName': 'Gerus',
        'avatarUrl': null,
        'accentColor': null,
        'title': 'Support our work',
        'appeal': null,
        'presetAmountsCents': [2500, 5000],
        'monthlyPresetAmountsCents': [1000],
        'allowOneTime': true,
        'allowMonthly': true,
        'defaultFrequency': 'one_time',
        'minAmountCents': 500,
        'maxAmountCents': 2500000,
        'currency': 'usd',
        'offerCoverFees': true,
        'platformFeeBps': null,
        'coverFee': {'rateBps': 290, 'fixedCents': 30},
        'thankYouMessage': null,
        'isTaxDeductible': false,
        'taxStatement':
            'Gerus is not a registered 501(c)(3) charity, so this gift is not tax-deductible.',
        'unavailable': null,
        'hostedUrl': 'https://www.businessdash.us/give/gerus',
      }));
      final page = await stub.client.donationPage();
      expect(page.isAcceptingGifts, isTrue);
      expect(page.isTaxDeductible, isFalse);
      expect(page.coverFeeCents(2500), 106);
      expect(stub.requests.single.url.path, endsWith('/donations'));
    });

    test('starting a gift posts to donations/checkout', () async {
      final stub = makeClient(jsonEncode({
        'url': 'https://checkout.stripe.com/c/pay/cs_1',
        'frequency': 'monthly',
        'amountCents': 2500,
        'coveredFeeCents': 106,
        'totalAmountCents': 2606,
        'currency': 'usd',
      }));
      final checkout = await stub.client.startDonationCheckout(
        amountCents: 2500,
        donorName: 'Ada',
        donorEmail: 'ada@example.com',
        monthly: true,
        coverFees: true,
      );
      expect(checkout.totalAmountCents, 2606);
      final request = stub.requests.single;
      expect(request.method, 'POST');
      expect(request.url.path, endsWith('/donations/checkout'));
      final sent = jsonDecode(request.body) as Map<String, dynamic>;
      expect(sent['frequency'], 'monthly');
      expect((sent['donor'] as Map)['email'], 'ada@example.com');
    });
  });

  group('customer account', () {
    test('delete account posts the auth session header and reads the answer', () async {
      final stub = makeClient(jsonEncode({'deleted': true, 'signInKept': false}));
      final result = await stub.client.deleteAccount('tok');
      expect(result.deleted, isTrue);
      expect(result.signInKept, isFalse);
      final request = stub.requests.single;
      expect(request.method, 'POST');
      expect(request.url.path, endsWith('/auth/customer/delete-account'));
      expect(request.headers['x-bd-session'], 'tok');
    });
  });
}
