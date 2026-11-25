/// The product page's rules: which photos show for a style, the option
/// groups (Size…) that apply to it, what "from $40" means, and what goes on
/// the cart line. The web starters' `src/shop/shop.ts`, the Swift kit's
/// `Shop.swift` and this file answer the same way.
///
/// Money: product cards carry integer CENTS (`cheapestPriceCents`);
/// variants, options and cart lines carry DOLLARS. Each value says which.
library;

class ProductVariant {
  const ProductVariant({required this.id, required this.name, this.price, this.stock, required this.available});

  final String id;
  final String name;

  /// Dollars.
  final double? price;

  /// Null: not tracked.
  final int? stock;
  final bool available;
}

class OptionValue {
  const OptionValue({
    required this.id,
    required this.titleId,
    required this.value,
    required this.price,
    this.stock,
    required this.available,
  });

  final String id;
  final String titleId;
  final String value;

  /// Dollars, added to the option total.
  final double price;
  final int? stock;
  final bool available;
}

class OptionGroup {
  const OptionGroup({required this.id, required this.title, required this.values});

  final String id;
  final String title;
  final List<OptionValue> values;
}

class SpecRow {
  const SpecRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  bool operator ==(Object other) => other is SpecRow && other.label == label && other.value == value;

  @override
  int get hashCode => Object.hash(label, value);
}

class SpecGroup {
  const SpecGroup({required this.name, required this.rows});

  final String name;
  final List<SpecRow> rows;
}

class _OptionTitle {
  const _OptionTitle({required this.id, required this.title, this.variantId});

  final String id;
  final String title;
  final String? variantId;
}

class _VariantImage {
  const _VariantImage({required this.variantId, required this.url, required this.order});

  final String variantId;
  final String url;
  final double order;
}

/// The price shown for a style and the options chosen so far.
class ProductPrice {
  const ProductPrice({this.amount, required this.from, this.stock, required this.ready});

  /// Dollars; null when there is nothing to buy.
  final double? amount;

  /// True while options are still being chosen: the lowest it can be.
  final bool from;
  final int? stock;

  /// Every option group has a choice and the choice can be bought.
  final bool ready;

  @override
  bool operator ==(Object other) =>
      other is ProductPrice && other.amount == amount && other.from == from && other.stock == stock && other.ready == ready;

  @override
  int get hashCode => Object.hash(amount, from, stock, ready);

  @override
  String toString() => 'ProductPrice(amount: $amount, from: $from, stock: $stock, ready: $ready)';
}

const _sizeOrder = ['XXS', '2XS', 'XS', 'S', 'SM', 'M', 'MD', 'L', 'LG', 'XL', '2XL', 'XXL', '3XL', '4XL'];

/// A `storefront/products/{id}` response, shaped for the product page.
class ProductView {
  ProductView._({
    required this.id,
    required this.name,
    required this.description,
    this.categoryId,
    this.categoryName,
    required this.images,
    required this.variants,
    required List<_VariantImage> variantImages,
    required List<_OptionTitle> optionTitles,
    required this.optionValues,
    required this.features,
    required this.specs,
  })  : _variantImages = variantImages,
        _optionTitles = optionTitles;

  final String id;
  final String name;
  final String description;
  final String? categoryId;
  final String? categoryName;

  /// The product's own photos, in order.
  final List<String> images;
  final List<ProductVariant> variants;
  final List<_VariantImage> _variantImages;
  final List<_OptionTitle> _optionTitles;
  final List<OptionValue> optionValues;
  final List<String> features;
  final List<SpecGroup> specs;

  factory ProductView.fromJson(Map<String, dynamic> json) {
    final category = json['category'];
    final productImages = _stableSorted(
      _records(json['productImages'])
          .map((image) => (url: _text(image['url']), order: _num(image['order']) ?? 0))
          .where((image) => image.url.isNotEmpty)
          .toList(),
      (a, b) => a.order.compareTo(b.order),
    );
    final images = json['images'] is List
        ? (json['images'] as List).map(_text).where((url) => url.isNotEmpty).toList()
        : <String>[];
    final specs = json['specifications'] is Map ? json['specifications'] as Map : const {};
    final name = _text(json['name']);
    final categoryId = _text(json['categoryId']);
    final categoryName = category is Map ? _text(category['name']) : '';
    return ProductView._(
      id: _text(json['id']),
      name: name.isEmpty ? 'Untitled' : name,
      description: _text(json['description']),
      categoryId: categoryId.isEmpty ? null : categoryId,
      categoryName: categoryName.isEmpty ? null : categoryName,
      images: images.isNotEmpty ? images : productImages.map((image) => image.url).toList(),
      variants: _records(json['variants']).map((variant) {
        final name = _text(variant['name']);
        final stock = _num(variant['stock'])?.toInt();
        return ProductVariant(
          id: _text(variant['id']),
          name: name.isEmpty ? 'Default' : name,
          price: _num(variant['price']),
          stock: stock,
          available: variant['isLive'] != false && stock != 0,
        );
      }).toList(),
      variantImages: _records(json['variantImages'])
          .map((image) => _VariantImage(
                variantId: _text(image['variantId']),
                url: _text(image['url']),
                order: _num(image['order']) ?? 0,
              ))
          .where((image) => image.url.isNotEmpty)
          .toList(),
      optionTitles: _records(json['crossVariantTitles']).map((title) {
        final variantId = _text(title['variantId']);
        return _OptionTitle(
          id: _text(title['id']),
          title: _text(title['title']),
          variantId: variantId.isEmpty ? null : variantId,
        );
      }).toList(),
      optionValues: _records(json['crossVariants']).map((option) {
        final stock = _num(option['stock'])?.toInt();
        return OptionValue(
          id: _text(option['id']),
          titleId: _text(option['crossVariantTitleId']),
          value: _text(option['value']),
          price: _num(option['price']) ?? 0,
          stock: stock,
          available: option['isLive'] != false && stock != 0,
        );
      }).toList(),
      features: specs['features'] is List
          ? (specs['features'] as List).map(_text).where((feature) => feature.isNotEmpty).toList()
          : const [],
      specs: _records(specs['groups'])
          .map((group) => SpecGroup(
                name: _text(group['name']),
                rows: _records(group['rows'])
                    .map((row) => SpecRow(label: _text(row['label']), value: _text(row['value'])))
                    .where((row) => row.label.isNotEmpty && row.value.isNotEmpty)
                    .toList(),
              ))
          .where((group) => group.name.isNotEmpty && group.rows.isNotEmpty)
          .toList(),
    );
  }

