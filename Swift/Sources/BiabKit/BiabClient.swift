import Foundation

/// Transport for the BIAB Package API.
///
/// ## The token rule
///
/// A native app **holds its credential in the artifact**. `strings` on an
/// `.ipa` finds anything you ship, so `BiabClient` only accepts a
/// **publishable** `pk_…` token — origin-locked and rate-limited by the
/// platform. `init` traps on an `sk_…` key rather than letting a secret ride
/// to the App Store.
///
/// That is less limiting than it sounds. The publishable scope set covers the
/// entire customer-facing surface: storefront, cart, checkout, blog, marketing
/// content, chat, forms, **the whole customer portal**, sign-in, custom-object
/// reads, and careers. Only operator/admin writes need a secret key, and a
/// customer app never makes those. If you do need one, put it behind a server
/// you control and point the app at that.
///
/// ## Concurrency
///
/// `Sendable` value type. It holds no mutable state, so every screen can keep
/// its own copy or share one freely across actors.
public struct BiabClient: Sendable {
    let baseURL: URL
    let apiKey: String
    let siteID: String
    let transport: any BiabTransport

    /// - Parameters:
    ///   - host: BIAB app origin, e.g. `https://www.biab.app`. The client
    ///     appends `/api/package/v1` itself.
    ///   - publishableKey: a `pk_…` token. Passing `sk_…` is a programmer
    ///     error and traps.
    ///   - siteID: the site UUID this app renders.
    public init(
        host: URL,
        publishableKey: String,
        siteID: String,
        transport: (any BiabTransport)? = nil
    ) {
        precondition(
            !publishableKey.hasPrefix("sk_"),
            """
            BiabClient was given a SECRET key. A native app ships its \
            credential inside the binary, where `strings` finds it — use a \
            publishable pk_ token instead, and route anything that genuinely \
            needs a secret key through a server you control.
            """
        )

        self.baseURL = host.appendingPathComponent("api/package/v1")
        self.apiKey = publishableKey
        self.siteID = siteID
        self.transport = transport ?? URLSessionTransport()
    }

    // MARK: - Requests

    public func get<Response: Decodable & Sendable>(
        _ path: String,
        query: [String: String?] = [:],
        as type: Response.Type = Response.self,
        headers: [String: String] = [:]
    ) async throws -> Response {
        try await send(method: "GET", path: path, query: query, body: nil, headers: headers)
    }

    public func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: Response.Type = Response.self,
        headers: [String: String] = [:]
    ) async throws -> Response {
        let data = try JSONEncoder.biab.encode(body)
        return try await send(method: "POST", path: path, query: [:], body: data, headers: headers)
    }

    public func post<Response: Decodable & Sendable>(
        _ path: String,
        as type: Response.Type = Response.self,
        headers: [String: String] = [:]
    ) async throws -> Response {
        try await send(method: "POST", path: path, query: [:], body: Data("{}".utf8), headers: headers)
    }

    public func patch<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: Response.Type = Response.self,
        headers: [String: String] = [:]
    ) async throws -> Response {
        let data = try JSONEncoder.biab.encode(body)
        return try await send(method: "PATCH", path: path, query: [:], body: data, headers: headers)
    }

    public func delete<Response: Decodable & Sendable>(
        _ path: String,
        as type: Response.Type = Response.self,
        headers: [String: String] = [:]
    ) async throws -> Response {
        try await send(method: "DELETE", path: path, query: [:], body: nil, headers: headers)
    }

    /// Path prefix for every site-scoped route.
    func sitePath(_ suffix: String) -> String {
        "sites/\(Self.escape(siteID))/\(suffix)"
    }

    static func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    // MARK: - Internals

    private func send<Response: Decodable & Sendable>(
        method: String,
        path: String,
        query: [String: String?],
        body: Data?,
        headers: [String: String]
    ) async throws -> Response {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )

        let items = query.compactMap { key, value in
            value.map { URLQueryItem(name: key, value: $0) }
        }
        if !items.isEmpty {
            components?.queryItems = items.sorted { $0.name < $1.name }
        }

        guard let url = components?.url else {
            throw BiabError.configuration("Could not build a URL for \(path).")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }

        let data: Data
        let status: Int
        do {
            (data, status) = try await transport.send(request)
        } catch {
            throw BiabError.transport(underlying: error)
        }

        // The gate is checked BEFORE the status code, on purpose: reads signal
        // it with a 200 and a body flag, so a status-first check would let an
        // empty screen through as success.
        if let gate = try? JSONDecoder.biab.decode(AccessGateBody.self, from: data), !gate.available {
            throw BiabError.accessRejected(
                reason: AccessRejectionReason(rawValue: gate.reason) ?? .planRequired,
                upgradeURL: gate.upgradeUrl.flatMap(URL.init(string:)),
                message: gate.message
            )
        }

        guard (200..<300).contains(status) else {
            let message = try? JSONDecoder.biab.decode(ErrorBody.self, from: data).message
            throw BiabError.http(status: status, path: path, message: message)
        }

        do {
            return try JSONDecoder.biab.decode(Response.self, from: data)
        } catch {
            throw BiabError.decoding(underlying: error)
        }
    }
}

private struct ErrorBody: Decodable {
    let message: String?
}

// MARK: - Transport seam

/// The one seam the kit exposes for tests: swap the network for a stub without
/// spinning up a server or reaching for URLProtocol.
public protocol BiabTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, Int)
}

struct URLSessionTransport: BiabTransport {
    func send(_ request: URLRequest) async throws -> (Data, Int) {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        return (data, status)
    }
}

// MARK: - Coding

extension JSONDecoder {
    /// Shared decoder. Keys arrive camelCase already, so no conversion — and
    /// dates arrive as ISO-8601 strings.
    static let biab: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

extension JSONEncoder {
    static let biab: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}
