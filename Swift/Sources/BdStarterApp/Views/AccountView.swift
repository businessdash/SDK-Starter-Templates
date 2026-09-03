import BusinessDashKit
import SwiftUI

/// Customer portal.
///
/// The whole portal is reachable with a **publishable** token —
/// `customer_portal:self` and `tenant_auth:public` are both in the
/// publishable scope set — so this needs no backend-for-frontend. That is the
/// fact that makes a native BD app practical.
struct AccountView: View {
    @Environment(BdEnvironment.self) private var bd
    @Environment(\.openURL) private var openURL

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

    private var signedOut: some View {
        ContentUnavailableView {
            Label("Not signed in", systemImage: "person.crop.circle")
        } description: {
            Text("Sign in to see your jobs, quotes and invoices.")
        } actions: {
            Button("Sign in") { Task { await startSignIn() } }
                .buttonStyle(.borderedProminent)
                .disabled(bd.auth == nil)

            if let signInError = model.signInError {
                Text(signInError).font(.footnote).foregroundStyle(.secondary)
            }
        }
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

    /// Opens the platform-hosted auth page. The callback returns on the app's
    /// custom URL scheme, which `onOpenURL` in the App body hands to
    /// `BdEnvironment.completeSignIn(code:state:)`.
    ///
    /// The model builds the URL; opening it is a view concern, which is why
    /// `openURL` stays here.
    private func startSignIn() async {
        model.bind(bd)
        if let url = await model.signInURL() { openURL(url) }
    }
}