  /// The style a page opens on: the first one that can be bought.
  ProductVariant? get defaultVariant {
    for (final variant in variants) {
      if (variant.available) return variant;
    }
    return variants.isEmpty ? null : variants.first;
  }

  /// The photos for a style: its own when it has any, else the product's.
  List<String> gallery(String variantId) {
    final own = _stableSorted(
      _variantImages.where((image) => image.variantId == variantId).toList(),
      (a, b) => a.order.compareTo(b.order),
    );
    return own.isNotEmpty ? own.map((image) => image.url).toList() : images;
  }

  /// The option groups (Size, Colour…) that apply to a style. Sizes go
  /// smallest first.
  List<OptionGroup> optionGroups(String variantId) => _optionTitles
      .where((title) => title.variantId == null || title.variantId == variantId)
      .map((title) {
        final values = optionValues.where((option) => option.titleId == title.id).toList();
        if (RegExp(r'^sizes?$', caseSensitive: false).hasMatch(title.title)) {
          int rank(String value) {
            final i = _sizeOrder.indexOf(value.toUpperCase());
            return i == -1 ? _sizeOrder.length : i;
          }

          // Sizes it doesn't know keep their order, after the ones it does.
          final sorted = _stableSorted(values, (a, b) => rank(a.value).compareTo(rank(b.value)));
          values
            ..clear()
            ..addAll(sorted);
        }
        return OptionGroup(id: title.id, title: title.title, values: values);
      })
      .where((group) => group.values.isNotEmpty)
      .toList();

  /// The price for a style and the options chosen so far (`chosen` maps an
  /// option group's id to an option value's id).
  ProductPrice price(String variantId, Map<String, String> chosen) {
    ProductVariant? variant;
    for (final candidate in variants) {
      if (candidate.id == variantId) variant = candidate;
    }
    if (variant == null || !variant.available) {
      return const ProductPrice(from: false, stock: 0, ready: false);
    }
    final groups = optionGroups(variantId);
    if (groups.isEmpty) {
      return ProductPrice(amount: variant.price, from: false, stock: variant.stock, ready: true);
    }
    final picks = [
      for (final group in groups) _firstWhere(group.values, (value) => value.id == chosen[group.id]),
    ];
    if (picks.any((pick) => pick == null)) {
      var lowest = 0.0;
      for (final group in groups) {
        final open = group.values.where((value) => value.available).map((value) => value.price);
        if (open.isNotEmpty) lowest += open.reduce((a, b) => a < b ? a : b);
      }
      return ProductPrice(amount: lowest, from: true, ready: false);
    }
    if (picks.any((pick) => !pick!.available)) {
      return const ProductPrice(from: false, stock: 0, ready: false);
    }
    final stocks = picks.map((pick) => pick!.stock).whereType<int>();
    return ProductPrice(
      amount: picks.fold<double>(0, (sum, pick) => sum + pick!.price),
      from: false,
      stock: stocks.isEmpty ? null : stocks.reduce((a, b) => a < b ? a : b),
      ready: true,
    );
  }

  /// The chosen options as the cart line's `options` (`{'Size': 'M'}`), or
  /// null when none apply.
  Map<String, String>? chosenOptions(String variantId, Map<String, String> chosen) {
    final out = <String, String>{};
    for (final group in optionGroups(variantId)) {
      final value = _firstWhere(group.values, (value) => value.id == chosen[group.id]);
      if (value != null) out[group.title] = value.value;
    }
    return out.isEmpty ? null : out;
  }
}

/// Sorted, with equal items kept in their order (as JavaScript's sort does;
/// Dart's makes no such promise).
List<T> _stableSorted<T>(List<T> items, int Function(T, T) compare) {
  final indexed = items.asMap().entries.toList()
    ..sort((a, b) {
      final order = compare(a.value, b.value);
      return order != 0 ? order : a.key.compareTo(b.key);
    });
  return indexed.map((entry) => entry.value).toList();
}

T? _firstWhere<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

String _text(Object? value) => value is String ? value.trim() : '';

double? _num(Object? value) => value is num && value.isFinite ? value.toDouble() : null;

List<Map<String, dynamic>> _records(Object? value) =>
    value is List ? value.whereType<Map<dynamic, dynamic>>().map((item) => item.cast<String, dynamic>()).toList() : const [];
