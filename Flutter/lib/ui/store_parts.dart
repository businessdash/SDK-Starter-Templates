import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'shop_parts.dart';

// The store list's and the cart's parts. [StorefrontPage] and [CartPage] lay
// them out; each takes plain values and callbacks, so you can move, restyle,
// drop or replace any of them. The product card, save buttons, compare bar
// and rating strip are in shop_parts.dart.

/// The sorts the store offers, by value.
const storeSorts = {
  'featured': 'Featured',
  'newest': 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Top rated',
};

/// What the filter sheet sets: price in dollars, rating in whole stars.
typedef StoreFilters = ({String sort, double? minDollars, double? maxDollars, int? minRating});

/// Search the products.
class StoreSearchField extends StatelessWidget {
  const StoreSearchField({super.key, required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: const InputDecoration(
          hintText: 'Search products',
          prefixIcon: Icon(Icons.search),
          border: OutlineInputBorder(),
          isDense: true,
        ),
      );
}

/// All, then a chip per category with its count; choosing the chosen one
/// again clears it.
class CategoryChips extends StatelessWidget {
  const CategoryChips({
    super.key,
    required this.categories,
    required this.counts,
    required this.selected,
    required this.onSelect,
  });

  final List<ProductCategory> categories;
  /// Products per category id.
  final Map<String, int> counts;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          spacing: 8,
          children: [
            ChoiceChip(
              label: const Text('All'),
              selected: selected == null,
              onSelected: (_) => onSelect(null),
            ),
            for (final category in categories)
              ChoiceChip(
                label: Text('${category.name} ${counts[category.id] ?? 0}'),
                selected: selected == category.id,
                onSelected: (_) => onSelect(selected == category.id ? null : category.id),
              ),
          ],
        ),
      );
}

/// "12 products", a spinner while loading (or "Couldn't update"), and
/// Filters with how many are set and the sort.
class StoreResultsBar extends StatelessWidget {
  const StoreResultsBar({
    super.key,
    required this.count,
    this.loading = false,
    this.failed = false,
    required this.filterCount,
    required this.sort,
    required this.onFilters,
  });

  final int count;
  final bool loading;
  final bool failed;
  /// Filters set in the sheet (price, rating).
  final int filterCount;
  /// The sort's value (see [storeSorts]).
  final String sort;
  final VoidCallback onFilters;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      spacing: 8,
      children: [
        Text('$count ${count == 1 ? 'product' : 'products'}', style: theme.textTheme.bodyMedium),
        if (loading)
          const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2))
        else if (failed)
          Flexible(
            child: Text("Couldn't update. Try again.",
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
          ),
        const Spacer(),
        Flexible(
          flex: 3,
          child: TextButton.icon(
            onPressed: onFilters,
            icon: const Icon(Icons.tune, size: 18),
            label: Text(
              '${filterCount > 0 ? 'Filters ($filterCount)' : 'Filters'} · ${storeSorts[sort]}',
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
    );
  }
}

/// The products, two across on a phone and more when wider: a
/// [ProductCard] each. A sliver, for a [CustomScrollView].
class SliverProductGrid extends StatelessWidget {
  const SliverProductGrid({super.key, required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) => SliverLayoutBuilder(
        builder: (context, constraints) {
          // A card is its square photo plus room for the text under it.
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
      );
}

/// Sort, price and rating, applied together: the sheet pops with the
/// [StoreFilters] chosen, or nothing on Cancel.
class StoreFilterSheet extends StatefulWidget {
  const StoreFilterSheet({super.key, required this.start, required this.listing});

  final StoreFilters start;
  /// The list on screen, for the catalogue's prices as placeholders.
  final ProductListing? listing;

  @override
  State<StoreFilterSheet> createState() => _StoreFilterSheetState();
}

class _StoreFilterSheetState extends State<StoreFilterSheet> {
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
                    Navigator.pop<StoreFilters>(context, (sort: _sort, minDollars: min, maxDollars: max, minRating: _minRating));
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
                for (final MapEntry(key: value, value: label) in storeSorts.entries)
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

/// A centred message, with an action under it: the store couldn't load.
class StoreNotice extends StatelessWidget {
  const StoreNotice(this.message, {super.key, this.action});

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

/// A line in the cart: photo, name, option, price each, − and + (− at one
/// removes it), Remove, and the line's total. Null callbacks disable them
/// (while the cart is busy).
class CartLine extends StatelessWidget {
  const CartLine({
    super.key,
    required this.item,
    required this.currency,
    this.onOpen,
    required this.onDecrease,
    required this.onIncrease,
    required this.onRemove,
  });

  final CartItem item;
  final String currency;
  /// Opens the product.
  final VoidCallback? onOpen;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          GestureDetector(
            onTap: onOpen,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox.square(dimension: 64, child: Photo(item.image)),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(item.name ?? 'Item', style: theme.textTheme.titleSmall),
                // The style and options, as the store wrote them.
                if (item.variantTitle?.isNotEmpty ?? false) Text(item.variantTitle!, style: theme.textTheme.bodySmall),
                // Cart lines arrive DECIMAL, unlike product cards.
                Text(Money.amount(item.unitPrice, currency: currency), style: theme.textTheme.bodySmall),
                Row(
                  children: [
                    IconButton(
                      tooltip: item.quantity <= 1 ? 'Remove' : 'One fewer',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.remove),
                      onPressed: onDecrease,
                    ),
                    Text('${item.quantity}', semanticsLabel: 'Quantity ${item.quantity}'),
                    IconButton(
                      tooltip: 'One more',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.add),
                      onPressed: onIncrease,
                    ),
                    const Spacer(),
                    TextButton(onPressed: onRemove, child: const Text('Remove')),
                  ],
                ),
              ],
            ),
          ),
          Text(Money.amount(item.subtotal ?? (item.unitPrice ?? 0) * item.quantity, currency: currency),
              style: theme.textTheme.titleSmall),
        ],
      ),
    );
  }
}

/// The coupon: a box and Apply, or the applied code with Remove. Null
/// callbacks disable them.
class CouponField extends StatelessWidget {
  const CouponField({
    super.key,
    required this.coupon,
    required this.controller,
    required this.onApply,
    required this.onRemove,
  });

  /// The code applied, if any.
  final String? coupon;
  final TextEditingController controller;
  final VoidCallback? onApply;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final coupon = this.coupon;
    if (coupon != null) {
      return Row(
        children: [
          Expanded(child: Text('Coupon $coupon applied', style: Theme.of(context).textTheme.bodyMedium)),
          TextButton(onPressed: onRemove, child: const Text('Remove')),
        ],
      );
    }
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            textCapitalization: TextCapitalization.characters,
            onSubmitted: onApply == null ? null : (_) => onApply!(),
            decoration: const InputDecoration(
              hintText: 'Coupon code',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        OutlinedButton(onPressed: onApply, child: const Text('Apply')),
      ],
    );
  }
}

/// The subtotal, Clear and Checkout. Null callbacks disable them.
class CartSummaryBar extends StatelessWidget {
  const CartSummaryBar({
    super.key,
    required this.subtotal,
    required this.currency,
    required this.onClear,
    required this.onCheckout,
  });

  final num? subtotal;
  final String currency;
  final VoidCallback? onClear;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Subtotal', style: theme.textTheme.bodySmall),
              Text(Money.amount(subtotal, currency: currency), style: theme.textTheme.titleMedium),
            ],
          ),
        ),
        TextButton(onPressed: onClear, child: const Text('Clear')),
        FilledButton(onPressed: onCheckout, child: const Text('Checkout')),
      ],
    );
  }
}
