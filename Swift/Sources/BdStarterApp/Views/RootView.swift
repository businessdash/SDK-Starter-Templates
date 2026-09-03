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
///                 .onOpenURL { url in
///                     // The auth callback comes back on your custom scheme.
///                     guard let (code, state) = BdAuth.callbackParameters(from: url) else { return }
///                     Task { try? await bd.completeSignIn(code: code, state: state) }
///                 }
///         }
///     }
/// }
/// ```
public struct BdRootView: View {
    @Environment(BdEnvironment.self) private var bd

    public init() {}

    public var body: some View {
        TabView {
            NavigationStack { StorefrontView() }
                .tabItem { Label("Shop", systemImage: "bag") }

            NavigationStack { CartView() }
                .tabItem { Label("Cart", systemImage: "cart") }

            NavigationStack { BlogView() }
                .tabItem { Label("Blog", systemImage: "text.book.closed") }

            NavigationStack { ChatView() }
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }

            NavigationStack { AccountView() }
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .overlay(alignment: .top) {
            if !bd.isConfigured {
                SetupNotice()
            }
        }
    }
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
