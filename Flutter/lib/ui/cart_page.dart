import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import 'account_page.dart' show bdCallbackScheme;
import 'app_state.dart';
import 'bd_scope.dart';
import 'order_page.dart';
import 'shop_parts.dart';

/// The cart: each line's style and options, quantity, a coupon, the
/// subtotal, and checkout on Stripe's own page.
class CartPage extends StatefulWidget {
  const CartPage({super.key});

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  BdClient? _client;
  CartSnapshot? _cart;
  Object? _error;
  bool _busy = false;
  String? _note;
  final _coupon = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    _reload();
  }

  @override
  void dispose() {
    _coupon.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final client = _client;
    if (client == null) return;
    final visitor = BdScope.of(context).visitorToken;
    final app = AppScope.read(context);
    try {
      final cart = await client.cart(visitor);
      app.noteCart(cart);
      if (mounted) {
        setState(() {
          _cart = cart;
          _error = null;
        });
      }
    } on Exception catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  /// Runs a cart change; the cart it answers with is the one shown.
  Future<void> _change(Future<CartSnapshot> Function(BdClient client, String visitor) call, {String? failed}) async {
    final client = _client;
    if (client == null || _busy) return;
    final visitor = BdScope.of(context).visitorToken;
    final app = AppScope.read(context);
    setState(() {
      _busy = true;
      _note = null;
    });
    try {
      final cart = await call(client, visitor);
      app.noteCart(cart);
      if (mounted) setState(() => _cart = cart);
    } on Exception catch (error) {
      if (mounted) setState(() => _note = bdProblem(error, failed ?? "Couldn't update your cart. Try again."));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _applyCoupon() async {
    final code = _coupon.text.trim();
    if (code.isEmpty) return;
    await _change((client, visitor) => client.cartApplyCoupon(visitor, code), failed: "That code didn't work.");
    if (mounted && _cart?.couponCode != null) _coupon.clear();
  }

  /// Hands off to Stripe's own page in the browser — no card data touches
  /// this app, which keeps it out of PCI scope — and comes back on
  /// `bdstarter://checkout/success?session_id=…` to show the order.
  ///
  /// The field is `stripeUrl`, not `url`.
  Future<void> _checkout() async {
    final client = _client;
    if (client == null || _busy) return;
    final visitor = BdScope.of(context).visitorToken;
    final navigator = Navigator.of(context);
    setState(() {
      _busy = true;
      _note = null;
    });
    try {
      final session = await client.startCheckout(
        visitor,
        // Stripe substitutes the real id for the placeholder.
        successUrl: '$bdCallbackScheme://checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: '$bdCallbackScheme://checkout/cancel',
      );
      final back = Uri.parse(await FlutterWebAuth2.authenticate(url: session.stripeUrl, callbackUrlScheme: bdCallbackScheme));
      final sessionId = back.queryParameters['session_id'];
      if (back.path.endsWith('/success') && sessionId != null && sessionId.isNotEmpty) {
        await navigator.push(MaterialPageRoute<void>(builder: (_) => OrderPage(sessionId: sessionId)));
        if (mounted) await _reload();
      }
    } on PlatformException catch (error) {
      // Closing Stripe's page leaves the cart as it was.
      if (error.code != 'CANCELED' && mounted) setState(() => _note = "Couldn't open checkout. Try again.");
    } on Exception catch (error) {
      if (mounted) setState(() => _note = bdProblem(error, "Couldn't start checkout. Try again."));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = _cart;
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: switch ((_client, cart, _error)) {
        (null, _, _) => const Center(child: Text('Not connected to BD.')),
        (_, null, null) => const Center(child: CircularProgressIndicator()),
        (_, null, final error?) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(error is BdException && error.isUnavailable ? 'Temporarily unavailable.' : "Couldn't load your cart."),
                TextButton(onPressed: _reload, child: const Text('Try again')),
              ],
            ),
          ),
        (_, final cart?, _) when cart.isEmpty => _empty(context),
        (_, final cart?, _) => _lines(context, cart),
      },
    );
  }

  Widget _empty(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 6,
          children: [
            Text('Your cart is empty', style: Theme.of(context).textTheme.titleMedium),
            TextButton(
              onPressed: () => AppScope.read(context).showTab(context, AppTab.shop),
              child: const Text('Browse the store →'),
            ),
          ],
        ),
      );

  Widget _lines(BuildContext context, CartSnapshot cart) {
    final theme = Theme.of(context);
    final currency = cart.currency ?? 'USD';
    final coupon = cart.couponCode;
    return Column(
      children: [
        if (_busy) const LinearProgressIndicator(minHeight: 2),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              for (final item in cart.items) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 12,
                    children: [
                      GestureDetector(
                        onTap: item.productId == null ? null : () => openProduct(context, item.productId!),
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
                            if (item.variantTitle?.isNotEmpty ?? false)
                              Text(item.variantTitle!, style: theme.textTheme.bodySmall),
                            // Cart lines arrive DECIMAL, unlike product cards.
                            Text(Money.amount(item.unitPrice, currency: currency), style: theme.textTheme.bodySmall),
                            Row(
                              children: [
                                IconButton(
                                  tooltip: item.quantity <= 1 ? 'Remove' : 'One fewer',
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(Icons.remove),
                                  onPressed: _busy
                                      ? null
                                      : () => _change((client, visitor) => item.quantity <= 1
                                          ? client.cartRemove(visitor, item.id)
                                          : client.cartSetQuantity(visitor, itemId: item.id, quantity: item.quantity - 1)),
                                ),
                                Text('${item.quantity}', semanticsLabel: 'Quantity ${item.quantity}'),
                                IconButton(
                                  tooltip: 'One more',
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(Icons.add),
                                  onPressed: _busy
                                      ? null
                                      : () => _change((client, visitor) =>
                                          client.cartSetQuantity(visitor, itemId: item.id, quantity: item.quantity + 1)),
                                ),
                                const Spacer(),
                                TextButton(
                                  onPressed: _busy ? null : () => _change((client, visitor) => client.cartRemove(visitor, item.id)),
                                  child: const Text('Remove'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Text(Money.amount(item.subtotal ?? (item.unitPrice ?? 0) * item.quantity, currency: currency),
                          style: theme.textTheme.titleSmall),
                    ],
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
              ],
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: coupon != null
                    ? Row(
                        children: [
                          Expanded(child: Text('Coupon $coupon applied', style: theme.textTheme.bodyMedium)),
                          TextButton(
                            onPressed: _busy ? null : () => _change((client, visitor) => client.cartRemoveCoupon(visitor)),
                            child: const Text('Remove'),
                          ),
                        ],
                      )
                    : Row(
                        spacing: 8,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _coupon,
                              textCapitalization: TextCapitalization.characters,
                              onSubmitted: (_) => _applyCoupon(),
                              decoration: const InputDecoration(
                                hintText: 'Coupon code',
                                border: OutlineInputBorder(),
                                isDense: true,
                              ),
                            ),
                          ),
                          OutlinedButton(onPressed: _busy ? null : _applyCoupon, child: const Text('Apply')),
                        ],
                      ),
              ),
              if (_note != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(_note!, style: TextStyle(color: theme.colorScheme.error)),
                ),
            ],
          ),
        ),
        const Divider(height: 1),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              spacing: 8,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Subtotal', style: theme.textTheme.bodySmall),
                      Text(Money.amount(cart.subtotal, currency: currency), style: theme.textTheme.titleMedium),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: _busy ? null : () => _change((client, visitor) => client.cartClear(visitor)),
                  child: const Text('Clear'),
                ),
                FilledButton(onPressed: _busy ? null : _checkout, child: const Text('Checkout')),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
