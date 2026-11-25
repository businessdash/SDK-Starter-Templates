import Foundation
import Vapor

/// `/my-account` and the routes behind its sign-in screen.
///
/// Signed out, the page shows the business's own sign-in screen (its name,
/// logo and brand colours from BD), rendered on this server by
/// `SignInController`: password sign-in, emailed codes, and "Continue with
/// Google / Apple / GitHub / Discord". Its steps go through `forward` below,
/// and these JSON routes — the Swift twin of the JS SDK's `createAuthHandler`
/// customer routes — stay for apps and pages that bring their own screen:
///
///     GET  options                      the business's name, colours, providers
///     POST sign-in | verify | id-token  → sets the httpOnly `bd_session` cookie
///     POST sign-up | forgot-password    → { pendingId, expiresAt } (a code is sent)
///     GET  oauth/google|apple|github|discord?returnTo=/path
///          → PKCE verifier in a short httpOnly cookie, then to WorkOS's link
///     GET  oauth/callback?bd_oauth_code=…
///          → redeemed with that verifier, `bd_session` set, back to returnTo
///
/// Every step is BD's `auth/customer/*`, which runs it through WorkOS — the
/// same accounts as BD's hosted sign-in. The key stays on this server and the
/// session token never reaches page scripts. POSTs must be JSON, which a
/// cross-site form can't send without a CORS preflight.
enum AccountController {
    static let sessionCookie = "bd_session"
    private static let pkceCookie = "bd_oauth_pkce"
    private static let oauthPath = "/api/bd-auth/customer/oauth"
    static let unavailable = "Sign-in isn't available just now. Try again in a minute."
    private static let providers: Set<String> = ["apple", "google", "github", "discord"]

    /// path → the method it takes, and whether it signs someone in.
    private static let routes: [String: (method: HTTPMethod, signsIn: Bool)] = [
        "options": (.GET, false),
        "sign-in": (.POST, true),
        "sign-up": (.POST, false),
        "forgot-password": (.POST, false),
        "verify": (.POST, true),
        "id-token": (.POST, true),
    ]

    // MARK: - The page

    static func page(req: Request) async throws -> Response {
        let configured = req.application.bdConfigured

        guard
            let bd = req.bd,
            let token = req.cookies[sessionCookie]?.string.nilIfEmpty,
            let me = try? await bd.get("auth/me", as: JSONValue.self, headers: [("x-bd-session", token)]),
            me["user"] != nil
        else {
            return try await req.view.render("account", AccountContext(
                configured: configured, signedIn: false, signIn: await SignInController.section(req: req), email: "", jobs: []
            )).encodeResponse(for: req)
        }

        // Signed in already, with somewhere to go back to (a quiz invitation's sign-in link).
        if let next = SignInController.safeNext(req.query[String.self, at: "next"]) { return land(next, [:]) }

        let portal = PortalResource(client: bd, sessionToken: token, organizationId: me.string("organizationId"))
        var jobs: [AccountJob] = []
        if let work = try? await portal.work(), case .array(let items)? = work["jobs"] {
            jobs = items.map { AccountJob(name: $0.string("name") ?? "Job", status: $0.string("status") ?? "") }
        }

        return try await req.view.render("account", AccountContext(
            configured: configured,
            signedIn: true,
            signIn: "",
            email: me.string("user", "email") ?? "a customer",
            jobs: jobs
        )).encodeResponse(for: req)
    }

    static func signOut(req: Request) async throws -> Response {
        if let bd = req.bd {
            // Best effort — the cookie is cleared either way.
            _ = try? await bd.once(.POST, "auth/sign-out", body: .object([:]))
        }
        let response = req.method == .POST ? json(.ok, .object(["ok": .bool(true)])) : land("/", [:])
        response.cookies[sessionCookie] = expired(req, path: "/")
        return response
    }

    // MARK: - Delete account

