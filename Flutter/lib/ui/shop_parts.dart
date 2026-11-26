import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'compare_page.dart';
import 'product_page.dart';
import 'reviews_page.dart';

/// The web store's address (`--dart-define=BD_SITE_URL=https://…`), for a
/// product's "Copy link". Empty: no link to copy.
const bdSiteUrl = String.fromEnvironment('BD_SITE_URL');

/// What to tell the customer when a call fails: BD's own message when it
/// sent one (a coupon it doesn't know, a sold-out size), else [fallback].
String bdProblem(Object error, String fallback) => switch (error) {
      BdHttpException(message: final message?) when message.isNotEmpty =>
        message,
      BdAccessRejectedException(:final message) => message,
      _ => fallback,
    };

/// ★★★★☆, with the rating said out loud.
class StarRating extends StatelessWidget {
  const StarRating(this.rating, {super.key, this.size = 14});

  final double rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    final full = rating.round().clamp(0, 5);
    return Semantics(
      label: '${rating.toStringAsFixed(1)} out of 5',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 5; i++)
            Icon(i < full ? Icons.star : Icons.star_border,
                size: size, color: color),
        ],
      ),
    );
  }
}

/// A photo from the web, or a soft box while it loads or when there is none.
class Photo extends StatelessWidget {
  const Photo(this.url, {super.key, this.fit = BoxFit.cover, this.label});

  final String? url;
  final BoxFit fit;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final soft = Theme.of(context).colorScheme.surfaceContainerHighest;
    final url = this.url;
    if (url == null || url.isEmpty) return ColoredBox(color: soft);
    return Image.network(
      url,
      fit: fit,
      semanticLabel: label,
      excludeFromSemantics: label == null,
      errorBuilder: (_, _, _) => ColoredBox(color: soft),
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : ColoredBox(color: soft),
    );
  }
}

/// A product's page, over the current tab.
void openProduct(BuildContext context, String id) => Navigator.of(context)
    .push(MaterialPageRoute<void>(builder: (_) => ProductPage(productId: id)));

/// A card in the store grid: photo, badges, stars, "From" and sale prices.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final reviews = product.reviewCount ?? 0;
    final price = product.cheapestPriceCents;
    return Card.outlined(
      clipBehavior: Clip.antiAlias,
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: () => openProduct(context, product.id),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Photo(product.coverImage),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 4,
                      children: [
                        if (product.isBestSeller == true)
                          const _Badge('Best seller'),
                        if (product.isNew == true) const _Badge('New'),
                        if (product.isOnSale == true)
                          const _Badge('Sale', sale: true),
                      ],
                    ),
                  ),
                  Positioned(
                      top: 4,
                      right: 4,
                      child: SaveButtons(
                          product: SavedProduct.fromCard(product),
                          compact: true)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 4,
                children: [
                  Text(
                    product.name.isEmpty ? 'Untitled' : product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall,
                  ),
                  if (reviews > 0)
                    Row(spacing: 4, children: [
                      StarRating(product.avgRating ?? 0, size: 13),
                      Text('($reviews)', style: theme.textTheme.bodySmall),
                    ]),
                  Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        price == null
                            ? 'View details'
                            : '${product.hasMultipleVariants == true ? 'From ' : ''}${Money.cents(price)}',
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      if (product.isOnSale == true &&
                          product.comparePriceCents != null)
                        Text(
                          Money.cents(product.comparePriceCents),
                          style: theme.textTheme.bodySmall?.copyWith(
                              decoration: TextDecoration.lineThrough),
                        ),
                    ],
                  ),
                  if (product.isLowStock == true)
                    Text('Low stock',
                        style: theme.textTheme.labelSmall
                            ?.copyWith(color: theme.colorScheme.error)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, {this.sale = false});

  final String label;
  final bool sale;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: sale ? scheme.error : scheme.surface,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Text(
          label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: sale ? scheme.onError : scheme.onSurface),
        ),
      ),
    );
  }
}

/// Save to the wishlist (♥) and pick for comparing (⇄).
class SaveButtons extends StatelessWidget {
  const SaveButtons({super.key, required this.product, this.compact = false});

