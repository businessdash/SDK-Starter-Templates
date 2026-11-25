import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'product_parts.dart';
import 'shop_parts.dart';

/// One product: photos for the chosen style, the style and option rows,
/// quantity, add to cart, add-ons, features and specs, its reviews, and
/// "You may also like" / recently viewed.
///
/// It's laid out from the parts in product_parts.dart ([ProductGallery],
/// [ProductTitle], [ProductPriceText], [StockNote], [VariantPicker],
/// [OptionPicker], [QuantityStepper], [AddToCartButton], [ProductNotice],
/// [ProductAddons], [ProductDetails], [ProductReviews]) and shop_parts.dart
/// ([SaveButtons], [ProductRail]). Rearrange them here, or lay out a page of
/// your own from them.
class ProductPage extends StatefulWidget {
  const ProductPage({super.key, required this.productId});

  final String productId;

  @override
  State<ProductPage> createState() => _ProductPageState();
}

class _ProductPageState extends State<ProductPage> {
  BdClient? _client;
  ProductView? _view;
  Object? _error;
  bool _loaded = false;

  String? _variantId;
  Map<String, String> _chosen = {};
  int _quantity = 1;
  bool _adding = false;
  String? _message;

  List<RelatedProduct> _related = const [];
  List<ProductAddon> _addons = const [];
  final _addedAddons = <String>{};

