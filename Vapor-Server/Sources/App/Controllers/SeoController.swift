import Vapor

/// SEO / AEO files, proxied from BIAB.
///
/// Two different upstreams, easy to get wrong:
///
/// * `sitemap.xml` / `robots.txt` are SITE-SCOPED PACKAGE routes needing the
///   bearer key — `/api/package/v1/sites/{siteId}/…`
/// * `llms.txt` is a PUBLIC feed route with no auth —
///   `/api/public/ai-feed/{siteId}/llms.txt`
///
/// Everything degrades to a valid empty document rather than a 500: a crawler
/// may read a 5xx robots.txt as "disallow everything", which is worse than
/// serving a permissive one.
enum SeoController {
    static func sitemap(req: Request) async throws -> Response {
        let empty = #"<?xml version="1.0" encoding="UTF-8"?>"# + "\n"
            + #"<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>"#
        let body = await relayPackage(req, suffix: "sitemap.xml", fallback: empty)
        return response(body, contentType: "application/xml; charset=utf-8")
    }

    static func robots(req: Request) async throws -> Response {
        let origin = Environment.get("BIAB_SITE_ORIGIN") ?? "http://localhost:8080"
        let fallback = "User-agent: *\nAllow: /\nSitemap: \(origin)/sitemap.xml\n"
        let body = await relayPackage(req, suffix: "robots.txt", fallback: fallback)
        return response(body, contentType: "text/plain; charset=utf-8")
    }

    /// The companion PRODUCT FEED needs no route here — it is already public
    /// at `{host}/api/public/ai-feed/{siteId}/products`, in an OpenAI
    /// merchant-feed shape you submit to feed programs as-is.
    static func llmsTxt(req: Request) async throws -> Response {
        let fallback = "# llms.txt is not configured for this site.\n"

        guard let siteID = Environment.get("BIAB_SITE_ID") else {
            return response(fallback, contentType: "text/plain; charset=utf-8")
        }

        let host = (Environment.get("BIAB_HOST") ?? "https://www.biab.app").trimmingSuffix("/")
        let uri = URI(string: "\(host)/api/public/ai-feed/\(siteID.pathEscaped)/llms.txt")

        let body: String
        if let upstream = try? await req.client.get(uri),
           upstream.status.code < 300,
           let text = upstream.body.map({ String(buffer: $0) }) {
            body = text
        } else {
            body = fallback
        }

        return response(body, contentType: "text/plain; charset=utf-8")
    }

    private static func relayPackage(_ req: Request, suffix: String, fallback: String) async -> String {
        guard
            let siteID = Environment.get("BIAB_SITE_ID"),
            let key = Environment.get("BIAB_API_KEY")
        else { return fallback }

        let host = (Environment.get("BIAB_HOST") ?? "https://www.biab.app").trimmingSuffix("/")
        let origin = (Environment.get("BIAB_SITE_ORIGIN") ?? "").trimmingSuffix("/")
        let uri = URI(string: "\(host)/api/package/v1/sites/\(siteID.pathEscaped)/\(suffix)")

        var headers = HTTPHeaders()
        headers.bearerAuthorization = BearerAuthorization(token: key)
        headers.add(name: .origin, value: origin)

        guard
            let upstream = try? await req.client.get(uri, headers: headers),
            upstream.status.code < 300,
            let buffer = upstream.body
        else { return fallback }

        return String(buffer: buffer)
    }

    private static func response(_ body: String, contentType: String) -> Response {
        let response = Response(status: .ok, body: .init(string: body))
        response.headers.replaceOrAdd(name: .contentType, value: contentType)
        return response
    }
}
