import BiabKit
import SwiftUI

/// Customer portal.
///
/// The whole portal is reachable with a **publishable** token —
/// `customer_portal:self` and `tenant_auth:public` are both in the
/// publishable scope set — so this needs no backend-for-frontend. That is the
/// fact that makes a native BIAB app practical.
struct AccountView: View {
    @Environment(BiabEnvironment.self) private var biab
    @Environment(\.openURL) private var openURL

    @State private var state: LoadState<CustomerWorkBundle>?
    @State private var signInError: String?

    var body: some View {
        Group {
            if biab.session == nil {
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
                .disabled(biab.auth == nil)

            if let signInError {
                Text(signInError).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var signedIn: some View {
        List {
            Section {
                LabeledContent("Signed in as", value: biab.session?.user.displayName ?? "")
                Button("Sign out", role: .destructive) {
                    Task { await biab.signOut() }
                }
            }

            if let state {
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
        .task(id: biab.session?.organizationId) { await loadWork() }
    }

    private func loadWork() async {
        guard let portal = biab.portal else { return }
        state = await LoadState { try await portal.work() }
    }

    /// Opens the platform-hosted auth page. The callback returns on the app's
    /// custom URL scheme, which `onOpenURL` in the App body hands to
    /// `BiabEnvironment.completeSignIn(code:state:)`.
    ///
    /// A production app would present this in `ASWebAuthenticationSession`
    /// instead, so the browser sheet closes itself and the callback is
    /// delivered directly. `openURL` keeps this starter free of
    /// AuthenticationServices and UIKit presentation-anchor plumbing.
    private func startSignIn() async {
        guard let auth = biab.auth else {
            signInError = "Set BIABAuthCallbackURL in Info.plist to enable sign-in."
            return
        }

        do {
            openURL(try await auth.startURL())
        } catch let error as BiabError {
            signInError = error.errorDescription
        } catch {
            signInError = error.localizedDescription
        }
    }
}
