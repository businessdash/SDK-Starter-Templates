import Foundation

/// Where sign-in goes. A business's customers have their own account at that
/// business: their own password, their own codes, nothing shared with another
/// business on BD. These calls are BD's `auth/customer/*` routes.
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
    func signIn(email: String, password: String) async throws -> Session
    /// Emails a code. A new account is made when the code comes back (``verify(pendingId:code:newPassword:)``).
    func startSignUp(email: String, password: String, firstName: String?, lastName: String?) async throws -> BdCodeSent
    /// Emails a code for a new password. Unknown emails get the same answer, so nobody can probe who has an account.
    func startReset(email: String) async throws -> BdCodeSent
    /// The emailed code: makes the account, or sets `newPassword`, and signs in.
    func verify(pendingId: String, code: String, newPassword: String?) async throws -> Session
    /// An ID token from Sign in with Apple or Google, checked by BD against the business's app.
    func signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?) async throws -> Session
}

public struct BdSignInOptions: Codable, Sendable, Equatable {
    /// The business's name, as BD knows it.
    public var name: String?
    public var password: Bool
    public var apple: Bool
    public var google: Bool

    public init(name: String? = nil, password: Bool = true, apple: Bool = false, google: Bool = false) {
        self.name = name
        self.password = password
        self.apple = apple
        self.google = google
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

public enum BdSignInProvider: String, Codable, Sendable {
    case apple, google
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
        host: URL = URL(string: "https://www.businessdash.us")!,
        urlSession: URLSession = .shared
    ) -> Self {
        precondition(!publishableKey.hasPrefix("sk_"), "Use the publishable pk_ key in an app, never a secret sk_ key.")
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
/// - `sign-in`, `verify`, `id-token`: its own session, decoded as `Session`
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

    public func signIn(email: String, password: String) async throws -> Session {
        try await call("sign-in", body: ["email": email, "password": password])
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

    private func call<Body: Encodable, Reply: Decodable>(_ path: String, body: Body?) async throws -> Reply {
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
        do {
            return try JSONDecoder().decode(Reply.self, from: data)
        } catch {
            throw BdSignInError.unavailable
        }
    }
}
