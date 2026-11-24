import Foundation

/// Where sign-in goes: BD's `auth/customer/*` routes, which run every
/// password, code and provider sign-in through WorkOS — the same accounts as
/// BD's hosted sign-in, so a password, Apple, Google, GitHub and Discord all
/// reach one person.
///
/// Those routes take the business's **publishable** key (`tenant_auth:public`
/// is in the publishable scope set), so an app can call BD directly with
/// ``BdServerSignInBackend/businessDash(publishableKey:host:urlSession:)``.
/// An app whose server keeps the BD key instead points
/// ``BdServerSignInBackend`` at its own routes, which take the same JSON and
/// hand back the server's own session. Supply your own conformance for
/// anything else (a test double, a different transport).
public protocol BdSignInBackend: Sendable {
    /// What a successful sign-in gives the app (a token from its server, a session).
    associatedtype Session: Sendable

    /// The business's name and which ways to sign in it offers.
    func options() async throws -> BdSignInOptions
    /// Signed in — or, when WorkOS wants the email confirmed first, a code sent
    /// to it (finish with ``verify(pendingId:code:newPassword:)``, no new password).
    func signIn(email: String, password: String) async throws -> BdPasswordSignIn<Session>
    /// Emails a code. A new account is made when the code comes back (``verify(pendingId:code:newPassword:)``).
    func startSignUp(email: String, password: String, firstName: String?, lastName: String?) async throws -> BdCodeSent
    /// Emails a code for a new password. Unknown emails get the same answer, so nobody can probe who has an account.
    func startReset(email: String) async throws -> BdCodeSent
    /// The emailed code: makes the account, or sets `newPassword`, and signs in.
    func verify(pendingId: String, code: String, newPassword: String?) async throws -> Session
    /// An ID token from Sign in with Apple or Google, checked by BD against the business's app.
    func signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?) async throws -> Session
    /// "Continue with …": WorkOS's link for the provider. The sign-in comes back
    /// to `redirectURI` (the app's own scheme) with `bd_oauth_code`.
    func startOAuth(provider: BdOAuthProvider, redirectURI: String, codeChallenge: String) async throws -> URL
    /// Redeems a provider sign-in's `bd_oauth_code` with the PKCE verifier behind its challenge.
    func finishOAuth(code: String, codeVerifier: String) async throws -> Session
}

extension BdSignInBackend {
    public func startOAuth(provider: BdOAuthProvider, redirectURI: String, codeChallenge: String) async throws -> URL {
        throw BdSignInError.unavailable
    }

    public func finishOAuth(code: String, codeVerifier: String) async throws -> Session {
        throw BdSignInError.unavailable
    }
}

/// What a password sign-in comes to.
public enum BdPasswordSignIn<Session: Sendable>: Sendable {
    case signedIn(Session)
    /// WorkOS wants the email confirmed first and has emailed a code.
    case confirmEmail(BdCodeSent)
}

public struct BdSignInOptions: Codable, Sendable, Equatable {
    /// The business's name, as BD knows it.
    public var name: String?
    public var password: Bool
    /// Apple / Google from the app's own sheet (the business listed its app ids).
    public var apple: Bool
    public var google: Bool
    /// "Continue with …" links, through WorkOS, as BD lists them. Read
    /// ``oauthProviders`` — unknown names are skipped there.
    public var oauth: [String]?
    /// The business's brand colours (Settings → Branding), `#rrggbb`: the
    /// primary for the main button, the secondary for links. nil (or an older
    /// BD that doesn't send them): the app's own.
    public var primaryColor: String?
    public var secondaryColor: String?
    /// The business's logo (https), shown when the app gives none.
    public var logoUrl: String?

    /// The links to offer, in BD's order.
    public var oauthProviders: [BdOAuthProvider] { (oauth ?? []).compactMap(BdOAuthProvider.init(rawValue:)) }