    /// `/api/bd-auth/delete-account`. GET asks the customer to confirm; POST
    /// deletes their account with this business (customer record, settings,
    /// cart, and their sign-in unless another business still uses it; orders
    /// and invoices stay with the business) and clears the cookie. App stores
    /// require every app that makes accounts to offer this.
    static func deleteAccount(req: Request) async throws -> Response {
        guard
            let bd = req.bd,
            let token = req.cookies[sessionCookie]?.string.nilIfEmpty,
            let me = try? await bd.get("auth/me", as: JSONValue.self, headers: [("x-bd-session", token)]),
            me["user"] != nil
        else {
            return try await deletePage(req, .signedOut)
        }
        if req.method == .GET {
            return try await deletePage(req, .confirm)
        }
        // The cookie is SameSite=Lax, so another site's form can't carry it;
        // the Origin check makes that plain.
        guard fromThisSite(req) else {
            return problem(.forbidden, "forbidden", "Forbidden.")
        }

        let result: (status: Int, body: JSONValue)
        do {
            result = try await bd.once(.POST, "auth/customer/delete-account", body: .object([:]), headers: [("x-bd-session", token)])
        } catch {
            return try await deletePage(req, .failed, status: .serviceUnavailable)
        }
        switch result.status {
        case 200..<300: return try await deletePage(req, .deleted, clearCookie: true)
        case 401: return try await deletePage(req, .signedOut, status: .unauthorized, clearCookie: true)
        default: return try await deletePage(req, .failed, status: .serviceUnavailable)
        }
    }

    private enum DeleteState { case confirm, deleted, failed, signedOut }

    private static func deletePage(
        _ req: Request,
        _ state: DeleteState,
        status: HTTPResponseStatus = .ok,
        clearCookie: Bool = false
    ) async throws -> Response {
        let response = try await req.view.render("delete-account", DeleteAccountContext(
            confirm: state == .confirm, deleted: state == .deleted, failed: state == .failed
        )).encodeResponse(for: req)
        response.status = status
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        if clearCookie { response.cookies[sessionCookie] = expired(req, path: "/") }
        return response
    }

    /// No Origin (an older browser), or one naming this host.
    private static func fromThisSite(_ req: Request) -> Bool {
        guard let origin = req.headers.first(name: .origin) else { return true }
        guard let host = req.headers.first(name: .host), let url = URL(string: origin), let name = url.host else {
            return false
        }
        let authority = url.port.map { "\(name):\($0)" } ?? name
        return authority.lowercased() == host.lowercased()
    }

    // MARK: - The sign-in screen's routes

    static func customer(req: Request) async throws -> Response {
        guard let bd = req.bd else {
            return problem(.serviceUnavailable, "unavailable", "Sign-in isn't set up yet.")
        }
        let path = req.parameters.getCatchall()

        if path.count == 2, path[0] == "oauth" {
            return path[1] == "callback"
                ? await oauthCallback(req, bd)
                : await oauthStart(req, bd, provider: path[1])
        }
        guard path.count == 1, let route = routes[path[0]] else {
            return problem(.notFound, "not_found", "Not found.")
        }
        guard req.method == route.method else {
            return problem(.methodNotAllowed, "method_not_allowed", "Use \(route.method.rawValue) for customer/\(path[0]).")
        }

        var body: JSONValue?
        if route.method == .POST {
            guard let type = req.headers.contentType, type.type == "application", type.subType == "json" else {
                return problem(.unsupportedMediaType, "unsupported_media_type", "Send JSON (Content-Type: application/json).")
            }
            guard let parsed = try? req.content.decode(JSONValue.self), case .object = parsed else {
                return problem(.badRequest, "invalid_json", "Check the form and try again.")
            }
            body = parsed
        }

        switch await forward(bd, path[0], body: body) {
        case .answered(let body):
            return json(.ok, body)
        case .refused(let status, let code, let message):
            return problem(HTTPResponseStatus(statusCode: status), code, message)
        case .signedIn(let token, let expires, let body):
            // The token goes in the httpOnly cookie, never to the page.
            let response = json(.ok, .object([
                "user": body["user"] ?? .null,
                "organizationId": body["organizationId"] ?? .null,
                "role": body["role"] ?? .null,
                "expiresAt": body["expiresAt"] ?? .null,
            ]))
            response.cookies[sessionCookie] = session(req, token, expires)
            return response
        }
    }

