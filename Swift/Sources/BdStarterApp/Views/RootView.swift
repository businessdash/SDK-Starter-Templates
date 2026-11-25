import BusinessDashKit
import SwiftUI

/// The starter's tab shell. Drop this into your `App` body:
///
/// ```swift
/// @main
/// struct MyApp: App {
///     @State private var bd = BdEnvironment()
///
///     var body: some Scene {
///         WindowGroup {
///             BdRootView()
///                 .environment(bd)
///                 .task { await bd.bootstrap() }
///         }
///     }
/// }
/// ```
public struct BdRootView: View {
    @Environment(BdEnvironment.self) private var bd
    /// Set when Stripe sends the customer back (see `OrderView`).
    @State private var order: OrderReturn?

    public init() {}

    public var body: some View {
        @Bindable var bd = bd
        TabView(selection: $bd.tab) {
            NavigationStack { StorefrontView() }
                .tabItem { Label("Shop", systemImage: "bag") }
                .tag(BdTab.shop)

            NavigationStack { CartView() }
                .tabItem { Label("Cart", systemImage: "cart") }
                .badge(bd.cartCount)
                .tag(BdTab.cart)

            NavigationStack { BlogView() }
                .tabItem { Label("Blog", systemImage: "text.book.closed") }
                .tag(BdTab.blog)

            NavigationStack { ChatView() }
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
                .tag(BdTab.chat)

            NavigationStack { AccountView() }
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
                .tag(BdTab.account)
        }
        .overlay(alignment: .top) {
            if !bd.isConfigured {
                SetupNotice()
            }
        }
        // bdstarter://checkout/success?session_id=…
        .onOpenURL { url in
            guard url.scheme == "bdstarter", url.host() == "checkout", url.path() == "/success",
                  let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                      .queryItems?.first(where: { $0.name == "session_id" })?.value
            else { return }
            order = OrderReturn(id: id)
        }
        .sheet(item: $order) { order in
            OrderView(sessionID: order.id)
        }
    }
}

private struct OrderReturn: Identifiable {
    let id: String
}

/// Shown until Info.plist carries the BD keys, so a fresh clone explains
/// itself instead of rendering empty lists.
struct SetupNotice: View {
    var body: some View {
        Text("Not connected to BD — set BDPublishableKey and BDSiteID in Info.plist.")
            .font(.footnote)
            .padding(8)
            .frame(maxWidth: .infinity)
            .background(.yellow.opacity(0.25))
    }
}
