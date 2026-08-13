import Foundation

/// Everything `BiabKit` can fail with.
public enum BiabError: Error, Sendable {
    /// A non-2xx response.
    case http(status: Int, path: String, message: String?)

    /// The org's billing / entitlement gate refused to serve.
    ///
    /// The platform signals this two ways and the client normalises both: a
    /// 402 on writes, and a **200** whose body carries
    /// `{ available: false, reason, upgradeUrl, message }` on reads. Reads use
    /// a body-only signal so a cached CDN response can't hard-fail a page —
    /// which also means a client that only inspects `statusCode` renders a
    /// silently empty screen and never notices.
    case accessRejected(reason: AccessRejectionReason, upgradeURL: URL?, message: String)

    /// The response body didn't match the expected shape.
    case decoding(underlying: any Error)

    /// The request never completed.
    case transport(underlying: any Error)

    /// `BiabClient` was handed something it can't use.
    case configuration(String)
}

public enum AccessRejectionReason: String, Sendable {
    case planRequired = "plan_required"
    case paymentRequired = "payment_required"
    case serviceSuspended = "service_suspended"
}

extension BiabError {
    /// True when the failure means the org's site is lapsed or suspended, as
    /// opposed to a transient blip. Screens that want to show a specific
    /// notice branch on this; everything else falls back to local content.
    public var isUnavailable: Bool {
        switch self {
        case .accessRejected(let reason, _, _):
            return reason == .paymentRequired || reason == .serviceSuspended
        default:
            return false
        }
    }
}

extension BiabError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .http(let status, let path, let message):
            return message ?? "BIAB request to \(path) failed with status \(status)."
        case .accessRejected(_, _, let message):
            return message
        case .decoding(let underlying):
            return "Could not decode the BIAB response: \(underlying.localizedDescription)"
        case .transport(let underlying):
            return underlying.localizedDescription
        case .configuration(let message):
            return message
        }
    }
}

/// The body shape the access gate returns. Internal — callers see `BiabError`.
struct AccessGateBody: Decodable, Sendable {
    let available: Bool
    let reason: String
    let message: String
    let upgradeUrl: String?
}