    /// BD's answer to one customer step.
    enum CustomerAnswer: Sendable {
        /// The business's options, a code on its way (`pendingId`), or —
        /// from sign-in — "confirm your email first" (a code was sent).
        case answered(JSONValue)
        /// Someone is signed in: the token for the httpOnly cookie.
        case signedIn(token: String, expires: Date, body: JSONValue)
        /// BD's own refusal (wrong password, expired code…), or unreachable.
        case refused(status: Int, code: String, message: String)
    }

    /// One `auth/customer/*` step at BD (which runs it through WorkOS). The
    /// JSON route above and the server-rendered screen (`SignInController`)
    /// both go through here.
    static func forward(_ bd: BdClient, _ path: String, body: JSONValue? = nil) async -> CustomerAnswer {
        guard let route = routes[path] else { return .refused(status: 404, code: "not_found", message: "Not found.") }
        let result: (status: Int, body: JSONValue)
        do {
            result = try await bd.once(route.method, "auth/customer/\(path)", body: body)
        } catch {
            return .refused(status: 502, code: "unavailable", message: unavailable)
        }
        guard (200..<300).contains(result.status) else { return refusal(result) }
        guard route.signsIn else { return .answered(result.body) }

        // Sign-in can answer "confirm your email first" (a code was sent).
        if result.body.string("pendingId") != nil, result.body["sessionToken"] == nil {
            return .answered(result.body)
        }
        guard
            let token = result.body.string("sessionToken"),
            let expiresAt = result.body.string("expiresAt"),
            let expires = instant(expiresAt)
        else {
            return .refused(status: 502, code: "unavailable", message: unavailable)
        }
        return .signedIn(token: token, expires: expires, body: result.body)
    }

    // MARK: - "Continue with Google / Apple / GitHub / Discord"

