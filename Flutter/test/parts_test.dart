import 'package:bd_starter/ui/blog_parts.dart';
import 'package:bd_starter/ui/product_parts.dart';
import 'package:bd_starter/ui/review_parts.dart';
import 'package:bd_starter/ui/store_parts.dart';
import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// A product page of your own, laid out from the starter's parts: photos,
/// title, price, the style and option chips, stock, quantity and add to
/// cart, then the details.
class MyProductPage extends StatefulWidget {
  const MyProductPage({super.key, required this.view});

  final ProductView view;

  @override
  State<MyProductPage> createState() => _MyProductPageState();
}

class _MyProductPageState extends State<MyProductPage> {
  late String _variantId = widget.view.defaultVariant!.id;
  Map<String, String> _chosen = {};
  int _quantity = 1;
  var _added = 0;

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    final groups = view.optionGroups(_variantId);
    final price = view.price(_variantId, _chosen);
    return ListView(
      children: [
        ProductTitle(categoryName: view.categoryName, name: view.name),
        ProductPriceText(price: price),
        StockNote(stock: price.stock),
        VariantPicker(
          variants: view.variants,
          selected: _variantId,
          onSelect: (id) => setState(() {
            _variantId = id;
            _chosen = {};
          }),
        ),
        for (final group in groups)
          OptionPicker(
            group: group,
            selected: _chosen[group.id],
            onSelect: (id) => setState(() => _chosen = {..._chosen, group.id: id}),
          ),
        Row(children: [
          QuantityStepper(quantity: _quantity, max: price.stock ?? 99, onChanged: (n) => setState(() => _quantity = n)),
          Expanded(
            child: AddToCartButton(
              price: price,
              adding: false,
              hasOptions: groups.isNotEmpty,
              onPressed: () => setState(() => _added += _quantity),
            ),
          ),
        ]),
        Text('In cart: $_added'),
        ProductDetails.of(view),
      ],
    );
  }
}

Widget _app(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  final shell = ProductView.fromJson({
    'id': 'p1',
    'name': 'Trail Shell',
    'categoryId': 'c1',
    'category': {'name': 'Jackets'},
    'variants': [
      {'id': 'v1', 'name': 'Cloud', 'price': 120, 'stock': 0},
      {'id': 'v2', 'name': 'Storm', 'price': 130, 'stock': 3},
    ],
    'crossVariantTitles': [
      {'id': 't1', 'title': 'Size', 'variantId': 'v2'},
    ],
    'crossVariants': [
      // With options, the option chosen sets the price.
      {'id': 'l', 'crossVariantTitleId': 't1', 'value': 'L', 'price': 135},
      {'id': 's', 'crossVariantTitleId': 't1', 'value': 'S', 'price': 130, 'stock': 3},
    ],
    'specifications': {
      'features': ['Seam-sealed'],
      'groups': [
        {
          'name': 'Fit',
          'rows': [
            {'label': 'Cut', 'value': 'Regular'},
          ],
        },
      ],
    },
  });

  testWidgets('a product page of your own: style, size, quantity and add to cart', (tester) async {
    await tester.pumpWidget(_app(MyProductPage(view: shell)));

    expect(find.text('Jackets'), findsOneWidget);
    expect(find.text('Trail Shell'), findsOneWidget);
    // Opens on the first style that can be bought, its sizes smallest first.
    expect(find.text('Style: Storm'), findsOneWidget);
    expect(tester.getTopLeft(find.text('S')).dx, lessThan(tester.getTopLeft(find.text('L')).dx));
    expect(find.text('Choose options'), findsOneWidget);

    await tester.tap(find.text('S'));
    await tester.pump();
    expect(find.text('Size: S'), findsOneWidget);
    expect(find.text(r'$130.00'), findsOneWidget);
    expect(find.text('Only 3 left'), findsOneWidget);

    await tester.tap(find.byTooltip('One more'));
    await tester.pump();
    await tester.tap(find.text('Add to cart'));
    await tester.pump();
    expect(find.text('In cart: 2'), findsOneWidget);

    expect(find.text('Features'), findsOneWidget);
    expect(find.text('Seam-sealed'), findsOneWidget);
    expect(find.text('Regular'), findsOneWidget);
  });

  testWidgets('the store, blog and reviews parts stand on their own', (tester) async {
    final post = BlogPost.fromJson({
      'id': 'b1',
      'slug': 'first-5k-plan',
      'title': 'Your first 5K',
      'content': '<p>Start slow.</p>',
      'tags': ['running', 'gear'],
      'ctaLabel': 'Join the club',
      'ctaHref': 'javascript:alert(1)',
    });
    String? tag;
    String? source;
    String? category;
    await tester.pumpWidget(_app(StatefulBuilder(
      builder: (context, setState) => ListView(
        children: [
          BlogFilters(
            categories: const [],
            tags: post.tags,
            categoryId: null,
            tag: tag,
            onCategory: (_) {},
            onTag: (next) => setState(() => tag = next),
          ),
          Text('Tag: ${tag ?? 'none'}'),
          PostTags(tags: post.tags),
          PostCta(post: post, onOpen: (_) {}),
          LikeButton(signedIn: false, liked: false, count: 2, onToggle: () {}, onSignIn: () {}),
          ReviewSourceFilter(
            sources: const ['google', 'yelp'],
            selected: source,
            onSelect: (next) => setState(() => source = next),
          ),
          Text('Source: ${source ?? 'all'}'),
          CategoryChips(
            categories: const [],
            counts: const {},
            selected: category,
            onSelect: (next) => setState(() => category = next),
          ),
          StoreResultsBar(count: 1, filterCount: 1, sort: 'price-asc', onFilters: () {}),
        ],
      ),
    )));

    await tester.tap(find.text('#gear'));
    await tester.pump();
    expect(find.text('Tag: gear'), findsOneWidget);
    // Choosing the chosen tag again clears it.
    await tester.tap(find.text('#gear'));
    await tester.pump();
    expect(find.text('Tag: none'), findsOneWidget);

    expect(find.text('#running  #gear'), findsOneWidget);
    // Only web and mail links open: no button for a script link.
    expect(PostCta.linkFor(post), isNull);
    expect(find.text('Join the club'), findsNothing);
    expect(find.text('Sign in to like'), findsOneWidget);
    expect(find.text('2 likes'), findsOneWidget);

    await tester.tap(find.text('Yelp'));
    await tester.pump();
    expect(find.text('Source: yelp'), findsOneWidget);

    expect(find.text('1 product'), findsOneWidget);
    expect(find.text('Filters (1) · Price: low to high'), findsOneWidget);
  });
}
