import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'shop_parts.dart';

/// The products saved with ♡, kept on this device.
class WishlistPage extends StatelessWidget {
  const WishlistPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final wishlist = AppScope.of(context).wishlist;
    final items = wishlist.items;
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: items.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [
                    Text('Your wishlist is empty', style: theme.textTheme.titleMedium),
                    const Text('Tap ♡ on a product to save it here.', textAlign: TextAlign.center),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final item = items[index];
                return ListTile(
                  leading: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox.square(dimension: 56, child: Photo(item.image)),
                  ),
                  title: Text(item.name.isEmpty ? 'Untitled' : item.name),
                  subtitle: item.priceCents == null ? null : Text(Money.cents(item.priceCents)),
                  trailing: TextButton(onPressed: () => wishlist.remove(item.id), child: const Text('Remove')),
                  onTap: () => openProduct(context, item.id),
                );
              },
            ),
    );
  }
}