    private static func oauthStart(_ req: Request, _ bd: BdClient, provider: String) async -> Response {
        guard req.method == .GET else {
            return problem(.methodNotAllowed, "method_not_allowed", "Use GET for customer/oauth/\(provider).")
        }
        guard providers.contains(provider) else { return problem(.notFound, "not_found", "Not found.") }

        let returnTo = samePath(try? req.query.get(String.self, at: "returnTo")) ?? "/my-account"
        // PKCE (RFC 7636, S256): the verifier stays in a cookie here, the
        // challenge goes to BD, and only the pair redeems the code.
        let verifier = base64URL(Data([UInt8].random(count: 32)))
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))

        let result = try? await bd.once(.POST, "auth/customer/oauth/start", body: .object([
            "provider": .string(provider),
            "redirectUri": .string(bd.origin + oauthPath + "/callback"),
            "returnTo": .string(returnTo),
            "codeChallenge": .string(challenge),
        ]))
        guard let result, (200..<300).contains(result.status), let url = result.body.string("url") else {
            return land(returnTo, [
                "bd_oauth_error": "failed",
                "bd_oauth_message": result?.body.string("message")
                    ?? "That sign-in isn't available just now. Try again, or use your email.",
            ])
        }

        let response = Response(status: .found)
        response.headers.replaceOrAdd(name: .location, value: url)
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        response.cookies[pkceCookie] = HTTPCookies.Value(
            string: verifier,
            maxAge: 600,
            path: oauthPath,
            isSecure: isHTTPS(req),
            isHTTPOnly: true,
            sameSite: .lax
        )
        return response
    }

    private static func oauthCallback(_ req: Request, _ bd: BdClient) async -> Response {
        guard req.method == .GET else {
            return problem(.methodNotAllowed, "method_not_allowed", "Use GET for customer/oauth/callback.")
        }
        func query(_ name: String) -> String? { (try? req.query.get(String.self, at: name))?.nilIfEmpty }

        let returnTo = samePath(query("bd_return_to")) ?? "/my-account"
        let verifier = req.cookies[pkceCookie]?.string.nilIfEmpty
        let response: Response

        if let failed = query("bd_oauth_error") {
            response = land(returnTo, [
                "bd_oauth_error": failed == "cancelled" ? "cancelled" : "failed",
                "bd_oauth_message": query("bd_oauth_message") ?? "Sign-in didn't finish. Try again.",
            ])
        } else if let code = query("bd_oauth_code"), let verifier {
            let result = try? await bd.once(.POST, "auth/customer/oauth/exchange", body: .object([
                "code": .string(code),
                "codeVerifier": .string(verifier),
            ]))
            if let result, (200..<300).contains(result.status),
               let token = result.body.string("sessionToken"),
               let expiresAt = result.body.string("expiresAt"),
               let expires = instant(expiresAt) {
                response = land(returnTo, [:])
                response.cookies[sessionCookie] = session(req, token, expires)
            } else {
                response = land(returnTo, [
                    "bd_oauth_error": "failed",
                    "bd_oauth_message": result?.body.string("message") ?? "Sign-in didn't finish. Try again.",
                ])
            }
        } else {
            response = land(returnTo, [
                "bd_oauth_error": "failed",
                "bd_oauth_message": "That sign-in took too long, or started in another browser. Try again.",
            ])
        }

        response.cookies[pkceCookie] = expired(req, path: oauthPath)
        return response
    }

    // MARK: - Helpers

    /// BD's own refusal (wrong password, expired code…), passed on.
    private static func refusal(_ result: (status: Int, body: JSONValue)) -> CustomerAnswer {
        let fallback = result.status == 429 ? "That's a lot of tries. Wait a few minutes, then try again." : unavailable
        let message = result.body.string("message").flatMap {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0
        } ?? fallback
        let code = result.body.string("error") ?? (result.status == 429 ? "too_many_tries" : "unavailable")
        let status = (400...599).contains(result.status) ? result.status : 502
        return .refused(status: status, code: code, message: message)
    }

    /// The httpOnly `bd_session` cookie for a signed-in token.
    static func session(_ req: Request, _ token: String, _ expires: Date) -> HTTPCookies.Value {
        HTTPCookies.Value(
            string: token,
            expires: expires,
            maxAge: max(60, Int(expires.timeIntervalSinceNow)),
            path: "/",
            isSecure: isHTTPS(req),
            isHTTPOnly: true,
            sameSite: .lax
        )
    }

    private static func expired(_ req: Request, path: String) -> HTTPCookies.Value {
        HTTPCookies.Value(
            string: "",
            expires: Date(timeIntervalSince1970: 0),
            maxAge: 0,
            path: path,
            isSecure: isHTTPS(req),
            isHTTPOnly: true,
            sameSite: .lax
        )
    }

    /// Behind a proxy the request itself is plain http; the proxy says so.
    static func isHTTPS(_ req: Request) -> Bool {
        req.url.scheme == "https" || req.headers.first(name: "X-Forwarded-Proto") == "https"
    }

    /// An ISO 8601 instant, with or without fractional seconds.
    private static func instant(_ text: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: text) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: text)
    }

    /// A path on this site, or nil: one leading `/`, no `//`, `\` or control characters.
    private static func samePath(_ raw: String?) -> String? {
        guard let raw, raw.hasPrefix("/"), !raw.hasPrefix("//") else { return nil }
        let unsafe = raw.unicodeScalars.contains { $0 == "\\" || $0.value < 0x20 || $0.value == 0x7f }
        return unsafe ? nil : raw
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func land(_ path: String, _ params: [String: String]) -> Response {
        var target = path
        if !params.isEmpty {
            var components = URLComponents()
            components.queryItems = params.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
            // `+` reads as a space in a query string, so spell it out.
            let query = (components.percentEncodedQuery ?? "").replacingOccurrences(of: "+", with: "%2B")
            target += (path.contains("?") ? "&" : "?") + query
        }
        let response = Response(status: .seeOther)
        response.headers.replaceOrAdd(name: .location, value: target)
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        return response
    }

    private static func json(_ status: HTTPResponseStatus, _ body: JSONValue) -> Response {
        let response = Response(status: status)
        try? response.content.encode(body, as: .json)
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        return response
    }

    private static func problem(_ status: HTTPResponseStatus, _ code: String, _ message: String) -> Response {
        json(status, .object(["error": .string(code), "message": .string(message)]))
    }
}

struct AccountContext: Content {
    let configured: Bool
    let signedIn: Bool
    /// The sign-in screen's HTML (`SignInController`), when signed out.
    let signIn: String
    let email: String
    let jobs: [AccountJob]
}

struct DeleteAccountContext: Content {
    let confirm: Bool
    let deleted: Bool
    let failed: Bool
}

struct AccountJob: Content {
    let name: String
    let status: String
}
