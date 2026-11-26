import 'dart:async';

import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';
import 'store_parts.dart';
import 'wishlist_page.dart';

/// The store: the business's rating, search, categories with their counts,
/// sort, price and rating filters, and the product grid. The results on
/// screen stay while new ones load, so typing in the search box never loses
/// it.
///
/// It's laid out from parts: [ReviewStrip], [StoreSearchField],
/// [CategoryChips], [StoreResultsBar], [SliverProductGrid] (a [ProductCard]
/// each), [StoreFilterSheet] and [StoreNotice] (store_parts.dart,
/// shop_parts.dart).
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
  StoreFilters _filters =
      (sort: 'featured', minDollars: null, maxDollars: null, minRating: null);

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

  int? _cents(double? dollars) =>
      dollars == null ? null : (dollars * 100).round();

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
    _filters = (
      sort: _filters.sort,
      minDollars: null,
      maxDollars: null,
      minRating: null
    );
    _load();
  }

  int get _sheetCount =>
      (_filters.minDollars != null || _filters.maxDollars != null ? 1 : 0) +
      (_filters.minRating != null ? 1 : 0);

  bool get _narrowed =>
      _search.trim().isNotEmpty || _categoryId != null || _sheetCount > 0;

  Future<void> _openFilters() async {
    final next = await showModalBottomSheet<StoreFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => StoreFilterSheet(start: _filters, listing: _shown),
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
            icon: Badge.count(
                count: saved,
                isLabelVisible: saved > 0,
                child: const Icon(Icons.favorite_border)),
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const WishlistPage())),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
              child: _client == null
                  ? const StoreNotice('Not connected to BD.')
                  : _results(context)),
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
      if (error == null) {
        return const Center(child: CircularProgressIndicator());
      }
      final unavailable = error is BdException && error.isUnavailable;
      return StoreNotice(
        unavailable
            ? 'The store is temporarily unavailable.'
            : "Couldn't load the store.",
        action: TextButton(onPressed: _load, child: const Text('Try again')),
      );
    }
    final products = shown.items;
    final counted = _categories.where((category) =>
        (shown.categoryCounts[category.id] ?? 0) > 0 ||
        category.id == _categoryId);
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          sliver: SliverList.list(
            children: [
              ReviewStrip(totals: _totals),
              if (_totals?.rating != null) const SizedBox(height: 12),
              StoreSearchField(
                  controller: _searchBox, onChanged: _searchChanged),
              if (counted.isNotEmpty) ...[
                const SizedBox(height: 10),
                CategoryChips(
                  categories: counted.toList(),
                  counts: shown.categoryCounts,
                  selected: _categoryId,
                  onSelect: (id) {
                    _categoryId = id;
                    _load();
                  },
                ),
              ],
              const SizedBox(height: 8),
              StoreResultsBar(
                count: products.length,
                loading: _loading,
                failed: error != null,
                filterCount: _sheetCount,
                sort: _filters.sort,
                onFilters: _openFilters,
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
                  Text(_narrowed ? 'No matches' : 'No products yet',
                      style: theme.textTheme.titleMedium),
                  if (_narrowed)
                    TextButton(
                        onPressed: _clearAll,
                        child: const Text('Clear all filters')),
                ],
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverProductGrid(products: products),
          ),
      ],
    );
  }
}
