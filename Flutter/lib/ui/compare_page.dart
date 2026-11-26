import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';

typedef _Column = ({ProductView view, ProductReviewPage? reviews});

/// Up to four products side by side: price, rating, category, styles and
/// every spec any of them has.
class ComparePage extends StatefulWidget {
  const ComparePage({super.key});

  @override
  State<ComparePage> createState() => _ComparePageState();
}

class _ComparePageState extends State<ComparePage> {
  String? _loadedFor;
  Future<List<_Column>>? _columns;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    final ids =
        AppScope.of(context).compare.items.map((item) => item.id).toList();
    final key = '${identityHashCode(client)}:${ids.join(',')}';
    if (key == _loadedFor) return;
    _loadedFor = key;
    _columns = client == null ? null : _load(client, ids);
  }

  /// A product that can't be loaded drops out rather than failing the table.
  static Future<List<_Column>> _load(BdClient client, List<String> ids) async {
    final columns = await Future.wait(ids.map((id) async {
      try {
        final (view, reviews) = await (
          client.productDetail(id),
          client.productReviews(id, limit: 1).then<ProductReviewPage?>(
              (page) => page,
              onError: (Object _) => null),
        ).wait;
        return (view: view, reviews: reviews);
      } on Exception {
        return null;
      }
    }));
    return columns.whereType<_Column>().toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final compare = AppScope.of(context).compare;
    return Scaffold(
      appBar: AppBar(title: const Text('Compare')),
      body: compare.items.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                spacing: 6,
                children: [
                  Text('Nothing to compare',
                      style: theme.textTheme.titleMedium),
                  const Text('Tap ⇄ on up to four products.'),
                ],
              ),
            )
          : FutureBuilder<List<_Column>>(
              future: _columns,
              builder: (context, snapshot) {
                if (_columns == null) {
                  return const Center(child: Text('Not connected to BD.'));
                }
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                final columns = snapshot.data ?? const <_Column>[];
                if (columns.isEmpty) {
                  return const Center(
                      child: Text("Couldn't load these products."));
                }
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: _table(context, columns, compare),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                        onPressed: compare.clear,
                        child: const Text('Clear compare')),
                  ],
                );
              },
            ),
    );
  }

  Widget _table(
      BuildContext context, List<_Column> columns, SavedList compare) {
    final theme = Theme.of(context);
    String price(_Column column) {
      final amount = column.view.defaultVariant?.price;
      return amount == null ? '—' : Money.amount(amount);
    }

    String rating(_Column column) {
      final reviews = column.reviews;
      return reviews == null || reviews.totalCount == 0
          ? 'No reviews'
          : '${(reviews.avgRating ?? 0).toStringAsFixed(1)} ★ (${reviews.totalCount})';
    }

    // Every spec label, in the order first met.
    final labels = <String>[];
    for (final column in columns) {
      for (final group in column.view.specs) {
        for (final row in group.rows) {
          if (!labels.contains(row.label)) labels.add(row.label);
        }
      }
    }
    String spec(_Column column, String label) {
      for (final group in column.view.specs) {
        for (final row in group.rows) {
          if (row.label == label) return row.value;
        }
      }
      return '—';
    }

    final rows = <(String, String Function(_Column))>[
      ('Price', price),
      ('Rating', rating),
      ('Category', (column) => column.view.categoryName ?? '—'),
      (
        'Options',
        (column) {
          final names =
              column.view.variants.map((variant) => variant.name).join(', ');
          return names.isEmpty ? '—' : names;
        }
      ),
      for (final label in labels) (label, (column) => spec(column, label)),
    ];

    const width = 150.0;
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    return Table(
      defaultColumnWidth: const FixedColumnWidth(width),
      columnWidths: const {0: FixedColumnWidth(96)},
      border: TableBorder(
          horizontalInside:
              BorderSide(color: theme.colorScheme.outlineVariant)),
      children: [
        TableRow(
          children: [
            const SizedBox.shrink(),
            for (final column in columns)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 8, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 6,
                  children: [
                    InkWell(
                      onTap: () => openProduct(context, column.view.id),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox.square(
                            dimension: width - 12,
                            child: Photo(column.view.images.firstOrNull)),
                      ),
                    ),
                    Text(column.view.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall),
                    TextButton(
                      style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact),
                      onPressed: () => compare.remove(column.view.id),
                      child: const Text('Remove'),
                    ),
                  ],
                ),
              ),
          ],
        ),
        for (final (label, value) in rows)
          TableRow(
            children: [
              Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(label, style: muted)),
              for (final column in columns)
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 10, 8, 10),
                  child: Text(value(column)),
                ),
            ],
          ),
      ],
    );
  }
}
