import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'shop_parts.dart';

// The product page's parts. [ProductPage] lays them out; each takes plain
// values and callbacks, so you can move, restyle, drop or replace any of
// them, or lay out a product page of your own:
//
//     ProductGallery(urls: view.gallery(variantId), name: view.name)
//     ProductTitle(categoryName: view.categoryName, name: view.name)
//     ProductPriceText(price: view.price(variantId, chosen))
//     VariantPicker(variants: view.variants, selected: variantId, onSelect: ...)
//
// The rules (which photos, what "from" means, what can be bought) are
// [ProductView]'s, in businessdash_sdk.

/// One choice in an [OptionRow]: a variant, or an option's value.
typedef ChoiceOption = ({String id, String label, bool available});

/// The photos for the chosen option, swiped sideways a page at a time.
class ProductGallery extends StatelessWidget {
  const ProductGallery({super.key, required this.urls, required this.name});

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

/// The category above the product's name.
class ProductTitle extends StatelessWidget {
  const ProductTitle({super.key, this.categoryName, required this.name});

  final String? categoryName;
  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (categoryName != null) Text(categoryName!, style: theme.textTheme.bodySmall),
        Text(name, style: theme.textTheme.headlineSmall),
      ],
    );
  }
}

/// The price for what's chosen: "From" until every option is picked,
/// Unavailable when there's nothing to buy.
class ProductPriceText extends StatelessWidget {
  const ProductPriceText({super.key, required this.price});

  final ProductPrice price;

  @override
  Widget build(BuildContext context) {
    final amount = price.amount;
    return Text(
      amount == null ? 'Unavailable' : '${price.from ? 'From ' : ''}${Money.amount(amount)}',
      style: Theme.of(context).textTheme.titleLarge,
    );
  }
}

/// "Only 3 left", at five or fewer.
class StockNote extends StatelessWidget {
  const StockNote({super.key, required this.stock});

  final int? stock;

  @override
  Widget build(BuildContext context) {
    final stock = this.stock;
    if (stock == null || stock <= 0 || stock > 5) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Text('Only $stock left',
        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error, fontWeight: FontWeight.w600));
  }
}

/// A chip per variant (the style), the chosen one selected; sold-out ones
/// can't be chosen. Nothing shows for a product with one variant.
class VariantPicker extends StatelessWidget {
  const VariantPicker({super.key, required this.variants, required this.selected, required this.onSelect});

  final List<ProductVariant> variants;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    if (variants.length <= 1) return const SizedBox.shrink();
    return OptionRow(
      title: 'Style',
      options: [for (final variant in variants) (id: variant.id, label: variant.name, available: variant.available)],
      selected: selected,
      onSelect: onSelect,
    );
  }
}

/// One option group (Size, Colour…): a chip per value.
class OptionPicker extends StatelessWidget {
  const OptionPicker({super.key, required this.group, required this.selected, required this.onSelect});

  final OptionGroup group;
  /// The chosen value's id.
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => OptionRow(
        title: group.title,
        options: [for (final value in group.values) (id: value.id, label: value.value, available: value.available)],
        selected: selected,
        onSelect: onSelect,
      );
}

/// A titled row of choice chips, the chosen one named beside the title.
class OptionRow extends StatelessWidget {
  const OptionRow({super.key, required this.title, required this.options, required this.selected, required this.onSelect});

  final String title;
  final List<ChoiceOption> options;
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

/// − and + around how many to add, from 1 up to [max].
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({super.key, required this.quantity, required this.max, required this.onChanged});

  final int quantity;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      label: 'Quantity $quantity',
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
              onPressed: quantity > 1 ? () => onChanged(quantity - 1) : null,
            ),
            Text('$quantity', style: theme.textTheme.titleMedium),
            IconButton(
              tooltip: 'One more',
              icon: const Icon(Icons.add),
              onPressed: quantity < max ? () => onChanged(quantity + 1) : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Add to cart; "Choose options" until every option is picked, Unavailable
/// when there's nothing to buy. Null [onPressed] disables it.
class AddToCartButton extends StatelessWidget {
  const AddToCartButton({
    super.key,
    required this.price,
    required this.adding,
    required this.hasOptions,
    required this.onPressed,
  });

  final ProductPrice price;
  final bool adding;
  /// The chosen variant has option groups (so "Choose options", not
  /// Unavailable, until they're picked).
  final bool hasOptions;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
        onPressed: adding || !price.ready ? null : onPressed,
        child: Text(adding
            ? 'Adding…'
            : price.ready
                ? 'Add to cart'
                : hasOptions
                    ? 'Choose options'
                    : 'Unavailable'),
      );
}

/// What went wrong adding to the cart.
class ProductNotice extends StatelessWidget {
  const ProductNotice(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      );
}

/// The add-ons ("Goes well with"), each with Add. Nothing shows without any.
class ProductAddons extends StatelessWidget {
  const ProductAddons({super.key, required this.addons, this.added = const {}, required this.onAdd});

  final List<ProductAddon> addons;
  /// The ids of the add-ons already added.
  final Set<String> added;
  final ValueChanged<ProductAddon> onAdd;

  @override
  Widget build(BuildContext context) {
    if (addons.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 24),
        Text(addons.first.groupLabel ?? 'Goes well with', style: Theme.of(context).textTheme.titleMedium),
        for (final addon in addons)
          AddonTile(addon: addon, added: added.contains(addon.id), onAdd: () => onAdd(addon)),
      ],
    );
  }
}

/// One add-on: photo, name, price and Add.
class AddonTile extends StatelessWidget {
  const AddonTile({super.key, required this.addon, required this.added, required this.onAdd});

  final ProductAddon addon;
  final bool added;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox.square(dimension: 48, child: Photo(addon.imageUrl)),
        ),
        title: Text(addon.name),
        subtitle: addon.priceCents == null ? null : Text(Money.cents(addon.priceCents)),
        trailing: OutlinedButton(
          onPressed: added ? null : onAdd,
          child: Text(added ? 'Added' : 'Add'),
        ),
      );
}

/// The description, the features, then each group of specs.
class ProductDetails extends StatelessWidget {
  const ProductDetails({super.key, required this.description, required this.features, required this.specs});

  ProductDetails.of(ProductView view, {Key? key})
      : this(key: key, description: view.description, features: view.features, specs: view.specs);

  final String description;
  final List<String> features;
  final List<SpecGroup> specs;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (description.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(description, style: theme.textTheme.bodyLarge),
        ],
        if (features.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('Features', style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          for (final feature in features)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [const Text('•'), Expanded(child: Text(feature))],
              ),
            ),
        ],
        for (final group in specs) ...[
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
      ],
    );
  }
}

/// The product's reviews: the average, each review, and Show more reviews
/// (when [onMore] is set and there are more).
class ProductReviews extends StatelessWidget {
  const ProductReviews({super.key, required this.page, this.loading = false, this.onMore});

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
        for (final review in page.items) ProductReviewTile(review: review),
        if (page.items.length < page.totalCount && onMore != null)
          OutlinedButton(
            onPressed: loading ? null : onMore,
            child: Text(loading ? 'Loading…' : 'Show more reviews'),
          ),
      ],
    );
  }
}

/// One review of the product: stars, title, words, and who and when.
class ProductReviewTile extends StatelessWidget {
  const ProductReviewTile({super.key, required this.review});

  final ProductReview review;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
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
    );
  }
}
