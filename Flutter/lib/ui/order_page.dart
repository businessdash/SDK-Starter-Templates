import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'bd_scope.dart';

/// Back from Stripe: whether the order went through.
class OrderPage extends StatefulWidget {
  const OrderPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<OrderPage> createState() => _OrderPageState();
}

class _OrderPageState extends State<OrderPage> {
  Future<CheckoutStatus?>? _status;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_status != null) return;
    final scope = BdScope.of(context);
    final client = scope.client;
    final app = AppScope.read(context);
    _status = client
        ?.checkoutStatus(widget.sessionId)
        .then<CheckoutStatus?>((status) => status, onError: (Object _) => null)
        // A paid order empties the cart.
        .whenComplete(() => client
            .cart(scope.visitorToken)
            .then(app.noteCart, onError: (Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: FutureBuilder<CheckoutStatus?>(
        future: _status,
        builder: (context, snapshot) {
          if (_status != null &&
              snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final status = snapshot.data;
          final paid = status?.isPaid ?? false;
          final email = status?.customerEmail;
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                spacing: 12,
                children: [
                  Icon(paid ? Icons.check_circle : Icons.hourglass_top,
                      size: 56, color: theme.colorScheme.primary),
                  Text(paid ? 'Thank you for your order' : 'Your order',
                      style: theme.textTheme.headlineSmall,
                      textAlign: TextAlign.center),
                  Text(
                    paid
                        ? email != null
                            ? 'Your payment went through. A receipt is on its way to $email.'
                            : 'Your payment went through.'
                        : "We're confirming your payment. You'll get an email when it's done.",
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () =>
                        AppScope.read(context).showTab(context, AppTab.shop),
                    child: const Text('Continue shopping'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
