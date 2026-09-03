import 'package:flutter/material.dart';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'bd_scope.dart';
import 'load_state.dart';
import 'product_page.dart';

class StorefrontPage extends StatefulWidget {
  const StorefrontPage({super.key});

  @override
  State<StorefrontPage> createState() => _StorefrontPageState();
}

class _StorefrontPageState extends State<StorefrontPage> {
  Future<List<Product>>? _products;
  String _search = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  void _load() {
    final client = BdScope.of(context).client;
    setState(() {
      _products = client?.productGrid(search: _search);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shop')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search products',
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (value) {
                _search = value;
                _load();
              },
            ),
          ),
          Expanded(
            child: BdBuilder<List<Product>>(
              future: _products,
              builder: (context, products) {
                if (products.isEmpty) {
                  return const Center(child: Text('No products yet.'));
                }
                return ListView.separated(
                  itemCount: products.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final product = products[index];
                    return ListTile(
                      title: Text(product.name),
                      subtitle: Text(product.description ?? ''),
                      // Integer cents — see Money.
                      trailing: Text(
                        Money.cents(product.cheapestPriceCents),
                      ),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ProductPage(productId: product.id),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
