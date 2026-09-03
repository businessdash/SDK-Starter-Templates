import Foundation

/// Tenant sign-in / sign-up / sign-out.
///
/// The web starters bounce through a server-side callback route. A native app
/// has no server, so the callback comes back as a **custom URL scheme** —
/// `bdstarter://auth/callback` by default. That URL has to be registered
/// two places or `auth/start` refuses:
///
/// 1. `CFBundleURLTypes` in the app's Info.plist
/// 2. the redirect URIs on the BD site
///
/// The flow itself is the same three calls the web starters make. Present the
/// URL from ``startURL(intent:returnTo:)`` in an `ASWebAuthenticationSession`,
/// take the `code` and `state` off the callback, and hand them to
/// ``exchange(code:state:)``.
public struct BdAuth: Sendable {
    let client: BdClient
    let callbackURL: String

    public init(client: BdClient, callbackURL: String) {
        self.client = client
        self.callbackURL = callbackURL
    }

    public enum Intent: String, Sendable {
        case signIn = "sign-in"
        case signUp = "sign-up"
    }

    public func startURL(intent: Intent = .signIn, returnTo: String? = nil) async throws -> URL {
        struct Body: Encodable, Sendable {
            let intent: String
            let returnTo: String?
            let redirectUri: String
        }

        let response: TenantAuthStart = try await client.post(
            "auth/start",
            body: Body(intent: intent.rawValue, returnTo: returnTo, redirectUri: callbackURL)
        )

        guard let url = response.authURL else {
            throw BdError.configuration("auth/start returned a URL that could not be parsed.")
        }
        return url
    }

    public func exchange(code: String, state: String) async throws -> TenantAuthSession {
        struct Body: Encodable, Sendable {
            let code: String
            let state: String
            let redirectUri: String
        }

        return try await client.post(
            "auth/exchange",
            body: Body(code: code, state: state, redirectUri: callbackURL)
        )
    }

    /// Validate a stored token.
    ///
    /// Returns `nil` for absent / expired / revoked rather than throwing, so a
    /// stale Keychain entry shows a signed-out screen instead of an error
    /// alert on launch.
    ///
    /// ⚠️ This route takes a lowercase **`x-bd-session`** header, which is
    /// NOT the `X-BD-Session-Token` the cart and portal routes use.
    public func session(token: String?) async -> TenantSession? {
        guard let token, !token.isEmpty else { return nil }
        return try? await client.get(
            "auth/me",
            as: TenantSession.self,
            headers: ["x-bd-session": token]
        )
    }

    /// Best effort — the caller clears the Keychain either way, so a failed
    /// server-side revoke must not strand someone signed in locally.
    public func signOut() async {
        struct Empty: Decodable, Sendable {}
        _ = try? await client.post("auth/sign-out", as: Empty.self)
    }

    /// Pull `code` and `state` off a callback URL.
    public static func callbackParameters(from url: URL) -> (code: String, state: String)? {
        guard
            let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
            let code = items.first(where: { $0.name == "code" })?.value,
            let state = items.first(where: { $0.name == "state" })?.value,
            !code.isEmpty, !state.isEmpty
        else { return nil }
        return (code, state)
    }
}
