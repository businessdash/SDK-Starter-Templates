import 'package:flutter/material.dart';

import 'package:biab/biab.dart';
import 'biab_scope.dart';
import 'load_state.dart';

class CartPage extends StatefulWidget {
  const CartPage({super.key});

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  Future<CartSnapshot>? _cart;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reload();
  }

  void _reload() {
    final scope = BiabScope.of(context);
    setState(() {
      _cart = scope.client?.cart(scope.visitorToken);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: BiabBuilder<CartSnapshot>(
        future: _cart,
        builder: (context, cart) {
          if (cart.isEmpty) {
            return const Center(child: Text('Your cart is empty.'));
          }

          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  itemCount: cart.items.length,
                  itemBuilder: (context, index) {
                    final item = cart.items[index];
                    return ListTile(
                      title: Text(item.name ?? 'Item'),
                      // Cart lines arrive DECIMAL, unlike product prices.
                      subtitle: Text(
                        '${Money.amount(item.unitPrice, currency: cart.currency ?? 'USD')}'
                        ' × ${item.quantity}',
                      ),
                    );
                  },
                ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Subtotal: '
                        '${Money.amount(cart.subtotal, currency: cart.currency ?? 'USD')}'),
                    FilledButton(
                      onPressed: _checkout,
                      child: const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Hands off to Stripe. Open the returned URL in a browser — no card data
  /// touches this process, which keeps the app out of PCI scope.
  ///
  /// The field is `stripeUrl`, not `url`.
  Future<void> _checkout() async {
    final scope = BiabScope.of(context);
    final client = scope.client;
    if (client == null) return;

    final session = await client.startCheckout(
      scope.visitorToken,
      // Stripe substitutes the real id for the placeholder.
      successUrl: 'biabstarter://checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'biabstarter://checkout/cancel',
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Open: ${session.stripeUrl}')),
    );
  }
}