  ProductReviewPage? _reviews;
  int _reviewLimit = 10;
  bool _loadingReviews = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    if (client == null) {
      _loaded = true;
      return;
    }
    final id = widget.productId;
    client.productDetail(id).then((view) {
      if (!mounted) return;
      setState(() {
        _view = view;
        _variantId = view.defaultVariant?.id;
        _loaded = true;
      });
      final price = view.defaultVariant?.price;
      AppScope.read(context).recentlyViewed.add(SavedProduct(
            id: view.id,
            name: view.name,
            image: view.images.firstOrNull,
            priceCents: price == null ? null : (price * 100).round(),
          ));
    }, onError: (Object error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loaded = true;
      });
    });
    client.relatedProducts(id).then((items) {
      if (mounted) setState(() => _related = items);
    }, onError: (Object _) {});
    client.productAddons(id).then((items) {
      if (mounted) setState(() => _addons = items);
    }, onError: (Object _) {});
    _loadReviews();
  }

  /// "Show more" asks for a longer page; the reviews on screen stay while
  /// it loads.
  Future<void> _loadReviews() async {
    final client = _client;
    if (client == null) return;
    setState(() => _loadingReviews = true);
    try {
      final page = await client.productReviews(widget.productId, limit: _reviewLimit);
      if (mounted) setState(() => _reviews = page);
    } on Exception {
      // The reviews already shown stay.
    } finally {
      if (mounted) setState(() => _loadingReviews = false);
    }
  }

  Future<void> _addToCart(ProductView view, String variantId) async {
    final scope = BdScope.of(context);
    final client = scope.client;
    if (client == null) return;
    final app = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _adding = true;
      _message = null;
    });
    try {
      final cart = await client.cartAdd(
        scope.visitorToken,
        productId: view.id,
        variantId: variantId,
        options: view.chosenOptions(variantId, _chosen),
        quantity: _quantity,
      );
      app.noteCart(cart);
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text('Added ${view.name} to your cart.'),
        action: SnackBarAction(label: 'View cart', onPressed: () => app.showTab(context, AppTab.cart)),
      ));
    } on Exception catch (error) {
      if (mounted) setState(() => _message = bdProblem(error, "Couldn't add it to your cart. Try again."));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _addAddon(ProductAddon addon) async {
    final scope = BdScope.of(context);
    final client = scope.client;
    if (client == null) return;
    final app = AppScope.read(context);
    try {
      final cart = await client.cartAdd(scope.visitorToken, productId: addon.addonProductId, variantId: addon.firstVariantId);
      app.noteCart(cart);
      if (mounted) setState(() => _addedAddons.add(addon.id));
    } on Exception {
      if (mounted) setState(() => _message = "Couldn't add ${addon.name}. Try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = _view;
    return Scaffold(
      appBar: AppBar(
        title: Text(view?.name ?? 'Product'),
        actions: [
          if (view != null && bdSiteUrl.isNotEmpty)
            IconButton(
              tooltip: 'Copy link',
              icon: const Icon(Icons.link),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: '$bdSiteUrl/store/${Uri.encodeComponent(view.id)}'));
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied.')));
              },
            ),
        ],
      ),
      body: switch ((view, _loaded)) {
        (final view?, _) => _page(context, view),
        (null, false) => const Center(child: CircularProgressIndicator()),
        (null, true) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                _client == null
                    ? 'Not connected to BD.'
                    : (_error is BdHttpException && (_error as BdHttpException).status == 404)
                        ? 'Product not found.'
                        : "Couldn't load this product.",
                textAlign: TextAlign.center,
              ),
            ),
          ),
      },
    );
  }

  Widget _page(BuildContext context, ProductView view) {
    final app = AppScope.of(context);
    final variantId = _variantId;
    final groups = variantId == null ? const <OptionGroup>[] : view.optionGroups(variantId);
    final price = variantId == null ? const ProductPrice(from: false, ready: false) : view.price(variantId, _chosen);
    final gallery = variantId == null ? view.images : view.gallery(variantId);
    final stock = price.stock;
    final maxQuantity = stock == null ? 99 : stock.clamp(1, 99);
    final saved = SavedProduct(
      id: view.id,
      name: view.name,
      image: view.images.firstOrNull,
      priceCents: view.defaultVariant?.price == null ? null : (view.defaultVariant!.price! * 100).round(),
    );
    final recent = app.recentlyViewed.items.where((item) => item.id != view.id).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (gallery.isNotEmpty) ProductGallery(urls: gallery, name: view.name),
        const SizedBox(height: 16),
        ProductTitle(categoryName: view.categoryName, name: view.name),
        const SizedBox(height: 4),
        ProductPriceText(price: price),
        StockNote(stock: stock),
        const SizedBox(height: 12),
        SaveButtons(product: saved),
        VariantPicker(
          variants: view.variants,
          selected: variantId,
          onSelect: (next) => setState(() {
            _variantId = next;
            _chosen = {};
            _quantity = 1;
            _message = null;
          }),
        ),
        for (final group in groups)
          OptionPicker(
            group: group,
            selected: _chosen[group.id],
            onSelect: (next) => setState(() {
              _chosen = {..._chosen, group.id: next};
              _quantity = 1;
            }),
          ),
        const SizedBox(height: 16),
        Row(
          spacing: 12,
          children: [
            QuantityStepper(
              quantity: _quantity,
              max: maxQuantity,
              onChanged: (next) => setState(() => _quantity = next),
            ),
            Expanded(
              child: AddToCartButton(
                price: price,
                adding: _adding,
                hasOptions: groups.isNotEmpty,
                onPressed: variantId == null ? null : () => _addToCart(view, variantId),
              ),
            ),
          ],
        ),
        if (_message != null) ProductNotice(_message!),
        ProductAddons(addons: _addons, added: _addedAddons, onAdd: _addAddon),
        ProductDetails.of(view),
        const SizedBox(height: 24),
        ProductReviews(
          page: _reviews,
          loading: _loadingReviews,
          onMore: _reviewLimit >= 100
              ? null
              : () {
                  _reviewLimit = (_reviewLimit + 10).clamp(10, 100);
                  _loadReviews();
                },
        ),
        const SizedBox(height: 24),
        ProductRail(
          title: 'You may also like',
          products: [
            for (final item in _related)
              SavedProduct(
                id: item.id,
                name: item.name,
                image: item.coverImageUrl,
                priceCents: item.minPriceDollars == null ? null : (item.minPriceDollars! * 100).round(),
              ),
          ],
        ),
        if (_related.isNotEmpty && recent.isNotEmpty) const SizedBox(height: 24),
        ProductRail(title: 'Recently viewed', products: recent),
      ],
    );
  }
}
