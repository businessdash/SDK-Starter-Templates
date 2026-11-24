import BdSignIn
import BusinessDashKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Customer portal.
///
/// The whole portal is reachable with a **publishable** token —
/// `customer_portal:self` and `tenant_auth:public` are both in the
/// publishable scope set — so this needs no backend-for-frontend. That is the
/// fact that makes a native BD app practical.
///
/// Signed out, it's the SDK's native sign-in (`BdSignInView`): the business's
/// name from BD and the app's "BrandLogo" image, never BD's. A customer's
/// account here is their own at this business, with its own password.
struct AccountView: View {
    @Environment(BdEnvironment.self) private var bd

    @State private var model = AccountViewModel()

    var body: some View {
        Group {
            if bd.session == nil {
                signedOut
            } else {
                signedIn
            }
        }
        .navigationTitle("Account")
    }

    @ViewBuilder
    private var signedOut: some View {
        if let backend = bd.signInBackend {
            BdSignInView(
                brand: BdSignInBrand(
                    logo: Self.brandLogo,
                    tagline: "Sign in to see your jobs, quotes and invoices."
                ),
                backend: backend
            ) { signedIn in
                Task { await bd.adopt(signedIn) }
            }
        } else {
            ContentUnavailableView {
                Label("Not connected to BD", systemImage: "person.crop.circle")
            } description: {
                Text("Set BDPublishableKey and BDSiteID (BdStarter.xcconfig) to turn on sign-in.")
            }
        }
    }

    /// The app's "BrandLogo" image, if its asset catalog has one.
    private static var brandLogo: Image? {
        #if canImport(UIKit)
        UIImage(named: "BrandLogo").map(Image.init(uiImage:))
        #elseif canImport(AppKit)
        NSImage(named: "BrandLogo").map(Image.init(nsImage:))
        #else
        nil
        #endif
    }

    @ViewBuilder
    private var signedIn: some View {
        List {
            Section {
                LabeledContent("Signed in as", value: bd.session?.user.displayName ?? "")
                Button("Sign out", role: .destructive) {
                    Task { await bd.signOut() }
                }
            }

            if let state = model.state {
                switch state {
                case .loading:
                    ProgressView()
                case .loaded(let work):
                    Section("Jobs") {
                        let jobs = work.jobs ?? []
                        if jobs.isEmpty {
                            Text("Nothing here yet.").foregroundStyle(.secondary)
                        } else {
                            ForEach(jobs) { job in
                                LabeledContent(job.name ?? "Job", value: job.status ?? "")
                            }
                        }
                    }

                    Section("Invoices") {
                        let invoices = work.invoices ?? []
                        if invoices.isEmpty {
                            Text("None outstanding.").foregroundStyle(.secondary)
                        } else {
                            ForEach(invoices) { invoice in
                                LabeledContent(
                                    invoice.invoiceNumber ?? "Invoice",
                                    // DECIMAL, not cents — see CustomerQuote.
                                    value: Money.amount(invoice.totalAmount)
                                )
                            }
                        }
                    }
                case .failed(let message, _):
                    Text(message).foregroundStyle(.secondary)
                }
            }
        }
        // Re-keyed on the org: a customer who switches company must not be
        // shown the previous one's work while the new load is in flight.
        .task(id: bd.session?.organizationId) {
            model.bind(bd)
            await model.loadWork()
        }
    }

}
