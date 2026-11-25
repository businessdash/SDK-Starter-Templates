import 'dart:async';

import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';
import 'wishlist_page.dart';

const _sorts = {
  'featured': 'Featured',
  'newest': 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Top rated',
};

/// What the filter sheet sets: price in dollars, rating in whole stars.
typedef _Filters = ({String sort, double? minDollars, double? maxDollars, int? minRating});

/// The store: the business's rating, search, categories with their counts,
/// sort, price and rating filters, and the product grid. The results on
/// screen stay while new ones load, so typing in the search box never loses
/// it.
class StorefrontPage extends StatefulWidget {
  const StorefrontPage({super.key});

  @override
  State<StorefrontPage> createState() => _StorefrontPageState();
}

class _StorefrontPageState extends State<StorefrontPage> {
  final _searchBox = TextEditingController();
  Timer? _typing;
  BdClient? _client;

  String _search = '';
  String? _categoryId;
  _Filters _filters = (sort: 'featured', minDollars: null, maxDollars: null, minRating: null);

  ProductListing? _shown;
  Object? _error;
  bool _loading = false;
  int _ticket = 0;
  List<ProductCategory> _categories = const [];
  ReviewTotals? _totals;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    if (client == null) return;
    _load();
    client.categories().then((items) {
      if (mounted) setState(() => _categories = items);
    }, onError: (Object _) {});
    client.reviewTotals().then((totals) {
      if (mounted) setState(() => _totals = totals);
    }, onError: (Object _) {});
  }

  @override
  void dispose() {
    _typing?.cancel();
    _searchBox.dispose();
    super.dispose();
  }

  int? _cents(double? dollars) => dollars == null ? null : (dollars * 100).round();

  Future<void> _load() async {
    final client = _client;
    if (client == null) return;
    final ticket = ++_ticket;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final listing = await client.productListing(
        search: _search.trim(),
        categoryId: _categoryId,
        minPriceCents: _cents(_filters.minDollars),
        maxPriceCents: _cents(_filters.maxDollars),
        minRating: _filters.minRating,
        sort: _filters.sort,
      );
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _shown = listing;
        _loading = false;
      });
    } on Exception catch (error) {
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _searchChanged(String value) {
    _typing?.cancel();
    _typing = Timer(const Duration(milliseconds: 300), () {
      if (value.trim() == _search.trim()) return;
      _search = value;
      _load();
    });
  }

  void _clearAll() {
    _typing?.cancel();
    _searchBox.clear();
    _search = '';
    _categoryId = null;
    _filters = (sort: _filters.sort, minDollars: null, maxDollars: null, minRating: null);
    _load();
  }

  int get _sheetCount =>
      (_filters.minDollars != null || _filters.maxDollars != null ? 1 : 0) + (_filters.minRating != null ? 1 : 0);

  bool get _narrowed => _search.trim().isNotEmpty || _categoryId != null || _sheetCount > 0;

  Future<void> _openFilters() async {
    final next = await showModalBottomSheet<_Filters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FilterSheet(start: _filters, listing: _shown),
    );
    if (next == null || !mounted) return;
    _filters = next;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final saved = app.wishlist.items.length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shop'),
        actions: [
          IconButton(
            tooltip: saved == 0 ? 'Wishlist' : 'Wishlist, $saved saved',
            icon: Badge.count(count: saved, isLabelVisible: saved > 0, child: const Icon(Icons.favorite_border)),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const WishlistPage())),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _client == null ? const _Notice('Not connected to BD.') : _results(context)),
          const CompareBar(),
        ],
      ),
    );
  }

  Widget _results(BuildContext context) {
    final theme = Theme.of(context);
    final shown = _shown;
    final error = _error;
    if (shown == null) {
      if (error == null) return const Center(child: CircularProgressIndicator());
      final unavailable = error is BdException && error.isUnavailable;
      return _Notice(
        unavailable ? 'The store is temporarily unavailable.' : "Couldn't load the store.",
        action: TextButton(onPressed: _load, child: const Text('Try again')),
      );
    }
    final products = shown.items;
    final counted = _categories.where((category) => (shown.categoryCounts[category.id] ?? 0) > 0 || category.id == _categoryId);
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          sliver: SliverList.list(
            children: [
              ReviewStrip(totals: _totals),
              if (_totals?.rating != null) const SizedBox(height: 12),
              TextField(
                controller: _searchBox,
                onChanged: _searchChanged,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  hintText: 'Search products',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              if (counted.isNotEmpty) ...[
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('All'),
                        selected: _categoryId == null,
                        onSelected: (_) {
                          _categoryId = null;
                          _load();
                        },
                      ),
                      for (final category in counted)
                        ChoiceChip(
                          label: Text('${category.name} ${shown.categoryCounts[category.id] ?? 0}'),
                          selected: _categoryId == category.id,
                          onSelected: (_) {
                            _categoryId = _categoryId == category.id ? null : category.id;
                            _load();
                          },
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                spacing: 8,
                children: [
                  Text('${products.length} ${products.length == 1 ? 'product' : 'products'}',
                      style: theme.textTheme.bodyMedium),
                  if (_loading)
                    const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  else if (error != null)
                    Flexible(
                      child: Text("Couldn't update. Try again.",
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
                    ),
                  const Spacer(),
                  Flexible(
                    flex: 3,
                    child: TextButton.icon(
                      onPressed: _openFilters,
                      icon: const Icon(Icons.tune, size: 18),
                      label: Text(
                        '${_sheetCount > 0 ? 'Filters ($_sheetCount)' : 'Filters'} · ${_sorts[_filters.sort]}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (products.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                spacing: 8,
                children: [
                  Text(_narrowed ? 'No matches' : 'No products yet', style: theme.textTheme.titleMedium),
                  if (_narrowed) TextButton(onPressed: _clearAll, child: const Text('Clear all filters')),
                ],
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverLayoutBuilder(
              builder: (context, constraints) {
                // Two columns on a phone, more when wider. A card is its
                // square photo plus room for the text under it.
                const gap = 12.0;
                final columns = (constraints.crossAxisExtent / 240).ceil().clamp(2, 6);
                final width = (constraints.crossAxisExtent - gap * (columns - 1)) / columns;
                return SliverGrid.builder(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: gap,
                    crossAxisSpacing: gap,
                    mainAxisExtent: width + MediaQuery.textScalerOf(context).scale(132),
                  ),
                  itemCount: products.length,
                  itemBuilder: (context, index) => ProductCard(product: products[index]),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.start, required this.listing});

  final _Filters start;
  final ProductListing? listing;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _sort = widget.start.sort;
  late int? _minRating = widget.start.minRating;
  late final _min = TextEditingController(text: _dollars(widget.start.minDollars));
  late final _max = TextEditingController(text: _dollars(widget.start.maxDollars));

  static String _dollars(double? value) =>
      value == null ? '' : (value == value.roundToDouble() ? value.toInt().toString() : value.toStringAsFixed(2));

  static double? _read(TextEditingController box) {
    final value = double.tryParse(box.text.replaceAll(RegExp(r'[$,\s]'), ''));
    return value == null || value < 0 ? null : value;
  }

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final low = widget.listing?.minDollars;
    final high = widget.listing?.maxDollars;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 12,
          children: [
            Row(
              children: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                Expanded(child: Text('Filters', textAlign: TextAlign.center, style: theme.textTheme.titleMedium)),
                TextButton(
                  onPressed: () {
                    var min = _read(_min);
                    var max = _read(_max);
                    if (min != null && max != null && min > max) (min, max) = (max, min);
                    Navigator.pop<_Filters>(context, (sort: _sort, minDollars: min, maxDollars: max, minRating: _minRating));
                  },
                  child: const Text('Apply'),
                ),
              ],
            ),
            Text('Sort', style: theme.textTheme.labelLarge),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final MapEntry(key: value, value: label) in _sorts.entries)
                  ChoiceChip(label: Text(label), selected: _sort == value, onSelected: (_) => setState(() => _sort = value)),
              ],
            ),
            Text('Price', style: theme.textTheme.labelLarge),
            Row(
              spacing: 12,
              children: [
                Expanded(
                  child: TextField(
                    controller: _min,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Min',
                      hintText: low == null ? null : '\$${low.floor()}',
                      border: const OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _max,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Max',
                      hintText: high == null ? null : '\$${high.ceil()}',
                      border: const OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
            Text('Rating', style: theme.textTheme.labelLarge),
            Wrap(
              spacing: 8,
              children: [
                for (final stars in [4, 3, 2])
                  ChoiceChip(
                    label: Text('$stars★ & up'),
                    selected: _minRating == stars,
                    onSelected: (_) => setState(() => _minRating = _minRating == stars ? null : stars),
                  ),
              ],
            ),
            TextButton(
              style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
              onPressed: () => setState(() {
                _min.clear();
                _max.clear();
                _minRating = null;
              }),
              child: const Text('Clear price and rating'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.message, {this.action});

  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: 8,
            children: [Text(message, textAlign: TextAlign.center), ?action],
          ),
        ),
      );
}
