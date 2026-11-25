import BusinessDashKit
import SwiftUI

/// Back from Stripe's checkout: whether the order is paid, by session id.
///
/// Checkout's success URL is `bdstarter://checkout/success?session_id=…`
/// (`CartViewModel`), so the app opens here when the customer comes back —
/// register the `bdstarter` URL scheme on your app target for that.
struct OrderView: View {
    let sessionID: String

    @Environment(BdEnvironment.self) private var bd
    @Environment(\.dismiss) private var dismiss
    @State private var status: CheckoutStatus?
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if !loaded {
                    ProgressView()
                } else if status?.isPaid == true {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 54)).foregroundStyle(.green)
                    Text("Thank you for your order").font(.title2.bold())
                    Text(status?.customerEmail.map { "Your payment went through. A receipt is on its way to \($0)." }
                        ?? "Your payment went through.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                } else {
                    Image(systemName: "clock").font(.system(size: 54)).foregroundStyle(.secondary)
                    Text("Your order").font(.title2.bold())
                    Text("We're confirming your payment. You'll get an email when it's done.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                Button("Continue shopping") {
                    bd.tab = .shop
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(32)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .task {
            status = try? await bd.cart?.checkoutStatus(sessionID: sessionID)
            // A paid order empties the cart.
            if let snapshot = try? await bd.cart?.snapshot() { bd.noteCart(snapshot) }
            loaded = true
        }
    }
}
