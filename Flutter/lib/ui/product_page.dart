import 'package:flutter/material.dart';

import 'package:biab/biab.dart';
import 'biab_scope.dart';
import 'load_state.dart';

class ProductPage extends StatefulWidget {
  const ProductPage({super.key, required this.productId});

  final String productId;

  @override
  State<ProductPage> createState() => _ProductPageState();
}

class _ProductPageState extends State<ProductPage> {
  Future<Product>? _product;
  String? _message;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _product ??= BiabScope.of(context).client?.product(widget.productId);
  }

  Future<void> _addToCart(Product product) async {
    final scope = BiabScope.of(context);
    final client = scope.client;
    if (client == null) return;

    try {
      await client.cartAdd(scope.visitorToken, productId: product.id);
      if (mounted) setState(() => _message = 'Added to cart.');
    } on BiabException catch (error) {
      if (mounted) setState(() => _message = '$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Product')),
      body: BiabBuilder<Product>(
        future: _product,
        builder: (context, product) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              // A card carries no currency — the cart does; USD is the default.
              Money.cents(product.cheapestPriceCents),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            Text(product.description ?? ''),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => _addToCart(product),
              child: const Text('Add to cart'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              Text(_message!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
