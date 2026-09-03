import Vapor

struct PurgeResult: Content {
    let ok: Bool
    let purged: Int
}

/// `POST /api/bd/revalidate` — BD says content changed, the site drops
/// exactly the named cache tags. No polling, and edits go live immediately.
enum WebhookController {
    static func handle(req: Request) async throws -> Response {
        // The RAW body, byte for byte. Decoding and re-encoding changes key
        // order and whitespace, and the HMAC stops matching — a failure that
        // looks exactly like a wrong secret.
        guard let raw = req.body.string else {
            throw Abort(.badRequest, reason: "missing_body")
        }

        do {
            let payload = try BdWebhook.verify(
                rawBody: raw,
                signatureHeader: req.headers.first(name: "X-BD-Signature"),
                secret: Environment.get("BD_REVALIDATION_SECRET")
            )

            let purged = await req.bdCache.purge(tags: payload.tags)
            return try await PurgeResult(ok: true, purged: purged).encodeResponse(for: req)
        } catch let failure as BdWebhook.Failure {
            // 400, not 500 — a bad signature is the caller's problem, and a
            // 5xx would make BD retry a request that can never succeed.
            throw Abort(.badRequest, reason: failure.rawValue)
        }
    }
}