  final SavedProduct product;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final saved = app.wishlist.contains(product.id);
    final picked = app.compare.contains(product.id);
    final full = !picked && app.compare.isFull;
    void toggleCompare() => app.compare.toggle(product);
    if (compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton.filledTonal(
            iconSize: 18,
            visualDensity: VisualDensity.compact,
            isSelected: saved,
            tooltip: saved ? 'Remove from wishlist' : 'Save to wishlist',
            icon: const Icon(Icons.favorite_border),
            selectedIcon: const Icon(Icons.favorite),
            onPressed: () => app.wishlist.toggle(product),
          ),
          IconButton.filledTonal(
            iconSize: 18,
            visualDensity: VisualDensity.compact,
            isSelected: picked,
            tooltip: picked
                ? 'Remove from compare'
                : (full ? 'Compare holds four products' : 'Compare'),
            icon: const Icon(Icons.compare_arrows),
            onPressed: full ? null : toggleCompare,
          ),
        ],
      );
    }
    return Wrap(
      spacing: 8,
      children: [
        FilterChip(
          avatar:
              Icon(saved ? Icons.favorite : Icons.favorite_border, size: 18),
          showCheckmark: false,
          label: Text(saved ? 'Saved' : 'Save'),
          selected: saved,
          onSelected: (_) => app.wishlist.toggle(product),
        ),
        FilterChip(
          avatar: const Icon(Icons.compare_arrows, size: 18),
          showCheckmark: false,
          label: Text(picked ? 'Comparing' : 'Compare'),
          tooltip: full ? 'Compare holds four products' : null,
          selected: picked,
          onSelected: full ? null : (_) => toggleCompare(),
        ),
      ],
    );
  }
}

/// Along the bottom of the store while products are picked to compare.
class CompareBar extends StatelessWidget {
  const CompareBar({super.key});

  @override
  Widget build(BuildContext context) {
    final compare = AppScope.of(context).compare;
    final picks = compare.items.length;
    if (picks == 0) return const SizedBox.shrink();
    return Material(
      elevation: 3,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          child: Row(
            spacing: 8,
            children: [
              Expanded(
                  child: Text('$picks of ${compare.limit} picked to compare')),
              TextButton(onPressed: compare.clear, child: const Text('Clear')),
              FilledButton(
                onPressed: picks < 2
                    ? null
                    : () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => const ComparePage())),
                child: Text(picks < 2 ? 'Pick one more' : 'Compare'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A row of saved products (related, recently viewed).
class ProductRail extends StatelessWidget {
  const ProductRail({super.key, required this.title, required this.products});

  final String title;
  final List<SavedProduct> products;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Text(title, style: theme.textTheme.titleMedium),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final product = products[index];
              return SizedBox(
                width: 132,
                child: InkWell(
                  onTap: () => openProduct(context, product.id),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox.square(
                            dimension: 132, child: Photo(product.image)),
                      ),
                      Text(product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelLarge),
                      if (product.priceCents != null)
                        Text(Money.cents(product.priceCents),
                            style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// The business's rating at the top of the store; it opens the reviews.
class ReviewStrip extends StatelessWidget {
  const ReviewStrip({super.key, required this.totals});

  final ReviewTotals? totals;

  @override
  Widget build(BuildContext context) {
    final rating = totals?.rating;
    final total = totals?.totalCount ?? 0;
    if (rating == null || total == 0) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      label:
          'Rated ${rating.toStringAsFixed(1)} from $total reviews. See all reviews.',
      excludeSemantics: true,
      child: Material(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ReviewsPage())),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              spacing: 8,
              children: [
                StarRating(rating, size: 14),
                Text(rating.toStringAsFixed(1),
                    style: theme.textTheme.titleSmall),
                Expanded(
                  child: Text(
                    '· $total ${total == 1 ? 'review' : 'reviews'}',
                    style: theme.textTheme.bodyMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.chevron_right, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A centred title and, optionally, a line under it: an empty list, or a
/// screen that couldn't load.
class EmptyNote extends StatelessWidget {
  const EmptyNote(this.title, {super.key, this.detail});

  final String title;
  final String? detail;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          spacing: 6,
          children: [
            Text(title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium),
            if (detail != null) Text(detail!, textAlign: TextAlign.center),
          ],
        ),
      );
}
