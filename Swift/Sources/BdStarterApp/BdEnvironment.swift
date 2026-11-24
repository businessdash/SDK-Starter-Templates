import BdSignIn
import BusinessDashKit
import Foundation
import Observation
import SwiftUI

/// App-wide BD state: the client, the session store, and who's signed in.
///
/// `@MainActor` because every consumer is a SwiftUI view. Network work still
/// happens off the main actor — `BdClient` is a `Sendable` value type and
/// `URLSession` suspends rather than blocking, so awaiting from here does not
/// stall the UI.
@MainActor
@Observable
public final class BdEnvironment {
    public let configuration: BdConfiguration?
    public let sessions: BdSessionStore

    public private(set) var session: TenantSession?
    public private(set) var visitorToken: String = ""

    /// Held in memory alongside `session` so `portal` is a plain computed
    /// property rather than something every call site has to await.
    /// The Keychain remains the source of truth across launches.
    private var sessionToken: String?

    /// False when Info.plist has no BD keys. Screens show local fallbacks
    /// and a setup notice instead of empty lists.
    public var isConfigured: Bool { configuration != nil }

    public init(
        configuration: BdConfiguration? = BdConfiguration.fromInfoPlist(),
        sessions: BdSessionStore = BdSessionStore()
    ) {
        self.configuration = configuration
        self.sessions = sessions
    }

    public var client: BdClient? { configuration?.client }

    /// Checks a stored session and signs out. The callback URL only matters to
    /// BD's hosted sign-in page, which this starter doesn't use.
    public var auth: BdAuth? {
        guard let client else { return nil }
        return BdAuth(client: client, callbackURL: configuration?.authCallbackURL ?? "")
    }

    /// For the native sign-in screen (`BdSignInView`): BD's customer sign-in
    /// routes, called with the publishable key. The account is the customer's
    /// own at this business, with its own password; no other business's sign-in
    /// knows it.
    public var signInBackend: BdServerSignInBackend<BdSignInSession>? {
        guard let configuration else { return nil }
        return .businessDash(publishableKey: configuration.publishableKey, host: configuration.host)
    }

    /// Call once on launch. Restores the cart visitor id and revalidates any
    /// stored session token.
    public func bootstrap() async {
        visitorToken = await sessions.visitorToken()

        guard let auth else { return }
        let token = await sessions.sessionToken()
        session = await auth.session(token: token)
        sessionToken = session == nil ? nil : token

        // A token the server rejected is dead weight; drop it so the next
        // launch doesn't pay for another round trip to learn the same thing.
        if session == nil, token != nil {
            await sessions.clearSessionToken()
        }
    }

    /// Keeps the session the sign-in screen got.
    public func adopt(_ signedIn: BdSignInSession) async {
        await sessions.setSessionToken(signedIn.sessionToken)
        session = await auth?.session(token: signedIn.sessionToken)
        sessionToken = session == nil ? nil : signedIn.sessionToken
        if session == nil { await sessions.clearSessionToken() }
    }

    public func signOut() async {
        await auth?.signOut()
        await sessions.clearSessionToken()
        session = nil
        sessionToken = nil
    }

    public var cart: CartResource? {
        guard let client, !visitorToken.isEmpty else { return nil }
        return client.cart(visitorToken: visitorToken)
    }

    public var portal: PortalResource? {
        guard let client, let session, let sessionToken else { return nil }
        return client.portal(sessionToken: sessionToken, organizationID: session.organizationId)
    }
}

// Injected with `.environment(bd)` and read with
// `@Environment(BdEnvironment.self)`, which is the idiom for an
// `@Observable` type.
//
// A custom `EnvironmentKey` was the obvious first move and doesn't compile
// under Swift 6: `EnvironmentKey.defaultValue` is a nonisolated static
// requirement, so satisfying it with a `@MainActor` instance crosses an
// isolation boundary and the compiler rejects the conformance. The
// `@Observable` path has no such requirement — there is no default to
// construct off the main actor.
