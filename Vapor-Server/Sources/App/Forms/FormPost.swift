import Foundation
import MultipartKit
import Vapor

/// A posted HTML form: every value under each name, in order, and any files.
/// A form and a quiz post `multipart/form-data` (a file field needs it) or,
/// from a plain page, `application/x-www-form-urlencoded`.
struct FormPost: Sendable {
    struct File: Sendable {
        let filename: String
        let mimeType: String
        let data: Data
    }

    private(set) var values: [String: [String]] = [:]
    private(set) var files: [String: [File]] = [:]

    /// The first value under `name`, or "".
    func text(_ name: String) -> String { values[name]?.first ?? "" }
    /// Every non-empty value under `name` (a checkbox group).
    func texts(_ name: String) -> [String] { (values[name] ?? []).filter { !$0.isEmpty } }
    /// Every value under `name`, empty ones too.
    func all(_ name: String) -> [String] { values[name] ?? [] }
    func has(_ name: String) -> Bool { values[name] != nil }

    static func read(_ req: Request) throws -> FormPost {
        guard let body = req.body.data, body.readableBytes > 0 else { return FormPost() }
        if let type = req.headers.contentType, type.type == "multipart", let boundary = type.parameters["boundary"] {
            return try multipart(body, boundary: boundary)
        }
        return urlEncoded(body.getString(at: body.readerIndex, length: body.readableBytes) ?? "")
    }

    static func urlEncoded(_ body: String) -> FormPost {
        var post = FormPost()
        for pair in body.split(separator: "&", omittingEmptySubsequences: true) {
            let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            let decode = { (s: Substring) in String(s).replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? String(s) }
            post.values[decode(parts[0]), default: []].append(parts.count > 1 ? decode(parts[1]) : "")
        }
        return post
    }

    static func multipart(_ body: ByteBuffer, boundary: String) throws -> FormPost {
        let parser = MultipartParser(boundary: boundary)
        var post = FormPost()
        var headers: [String: String] = [:]
        var bytes: [UInt8] = []
        parser.onHeader = { name, value in headers[name.lowercased()] = value }
        parser.onBody = { chunk in bytes += chunk.readableBytesView }
        parser.onPartComplete = {
            let disposition = headers["content-disposition"] ?? ""
            if let name = parameter("name", in: disposition) {
                if let filename = parameter("filename", in: disposition) {
                    // An empty picker still sends a part, with no name and no bytes.
                    if !filename.isEmpty, !bytes.isEmpty {
                        let type = headers["content-type"] ?? "application/octet-stream"
                        post.files[name, default: []].append(File(filename: filename, mimeType: type, data: Data(bytes)))
                    }
                } else {
                    post.values[name, default: []].append(String(decoding: bytes, as: UTF8.self))
                }
            }
            headers = [:]
            bytes = []
        }
        try parser.execute(body)
        return post
    }

    /// `name="…"` from a Content-Disposition header.
    private static func parameter(_ key: String, in header: String) -> String? {
        for piece in header.split(separator: ";") {
            let trimmed = piece.trimmingCharacters(in: .whitespaces)
            guard trimmed.lowercased().hasPrefix(key + "=") else { continue }
            var value = trimmed.dropFirst(key.count + 1)
            if value.hasPrefix("\""), value.hasSuffix("\""), value.count >= 2 { value = value.dropFirst().dropLast() }
            return value.replacingOccurrences(of: "\\\"", with: "\"")
        }
        return nil
    }
}

// MARK: - HTML

extension String {
    /// Escaped for HTML text and double-quoted attributes.
    var html: String {
        var out = ""
        out.reserveCapacity(count)
        for ch in self {
            switch ch {
            case "&": out += "&amp;"
            case "<": out += "&lt;"
            case ">": out += "&gt;"
            case "\"": out += "&quot;"
            case "'": out += "&#39;"
            default: out.append(ch)
            }
        }
        return out
    }
}

extension String {
    /// One URL component — a path segment or a query value — escaped like
    /// JavaScript's `encodeURIComponent`.
    var uriComponent: String {
        addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")) ?? self
    }
}

/// ` disabled`, ` checked`… when `on`.
func flag(_ on: Bool, _ word: String) -> String { on ? " \(word)" : "" }

/// Class names, skipping the empty ones.
func classes(_ parts: String?...) -> String { parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ") }

func htmlResponse(_ body: String, status: HTTPResponseStatus = .ok, headers extra: [(String, String)] = []) -> Response {
    let response = Response(status: status, body: .init(string: body))
    response.headers.replaceOrAdd(name: .contentType, value: "text/html; charset=utf-8")
    response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
    for (name, value) in extra { response.headers.replaceOrAdd(name: name, value: value) }
    return response
}
