import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';

/// One product: photos for the chosen style, the style and option rows,
/// quantity, add to cart, add-ons, features and specs, its reviews, and
/// "You may also like" / recently viewed.
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
    final theme = Theme.of(context);
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
    final amount = price.amount;
    final recent = app.recentlyViewed.items.where((item) => item.id != view.id).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (gallery.isNotEmpty) _Gallery(urls: gallery, name: view.name),
        const SizedBox(height: 16),
        if (view.categoryName != null) Text(view.categoryName!, style: theme.textTheme.bodySmall),
        Text(view.name, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          amount == null ? 'Unavailable' : '${price.from ? 'From ' : ''}${Money.amount(amount)}',
          style: theme.textTheme.titleLarge,
        ),
        if (stock != null && stock > 0 && stock <= 5)
          Text('Only $stock left',
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        SaveButtons(product: saved),
        if (view.variants.length > 1)
          _OptionRow(
            title: 'Style',
            options: [for (final variant in view.variants) (id: variant.id, label: variant.name, available: variant.available)],
            selected: variantId,
            onSelect: (next) => setState(() {
              _variantId = next;
              _chosen = {};
              _quantity = 1;
              _message = null;
            }),
          ),
        for (final group in groups)
          _OptionRow(
            title: group.title,
            options: [for (final value in group.values) (id: value.id, label: value.value, available: value.available)],
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
            Semantics(
              label: 'Quantity $_quantity',
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'One fewer',
                      icon: const Icon(Icons.remove),
                      onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                    ),
                    Text('$_quantity', style: theme.textTheme.titleMedium),
                    IconButton(
                      tooltip: 'One more',
                      icon: const Icon(Icons.add),
                      onPressed: _quantity < maxQuantity ? () => setState(() => _quantity++) : null,
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: FilledButton(
                onPressed: _adding || !price.ready || variantId == null ? null : () => _addToCart(view, variantId),
                child: Text(_adding
                    ? 'Adding…'
                    : price.ready
                        ? 'Add to cart'
                        : groups.isNotEmpty
                            ? 'Choose options'
                            : 'Unavailable'),
              ),
            ),
          ],
        ),
        if (_message != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_message!, style: TextStyle(color: theme.colorScheme.error)),
          ),
        if (_addons.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(_addons.first.groupLabel ?? 'Goes well with', style: theme.textTheme.titleMedium),
          for (final addon in _addons)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox.square(dimension: 48, child: Photo(addon.imageUrl)),
              ),
              title: Text(addon.name),
              subtitle: addon.priceCents == null ? null : Text(Money.cents(addon.priceCents)),
              trailing: OutlinedButton(
                onPressed: _addedAddons.contains(addon.id) ? null : () => _addAddon(addon),
                child: Text(_addedAddons.contains(addon.id) ? 'Added' : 'Add'),
              ),
            ),
        ],
        if (view.description.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(view.description, style: theme.textTheme.bodyLarge),
        ],
        if (view.features.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('Features', style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          for (final feature in view.features)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [const Text('•'), Expanded(child: Text(feature))],
              ),
            ),
        ],
        for (final group in view.specs) ...[
          const SizedBox(height: 24),
          Text(group.name, style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          for (final row in group.rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(row.label, style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor))),
                  Expanded(child: Text(row.value)),
                ],
              ),
            ),
        ],
        const SizedBox(height: 24),
        _ProductReviews(
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

class _Gallery extends StatelessWidget {
  const _Gallery({required this.urls, required this.name});

  final List<String> urls;
  final String name;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final side = constraints.maxWidth.clamp(0.0, 520.0);
          return SizedBox(
            height: side,
            child: PageView(
              key: ValueKey(urls.join()),
              children: [
                for (final (index, url) in urls.indexed)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Photo(url, label: urls.length > 1 ? '$name, photo ${index + 1} of ${urls.length}' : name),
                    ),
                  ),
              ],
            ),
          );
        },
      );
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.title, required this.options, required this.selected, required this.onSelect});

  final String title;
  final List<({String id, String label, bool available})> options;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final current = options.where((option) => option.id == selected).firstOrNull;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Text(current == null ? title : '$title: ${current.label}', style: Theme.of(context).textTheme.labelLarge),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in options)
                ChoiceChip(
                  label: Text(option.label),
                  selected: option.id == selected,
                  onSelected: option.available ? (_) => onSelect(option.id) : null,
                  tooltip: option.available ? null : '${option.label} is sold out',
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProductReviews extends StatelessWidget {
  const _ProductReviews({required this.page, required this.loading, required this.onMore});

  final ProductReviewPage? page;
  final bool loading;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final page = this.page;
    if (page == null || page.items.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 4,
        children: [
          Text('Reviews', style: theme.textTheme.titleMedium),
          Text(page == null && loading ? 'Loading…' : 'No reviews yet.', style: theme.textTheme.bodyMedium),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        Row(
          spacing: 8,
          children: [
            Text('Reviews', style: theme.textTheme.titleMedium),
            StarRating(page.avgRating ?? 0),
            Text('${(page.avgRating ?? 0).toStringAsFixed(1)} · ${page.totalCount}', style: theme.textTheme.bodySmall),
          ],
        ),
        for (final review in page.items)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              StarRating(review.rating.toDouble(), size: 13),
              if (review.title?.isNotEmpty ?? false) Text(review.title!, style: theme.textTheme.titleSmall),
              if (review.body?.isNotEmpty ?? false) Text(review.body!),
              Text(
                [review.reviewerName ?? 'Customer', Reviews.date(review.createdAt)].where((part) => part.isNotEmpty).join(' · '),
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        if (page.items.length < page.totalCount && onMore != null)
          OutlinedButton(
            onPressed: loading ? null : onMore,
            child: Text(loading ? 'Loading…' : 'Show more reviews'),
          ),
      ],
    );
  }
}
