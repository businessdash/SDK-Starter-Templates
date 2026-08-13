import BiabKit
import Foundation
import Observation
import SwiftUI

/// App-wide BIAB state: the client, the session store, and who's signed in.
///
/// `@MainActor` because every consumer is a SwiftUI view. Network work still
/// happens off the main actor — `BiabClient` is a `Sendable` value type and
/// `URLSession` suspends rather than blocking, so awaiting from here does not
/// stall the UI.
@MainActor
@Observable
public final class BiabEnvironment {
    public let configuration: BiabConfiguration?
    public let sessions: BiabSessionStore

    public private(set) var session: TenantSession?
    public private(set) var visitorToken: String = ""

    /// Held in memory alongside `session` so `portal` is a plain computed
    /// property rather than something every call site has to await.
    /// The Keychain remains the source of truth across launches.
    private var sessionToken: String?

    /// False when Info.plist has no BIAB keys. Screens show local fallbacks
    /// and a setup notice instead of empty lists.
    public var isConfigured: Bool { configuration != nil }

    public init(
        configuration: BiabConfiguration? = BiabConfiguration.fromInfoPlist(),
        sessions: BiabSessionStore = BiabSessionStore()
    ) {
        self.configuration = configuration
        self.sessions = sessions
    }

    public var client: BiabClient? { configuration?.client }

    public var auth: BiabAuth? {
        guard let client, let callback = configuration?.authCallbackURL else { return nil }
        return BiabAuth(client: client, callbackURL: callback)
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

    public func completeSignIn(code: String, state: String) async throws {
        guard let auth else { return }
        let result = try await auth.exchange(code: code, state: state)
        await sessions.setSessionToken(result.sessionToken)
        session = await auth.session(token: result.sessionToken)
        sessionToken = session == nil ? nil : result.sessionToken
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

// Injected with `.environment(biab)` and read with
// `@Environment(BiabEnvironment.self)`, which is the idiom for an
// `@Observable` type.
//
// A custom `EnvironmentKey` was the obvious first move and doesn't compile
// under Swift 6: `EnvironmentKey.defaultValue` is a nonisolated static
// requirement, so satisfying it with a `@MainActor` instance crosses an
// isolation boundary and the compiler rejects the conformance. The
// `@Observable` path has no such requirement — there is no default to
// construct off the main actor.
