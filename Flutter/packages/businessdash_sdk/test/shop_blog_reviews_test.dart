import 'dart:convert';
import 'dart:io';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

({BdClient client, List<http.Request> requests}) stub(Object body) {
  final requests = <http.Request>[];
  final client = BdClient(
    host: Uri.parse('https://businessdash.us'),
    publishableKey: 'pk_test',
    siteId: 'site-123',
    httpClient: MockClient((request) async {
      requests.add(request);
      return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});
    }),
  );
  return (client: client, requests: requests);
}

void main() {
  group('post HTML', () {
    // Post HTML in, and what the web starters' safePostHtml gives back; every
    // BD starter checks its port against the same cases.
    final cases = (jsonDecode(File('test/fixtures/post-html-parity.json').readAsStringSync())
            as Map<String, dynamic>)['cases'] as List;

    test('cleans the same as every other starter', () {
      expect(cases.length, greaterThanOrEqualTo(20));
      for (final entry in cases.cast<Map<String, dynamic>>()) {
        expect(PostHtml.safe(entry['input'] as String), entry['output'], reason: entry['input'] as String);
      }
    });

    test('reads as blocks, with scripts and unsafe links gone', () {
      final blocks = PostBlocks.from('''
        <h2>Weeks 1 to 3</h2><p>Run <strong>easy</strong> &amp; <a href="https://example.com/x">read this</a>
        <a href="javascript:alert(1)">bad</a> <a href="/store">ours</a></p>
        <script>alert(1)</script>
        <ul><li>Monday<ul><li>20 min</li></ul>then rest</li><li>Friday</li></ul>
        <ol start="3"><li>Third</li></ol>
        <img src="https://img.example/a.jpg" alt="Shoe"><img src="/local.jpg">
        <blockquote>Easy means talking.</blockquote><pre>let x = 1</pre><hr>
      ''');
      expect(blocks.length, 8);

      final heading = blocks[0] as PostHeading;
      expect(heading.level, 2);
      expect(plainText(heading.text), 'Weeks 1 to 3');

      final body = (blocks[1] as PostParagraph).text;
      expect(plainText(body), 'Run easy & read this bad ours');
      expect(body.map((run) => run.link).whereType<String>(), ['https://example.com/x']);
      expect(body.any((run) => run.bold && run.text == 'easy'), isTrue);

      final list = (blocks[2] as PostList).items;
      expect(list.map((item) => item.marker), ['•', '◦', '', '•']);
      expect(list.map((item) => plainText(item.text)), ['Monday', '20 min', 'then rest', 'Friday']);
      expect(list.map((item) => item.depth), [0, 1, 0, 0]);

      expect((blocks[3] as PostList).items.first.marker, '3.');
      expect(blocks[4], const PostImage('https://img.example/a.jpg', 'Shoe'));
      expect(blocks[5], isA<PostQuote>());
      expect(blocks[6], const PostCode('let x = 1'));
      expect(blocks[7], const PostRule());
    });

    test('keeps tables, captions, phone and mail links', () {
      final blocks = PostBlocks.from(
        '<figure><img src="https://img.example/b.jpg" alt=""><figcaption>Our <em>shop</em></figcaption></figure>'
        '<table><thead><tr><th>Size</th><th>Drop</th></tr></thead><tbody><tr><td>S</td><td>8 mm</td></tr></tbody></table>'
        '<p><a href="tel:+15551234567">Call</a> or <a href="mailto:hi@example.com">write</a></p>',
      );
      expect(blocks.map((block) => block.runtimeType), [PostImage, PostCaption, PostTable, PostParagraph]);
      final rows = (blocks[2] as PostTable).rows;
      expect(rows.map((row) => row.isHeader), [true, false]);
      expect(rows.map((row) => row.cells.map(plainText).toList()), [
        ['Size', 'Drop'],
        ['S', '8 mm'],
      ]);
      expect((blocks[3] as PostParagraph).text.map((run) => run.link).whereType<String>(),
          ['tel:+15551234567', 'mailto:hi@example.com']);
    });

    test('times and dates a post', () {
      expect(PostHtml.readingMinutes('<p>${'word ' * 700}</p>'), 3);
      expect(PostHtml.date('2026-11-18T15:00:00.000Z'), 'November 18, 2026');
      expect(PostHtml.date('not a date'), '');
    });
  });

  group('product page', () {
    final shoe = ProductView.fromJson(jsonDecode('''
      {"id":"p1","name":"Trainer","category":{"name":"Shoes"},
       "productImages":[{"url":"b.jpg","order":2},{"url":"a.jpg","order":1}],
       "variants":[{"id":"v1","name":"Blue","price":120,"stock":0},{"id":"v2","name":"Black","price":120}],
       "variantImages":[{"variantId":"v2","url":"black.jpg","order":1}],
       "crossVariantTitles":[{"id":"t1","title":"Size","variantId":null}],
       "crossVariants":[
         {"id":"o3","crossVariantTitleId":"t1","value":"L","price":125,"stock":3},
         {"id":"o1","crossVariantTitleId":"t1","value":"S","price":120},
         {"id":"o2","crossVariantTitleId":"t1","value":"M","price":120,"isLive":false}],
       "specifications":{"features":["Light"],"groups":[{"name":"Fit","rows":[{"label":"Drop","value":"8 mm"},{"label":"","value":"x"}]}]}}
    ''') as Map<String, dynamic>);

    test('opens on the first style that can be bought, with its own photos', () {
      expect(shoe.defaultVariant?.id, 'v2');
      expect(shoe.gallery('v2'), ['black.jpg']);
      expect(shoe.gallery('v1'), ['a.jpg', 'b.jpg']);
      expect(shoe.categoryName, 'Shoes');
      expect(shoe.features, ['Light']);
      expect(shoe.specs.single.name, 'Fit');
      expect(shoe.specs.single.rows, [const SpecRow(label: 'Drop', value: '8 mm')]);
    });

    test("sizes go smallest first; the price is 'from' until every group is chosen", () {
      expect(shoe.optionGroups('v2').first.values.map((value) => value.value), ['S', 'M', 'L']);
      expect(shoe.price('v2', {}), const ProductPrice(amount: 120, from: true, ready: false));
      expect(shoe.price('v2', {'t1': 'o3'}), const ProductPrice(amount: 125, from: false, stock: 3, ready: true));
      expect(shoe.chosenOptions('v2', {'t1': 'o3'}), {'Size': 'L'});
      expect(shoe.price('v2', {'t1': 'o2'}).ready, isFalse);
      expect(shoe.price('v1', {}).amount, isNull);
    });
  });

  group('reviews', () {
    test('summarizes from the bundle counts', () {
      final summary = Reviews.summarize(ReviewTotals.fromJson({
        'rating': 4.1,
        'totalCount': 14,
        'counts': [
          {'rating': 5, 'count': 8},
          {'rating': 4, 'count': 3},
          {'rating': 3, 'count': 1},
          {'rating': 2, 'count': 1},
          {'rating': 1, 'count': 1},
        ],
      }));
      expect(summary.average, 4.1);
      expect(summary.total, 14);
      expect(summary.histogram.map((row) => row.count), [8, 3, 1, 1, 1]);
      expect(summary.histogram.first.share, closeTo(8 / 14, 1e-9));
    });

    test('links out over http(s) only, and only for a platform', () {
      Review review(String source, String url) =>
          Review.fromJson({'id': 'r', 'rating': 5, 'source': source, 'reviewUrl': url});
      expect(Reviews.link(review('google', 'javascript:alert(1)')), isNull);
      expect(Reviews.link(review('other', 'https://example.com/r')), isNull);
      expect(Reviews.link(review('yelp', 'https://yelp.com/r/1')), 'https://yelp.com/r/1');
      expect(Reviews.sourcesIn([review('yelp', ''), review('google', ''), review('yelp', '')]), ['yelp', 'google']);
    });

    test('a review needs stars and words; its title is cut at 200', () {
      expect(Reviews.check(rating: 0, body: 'Great').error, 'Choose a rating from 1 to 5 stars.');
      expect(Reviews.check(rating: 5, body: '  ').isOk, isFalse);
      expect(Reviews.check(rating: 5, body: 'x' * 5001).isOk, isFalse);
      final long = Reviews.check(rating: 5, title: 'x' * 250, body: 'Great');
      expect(long.review?.title?.length, 200);
      expect(Reviews.check(rating: 4, body: 'Great').review?.toJson(), {'rating': 4, 'body': 'Great'});
    });

    test('stars, names and dates', () {
      expect(Reviews.stars(4.4), '★★★★☆');
      expect(Reviews.reviewerInitial(Review.fromJson({'id': 'r', 'rating': 5, 'reviewerName': ' priya'})), 'P');
      expect(Reviews.reviewerName(Review.fromJson({'id': 'r', 'rating': 5})), 'Anonymous');
      expect(Reviews.date('2026-11-20T23:30:00Z'), 'Nov 20, 2026');
    });
  });

  group('requests and shapes', () {
    test('the grid carries category counts by categoryId and the price range in dollars', () async {
      final s = stub({
        'items': [
          {'id': 'p1', 'name': 'Trainer', 'isNew': true, 'hasMultipleVariants': true, 'cheapestPriceCents': 12000},
        ],
        'categoryCounts': [
          {'categoryId': 'c1', 'count': 2},
        ],
        'priceRange': {'minDollars': 18, 'maxDollars': 125},
      });
      final grid = await s.client.productListing(search: 'trail', minPriceCents: 2000, minRating: 4);
      expect(grid.categoryCounts, {'c1': 2});
      expect(grid.maxDollars, 125);
      expect(grid.items.single.isNew, isTrue);
      final query = s.requests.single.url.queryParameters;
      expect(query['meta'], '1');
      expect(query['minPriceCents'], '2000');
      expect(query['minRating'], '4');
      expect(query.containsKey('maxPriceCents'), isFalse);
    });

    test('a cart line is productName, variantTitle and productImage; options go out', () async {
      final s = stub({
        'items': [
          {'id': 'l1', 'productName': 'Trainer', 'variantTitle': 'Onyx · Size 42', 'productImage': 'a.jpg', 'quantity': 2, 'subtotal': 240},
        ],
        'subtotal': 240,
        'itemCount': 2,
      });
      final cart = await s.client.cartAdd('v-1', productId: 'p1', variantId: 'v2', options: {'Size': '42'});
      expect(cart.items.single.name, 'Trainer');
      expect(cart.items.single.variantTitle, 'Onyx · Size 42');
      expect(cart.units, 2);
      expect(jsonDecode(s.requests.single.body), {
        'productId': 'p1',
        'quantity': 1,
        'variantId': 'v2',
        'options': {'Size': '42'},
      });
    });

    test("an add-on goes in as its first variant, whose id is variantId", () {
      final addon = ProductAddon.fromJson({
        'id': 'a1',
        'addonProductId': 'p2',
        'addonName': 'Socks',
        'priceCents': 1800,
        'variants': [
          {'variantId': 'v9', 'priceCents': 1800},
        ],
      });
      expect(addon.firstVariantId, 'v9');
      expect(addon.name, 'Socks');
    });

    test('likes and comments send the session as X-BD-Session-Token', () async {
      final s = stub({'liked': true, 'likesCount': 3});
      final likes = await s.client.togglePostLike('a b', sessionToken: 'tok');
      expect(likes.liked, isTrue);
      expect(likes.count, 3);
      expect(s.requests.single.headers['X-BD-Session-Token'], 'tok');
      expect(s.requests.single.url.path, endsWith('blog/posts/a%20b/like'));
    });

    test('a post arrives wrapped, and a members-only one says so', () async {
      final s = stub({
        'post': {'id': 'b1', 'slug': 'plan', 'title': 'Plan', 'content': '', 'isPinned': true, 'tags': ['training']},
        'access': 'paywall',
      });
      final detail = await s.client.blogPost('plan');
      expect(detail.isPaywalled, isTrue);
      expect(detail.post.isPinned, isTrue);
      expect(detail.post.tags, ['training']);
      expect(s.requests.single.headers.containsKey('X-BD-Session-Token'), isFalse);
    });

    test('review pages filter by platform; a written review goes to the portal', () async {
      final s = stub({
        'items': [
          {'id': 'r1', 'rating': 5, 'source': 'yelp', 'text': 'Great', 'photos': ['p.jpg'], 'timeCreated': '2026-11-20T00:00:00Z'},
        ],
        'nextOffset': 10,
        'totalCount': 14,
      });
      final page = await s.client.reviewPage(source: 'yelp');
      expect(page.nextOffset, 10);
      expect(page.items.single.photos, ['p.jpg']);
      expect(s.requests.single.url.queryParameters['source'], 'yelp');

      final portal = stub({'id': 'r9', 'status': 'pending'});
      await portal.client.portal('tok').submitReview(const ReviewInput(rating: 4, body: 'Good'));
      expect(portal.requests.single.url.path, endsWith('customer-portal/reviews'));
      expect(portal.requests.single.headers['X-BD-Session-Token'], 'tok');
      expect(jsonDecode(portal.requests.single.body), {'rating': 4, 'body': 'Good'});
    });
  });
}