    public init(
        name: String? = nil, password: Bool = true, apple: Bool = false, google: Bool = false,
        oauth: [BdOAuthProvider] = [],
        primaryColor: String? = nil, secondaryColor: String? = nil, logoUrl: String? = nil
    ) {
        self.name = name
        self.password = password
        self.apple = apple
        self.google = google
        self.oauth = oauth.map(\.rawValue)
        self.primaryColor = primaryColor
        self.secondaryColor = secondaryColor
        self.logoUrl = logoUrl
    }
}

/// A code is on its way (or would be, for an email with no account).
public struct BdCodeSent: Codable, Sendable, Equatable {
    public var pendingId: String
    public var expiresAt: String

    public init(pendingId: String, expiresAt: String) {
        self.pendingId = pendingId
        self.expiresAt = expiresAt
    }
}

/// The providers whose ID token the app can get from the phone's own sheet.
public enum BdSignInProvider: String, Codable, Sendable {
    case apple, google
}

/// The "Continue with …" providers, in the order the screen shows them.
public enum BdOAuthProvider: String, Codable, Sendable, CaseIterable {
    case apple, google, github, discord
}

/// What went wrong, in words the person can act on. `code` is BD's
/// (`invalid_credentials`, `invalid_code`, `code_expired`, `weak_password`,
/// `locked`, `too_many_tries`, …), or `offline` / `unavailable`.
public struct BdSignInError: LocalizedError, Sendable, Equatable {
    public let code: String
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }

    public var errorDescription: String? { message }

    public static let offline = BdSignInError(code: "offline", message: "You're offline. Check your connection and try again.")
    public static let unavailable = BdSignInError(code: "unavailable", message: "Sign-in isn't available just now. Try again in a minute.")
}

/// What BD's sign-in routes answer: who signed in, at which business, and the
/// token for `x-bd-session` (`auth/me`, the customer portal, …). Always a
/// customer session: `role` is nil.
public struct BdSignInSession: Decodable, Sendable, Equatable {
    public struct User: Decodable, Sendable, Equatable {
        public let id: String
        public let email: String?
        public let firstName: String?
        public let lastName: String?

        /// "First Last", or the email when BD has no name.
        public var displayName: String {
            let name = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
            return name.isEmpty ? (email ?? "") : name
        }
    }

    public let user: User
    public let organizationId: String
    public let role: String?
    public let sessionToken: String
    /// ISO 8601.
    public let expiresAt: String
}

extension BdServerSignInBackend where Session == BdSignInSession {
    /// Straight to BD's `auth/customer/` routes with the business's publishable
    /// `pk_…` key, the one the app already ships. No server needed.
    public static func businessDash(
        publishableKey: String,
        host: URL = URL(string: "https://businessdash.us")!,
        urlSession: URLSession = .shared
    ) -> Self {
        // Allow, don't deny: secret keys start with bd_, so only "is it a pk_
        // token" catches every one. Empty means the app has no key yet.
        let key = publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        precondition(key.isEmpty || key.hasPrefix("pk_"), "Use the publishable pk_ key in an app, never a secret key.")
        return Self(
            baseURL: host.appending(path: "api/package/v1/auth/customer"),
            headers: ["Authorization": "Bearer \(publishableKey)"],
            urlSession: urlSession
        )
    }
}

/// Sign-in through BD (``businessDash(publishableKey:host:urlSession:)``) or
/// the app's own server. It takes BD's request bodies at
/// `baseURL` + `options` (GET), `sign-in`, `sign-up`, `forgot-password`,
/// `verify` and `id-token` (POST), passes them to BD's
/// `auth/customer/*` with its key, and answers with:
///
/// - `sign-up`, `forgot-password`: `{ pendingId, expiresAt }`
/// - `sign-in`: its own session, decoded as `Session` — or `{ pendingId,
///   expiresAt }` when the email must be confirmed first
/// - `verify`, `id-token`, `oauth/exchange`: its own session
/// - `oauth/start`: `{ url }`
/// - a problem: `{ error, message }` with a 4xx or 5xx status
public struct BdServerSignInBackend<Session: Decodable & Sendable>: BdSignInBackend {
    public let baseURL: URL
    private let urlSession: URLSession
    private let headers: [String: String]

