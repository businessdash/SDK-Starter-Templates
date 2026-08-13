import Foundation
import Crypto
import Vapor

/// Verifies the BIAB → this-app revalidation webhook.
///
/// BIAB fires `content.published` with a Stripe-shaped header:
///
///     X-BIAB-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
///
/// signed over `"{t}.{rawBody}"`.
///
/// Three rules, each silent when broken:
///
/// 1. Verify against the **raw** body. Decoding and re-encoding changes key
///    order and whitespace, and the HMAC stops matching — it fails looking
///    exactly like a wrong secret. In Vapor that means reading
///    `request.body.string`, never `request.content.decode`.
/// 2. Compare in constant time, never `==`.
/// 3. Enforce the replay window — 5 minutes, matching the platform.
enum BiabWebhook {
    private static let replayWindowSeconds = 300.0

    struct Payload: Content {
        let event: String
        let orgId: String
        let tags: [String]
    }

    enum Failure: String, Error {
        case noSecretConfigured = "no_secret_configured"
        case missingOrMalformedSignature = "missing_or_malformed_signature"
        case replayWindowExpired = "replay_window_expired"
        case signatureMismatch = "signature_mismatch"
        case bodyNotJSON = "body_not_json"
        case bodyShapeInvalid = "body_shape_invalid"
    }

    static func verify(rawBody: String, signatureHeader: String?, secret: String?) throws -> Payload {
        guard let secret, !secret.isEmpty else { throw Failure.noSecretConfigured }
        guard let (timestamp, v1) = parse(signatureHeader) else {
            throw Failure.missingOrMalformedSignature
        }

        let now = Date().timeIntervalSince1970
        guard abs(now - timestamp) <= replayWindowSeconds else { throw Failure.replayWindowExpired }

        let expected = HMAC<SHA256>.authenticationCode(
            for: Data("\(Int(timestamp)).\(rawBody)".utf8),
            using: SymmetricKey(data: Data(secret.utf8))
        )
        let expectedHex = expected.map { String(format: "%02x", $0) }.joined()

        guard constantTimeEquals(expectedHex, v1.lowercased()) else { throw Failure.signatureMismatch }

        guard let data = rawBody.data(using: .utf8),
              let payload = try? JSONDecoder.biab.decode(Payload.self, from: data)
        else { throw Failure.bodyNotJSON }

        guard payload.event == "content.published" else { throw Failure.bodyShapeInvalid }

        return payload
    }

    private static func parse(_ header: String?) -> (Double, String)? {
        guard let header else { return nil }

        var timestamp: Double?
        var v1: String?

        for part in header.split(separator: ",") {
            let pair = part.trimmingCharacters(in: .whitespaces).split(separator: "=", maxSplits: 1)
            guard pair.count == 2 else { continue }
            if pair[0] == "t" { timestamp = Double(pair[1]) }
            if pair[0] == "v1" { v1 = String(pair[1]) }
        }

        guard let timestamp, let v1, !v1.isEmpty else { return nil }
        return (timestamp, v1)
    }

    /// Length-independent compare. `==` on Strings short-circuits on the first
    /// differing byte, which leaks how much of a forged signature was right.
    private static func constantTimeEquals(_ lhs: String, _ rhs: String) -> Bool {
        let a = Array(lhs.utf8)
        let b = Array(rhs.utf8)
        guard a.count == b.count else { return false }
        var difference: UInt8 = 0
        for index in a.indices { difference |= a[index] ^ b[index] }
        return difference == 0
    }
}
