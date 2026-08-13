import Vapor

struct PurgeResult: Content {
    let ok: Bool
    let purged: Int
}

/// `POST /api/biab/revalidate` — BIAB says content changed, the site drops
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
            let payload = try BiabWebhook.verify(
                rawBody: raw,
                signatureHeader: req.headers.first(name: "X-BIAB-Signature"),
                secret: Environment.get("BIAB_REVALIDATION_SECRET")
            )

            let purged = await req.biabCache.purge(tags: payload.tags)
            return try await PurgeResult(ok: true, purged: purged).encodeResponse(for: req)
        } catch let failure as BiabWebhook.Failure {
            // 400, not 500 — a bad signature is the caller's problem, and a
            // 5xx would make BIAB retry a request that can never succeed.
            throw Abort(.badRequest, reason: failure.rawValue)
        }
    }
}