    public init(baseURL: URL, headers: [String: String] = [:], urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.headers = headers
        self.urlSession = urlSession
    }

    public func options() async throws -> BdSignInOptions {
        try await call("options", body: nil as Empty?)
    }

    public func signIn(email: String, password: String) async throws -> BdPasswordSignIn<Session> {
        let data = try await send("sign-in", body: ["email": email, "password": password])
        if let sent = try? JSONDecoder().decode(CodeSentOnly.self, from: data), sent.sessionToken == nil {
            return .confirmEmail(BdCodeSent(pendingId: sent.pendingId, expiresAt: sent.expiresAt))
        }
        return .signedIn(try decode(data))
    }

    public func startOAuth(provider: BdOAuthProvider, redirectURI: String, codeChallenge: String) async throws -> URL {
        let reply: OAuthStart = try await call(
            "oauth/start",
            body: OAuthStartBody(provider: provider, redirectUri: redirectURI, codeChallenge: codeChallenge)
        )
        guard let url = URL(string: reply.url) else { throw BdSignInError.unavailable }
        return url
    }

    public func finishOAuth(code: String, codeVerifier: String) async throws -> Session {
        try await call("oauth/exchange", body: ["code": code, "codeVerifier": codeVerifier])
    }

    public func startSignUp(email: String, password: String, firstName: String?, lastName: String?) async throws -> BdCodeSent {
        try await call("sign-up", body: SignUp(email: email, password: password, firstName: firstName, lastName: lastName))
    }

    public func startReset(email: String) async throws -> BdCodeSent {
        try await call("forgot-password", body: ["email": email])
    }

    public func verify(pendingId: String, code: String, newPassword: String?) async throws -> Session {
        try await call("verify", body: Verify(pendingId: pendingId, code: code, newPassword: newPassword))
    }

    public func signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?) async throws -> Session {
        try await call("id-token", body: IdToken(provider: provider, idToken: idToken, nonce: nonce, firstName: firstName, lastName: lastName))
    }

    // MARK: Transport

    private struct Empty: Encodable {}
    private struct SignUp: Encodable { let email, password: String; let firstName, lastName: String? }
    private struct Verify: Encodable { let pendingId, code: String; let newPassword: String? }
    private struct IdToken: Encodable {
        let provider: BdSignInProvider
        let idToken: String
        let nonce, firstName, lastName: String?
    }
    private struct Problem: Decodable { let error: String?; let message: String? }
    private struct CodeSentOnly: Decodable { let pendingId, expiresAt: String; let sessionToken: String? }
    private struct OAuthStartBody: Encodable { let provider: BdOAuthProvider; let redirectUri, codeChallenge: String }
    private struct OAuthStart: Decodable { let url: String }

    private func call<Body: Encodable, Reply: Decodable>(_ path: String, body: Body?) async throws -> Reply {
        try decode(try await send(path, body: body))
    }

    private func decode<Reply: Decodable>(_ data: Data) throws -> Reply {
        do {
            return try JSONDecoder().decode(Reply.self, from: data)
        } catch {
            throw BdSignInError.unavailable
        }
    }

    private func send<Body: Encodable>(_ path: String, body: Body?) async throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch let error as URLError where [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost, .cannotFindHost, .dataNotAllowed].contains(error.code) {
            throw BdSignInError.offline
        } catch {
            throw BdSignInError.unavailable
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let problem = try? JSONDecoder().decode(Problem.self, from: data)
            if let message = problem?.message, !message.isEmpty {
                throw BdSignInError(code: problem?.error ?? "failed", message: message)
            }
            throw status == 429
                ? BdSignInError(code: "too_many_tries", message: "That's a lot of tries. Wait a few minutes, then try again.")
                : BdSignInError.unavailable
        }
        return data
    }
}
