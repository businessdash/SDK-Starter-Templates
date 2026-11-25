import BusinessDashKit
import SwiftUI

/// Products saved on this device with ♡ Save.
struct WishlistView: View {
    @Environment(BdEnvironment.self) private var bd

    var body: some View {
        let items = bd.saved.wishlist.items
        List {
            ForEach(items) { item in
                NavigationLink {
                    ProductDetailView(productID: item.id)
                } label: {
                    HStack(spacing: 12) {
                        RemoteImage(url: item.image)
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).font(.headline)
                            if let cents = item.priceCents {
                                Text(Money.cents(cents)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .onDelete { offsets in
                for index in offsets { bd.saved.wishlist.remove(items[index].id) }
            }
        }
        .overlay {
            if items.isEmpty {
                ContentUnavailableView(
                    "Nothing saved yet",
                    systemImage: "heart",
                    description: Text("Tap ♡ on a product to keep it here.")
                )
            }
        }
        .navigationTitle("Wishlist")
    }
}
