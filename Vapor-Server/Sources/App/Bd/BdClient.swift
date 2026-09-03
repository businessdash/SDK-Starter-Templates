import Foundation
import Vapor

/// Transport for the BD Package API — the **server** flavour.
///
/// Deliberately NOT the same client as the native Swift starter's `BdKit`.
/// That one traps on an `sk_…` key, because an app ships its credential inside
/// the binary. A server is the opposite case: the key never leaves the
/// process, so this client takes a **secret key** and gets the full API rather
/// than the publishable subset.
///
/// Keeping them separate also keeps each starter clonable on its own, which is
/// how every other template in this repo works.
///
/// Two things it does not leave to callers, because getting them wrong fails
/// quietly:
///
/// 1. **The access gate.** A read against a lapsed plan answers HTTP **200**
///    with `available: false` in the BODY — a status-only check renders an
///    empty page and never notices.
/// 2. **The `Origin` header.** A server has no browser origin, but the
///    platform gates on it.
struct BdClient: Sendable {
    let baseURL: String
    let apiKey: String
    let siteID: String
    let origin: String
    let http: any Client

    /// Nil when the app isn't wired to BD yet, so every page falls back to
    /// local content instead of 500ing. `swift run` on a fresh clone should
    /// still serve a complete site.
    static func make(app: Application) -> BdClient? {
        guard
            let key = Environment.get("BD_API_KEY"),
            let siteID = Environment.get("BD_SITE_ID")
        else { return nil }

        let host = Environment.get("BD_HOST") ?? "https://www.biab.app"

        return BdClient(
            baseURL: host.trimmingSuffix("/") + "/api/package/v1",
            apiKey: key,
            siteID: siteID,
            origin: (Environment.get("BD_SITE_ORIGIN") ?? "http://localhost:8080").trimmingSuffix("/"),
            http: app.client
        )
    }

    func sitePath(_ suffix: String) -> String {
        "sites/\(siteID.pathEscaped)/\(suffix)"
    }

    // MARK: - Requests

    func get<T: Decodable & Sendable>(
        _ path: String,
        query: [String: String?] = [:],
        as type: T.Type = T.self,
        headers extra: [(String, String)] = []
    ) async throws -> T {
        var uri = URI(string: baseURL + "/" + path)
        let items = query.compactMap { key, value in value.map { "\(key)=\($0.queryEscaped)" } }
        if !items.isEmpty {
            uri = URI(string: baseURL + "/" + path + "?" + items.sorted().joined(separator: "&"))
        }

        let response = try await http.get(uri, headers: headers(extra))
        return try decode(response, path: path)
    }

    func post<Body: Content, T: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: T.Type = T.self,
        headers extra: [(String, String)] = []
    ) async throws -> T {
        let response = try await http.post(URI(string: baseURL + "/" + path), headers: headers(extra)) {
            try $0.content.encode(body, as: .json)
        }
        return try decode(response, path: path)
    }

    // MARK: - Internals

    private func headers(_ extra: [(String, String)]) -> HTTPHeaders {
        var headers = HTTPHeaders()
        headers.bearerAuthorization = BearerAuthorization(token: apiKey)
        headers.add(name: .accept, value: "application/json")
        headers.add(name: .origin, value: origin)
        for (name, value) in extra { headers.add(name: name, value: value) }
        return headers
    }

    private func decode<T: Decodable & Sendable>(_ response: ClientResponse, path: String) throws -> T {
        // The gate is checked BEFORE the status code, on purpose.
        if let gate = try? response.content.decode(AccessGateBody.self), !gate.available {
            throw BdError.accessRejected(reason: gate.reason, message: gate.message)
        }

        guard response.status.code < 300 else {
            let message = try? response.content.decode(ErrorBody.self).message
            throw BdError.http(status: Int(response.status.code), path: path, message: message)
        }

        do {
            return try response.content.decode(T.self, using: JSONDecoder.bd)
        } catch {
            throw BdError.decoding(path: path, underlying: "\(error)")
        }
    }
}

struct AccessGateBody: Content {
    let available: Bool
    let reason: String
    let message: String
    let upgradeUrl: String?
}

private struct ErrorBody: Content {
    let message: String?
}

enum BdError: Error {
    case http(status: Int, path: String, message: String?)
    case accessRejected(reason: String, message: String)
    case decoding(path: String, underlying: String)
    case notConfigured

    /// True when the org's site is lapsed or suspended, as opposed to a blip.
    var isUnavailable: Bool {
        if case .accessRejected(let reason, _) = self {
            return reason == "payment_required" || reason == "service_suspended"
        }
        return false
    }
}

extension JSONDecoder {
    static let bd: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

extension String {
    func trimmingSuffix(_ suffix: String) -> String {
        hasSuffix(suffix) ? String(dropLast(suffix.count)) : self
    }

    var pathEscaped: String {
        addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? self
    }

    var queryEscaped: String {
        addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? self
    }

    var nilIfEmpty: String? { isEmpty ? nil : self }
}
