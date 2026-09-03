import Foundation

/// One tag for a document `<head>`.
public struct HeadTag: Sendable, Hashable {
    public let tag: String
    public let attributes: [(String, String)]
    /// Text content — the title string, or a JSON-LD payload.
    public let children: String?

    public static func == (lhs: HeadTag, rhs: HeadTag) -> Bool {
        lhs.tag == rhs.tag && lhs.children == rhs.children
            && lhs.attributes.map(\.0) == rhs.attributes.map(\.0)
            && lhs.attributes.map(\.1) == rhs.attributes.map(\.1)
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(tag)
        hasher.combine(children)
    }
}

/// The org's per-page SEO, turned into head tags.
///
/// The marketing page bundle carries a `seo` object for the page you asked
/// for: title, description, canonical, `noIndex`, Open Graph, Twitter card,
/// keywords, JSON-LD and hreflang. Reading four of those and forgetting the
/// rest is the normal failure, and the two people forget are `noIndex` and
/// `canonicalUrl` — exactly the two where being wrong is expensive and silent.
///
/// A native app mostly does not have a `<head>`. This matters anyway for the
/// two cases where it does: a `WKWebView` rendering org content, and server-side
/// rendering from a Swift backend. It is also what `SEOMetadata` reads to
/// populate share sheets, where `ogTitle` and `ogImage` are the whole payload.
///
/// Rules, matching the TypeScript `seo-core`:
///
/// - Open Graph falls back to the page's own title/description. A missing
///   `og:title` renders a shared link as a bare URL.
/// - A RELATIVE canonical is dropped rather than emitted: crawlers resolve it
///   against whatever URL they fetched, so on a parameterised URL it points
///   somewhere nobody intended. A missing canonical is recoverable; a wrong one
///   consolidates ranking onto the wrong page.
/// - `robots` is always emitted, both ways. Absence means "index", so relying
///   on absence to express noindex is catastrophic.
public enum Seo {
    /// Read the SEO block off a decoded page bundle.
    public static func headTags(
        from seo: [String: JSONValue]?,
        baseURL: String? = nil
    ) -> [HeadTag] {
        guard let seo else { return [] }

        let title = text(seo["seoTitle"])
        let description = text(seo["seoDescription"])
        let canonical = absolute(text(seo["canonicalUrl"]), baseURL: baseURL)
        let noIndex = bool(seo["noIndex"]) ?? false

        let ogTitle = text(seo["ogTitle"]) ?? title
        let ogDescription = text(seo["ogDescription"]) ?? description
        let ogImage = absolute(text(seo["ogImageUrl"]), baseURL: baseURL)

        var tags: [HeadTag] = []
        if let title { tags.append(HeadTag(tag: "title", attributes: [], children: title)) }
        if let description { tags.append(meta("name", "description", description)) }
        if case let .array(words)? = seo["keywords"], !words.isEmpty {
            let joined = words.compactMap { value -> String? in
                if case let .string(s) = value { return s }
                return nil
            }.joined(separator: ", ")
            if !joined.isEmpty { tags.append(meta("name", "keywords", joined)) }
        }
        tags.append(meta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow"))

        if let ogTitle { tags.append(meta("property", "og:title", ogTitle)) }
        if let ogDescription { tags.append(meta("property", "og:description", ogDescription)) }
        if let ogImage { tags.append(meta("property", "og:image", ogImage)) }
        if let canonical { tags.append(meta("property", "og:url", canonical)) }
        tags.append(meta("property", "og:type", "website"))

        tags.append(meta("name", "twitter:card", text(seo["twitterCard"]) ?? "summary_large_image"))
        if let ogTitle { tags.append(meta("name", "twitter:title", ogTitle)) }
        if let ogDescription { tags.append(meta("name", "twitter:description", ogDescription)) }
        if let ogImage { tags.append(meta("name", "twitter:image", ogImage)) }

        if let canonical {
            tags.append(HeadTag(tag: "link", attributes: [("rel", "canonical"), ("href", canonical)], children: nil))
        }
        if case let .object(alternates)? = seo["hreflang"] {
            for (lang, value) in alternates.sorted(by: { $0.key < $1.key }) {
                guard let href = absolute(text(value), baseURL: baseURL) else { continue }
                tags.append(HeadTag(
                    tag: "link",
                    attributes: [("rel", "alternate"), ("hreflang", lang), ("href", href)],
                    children: nil
                ))
            }
        }
        if case let .array(nodes)? = seo["jsonldNodes"] {
            for node in nodes {
                guard let data = try? JSONEncoder().encode(node),
                      let payload = String(data: data, encoding: .utf8)
                else { continue }
                tags.append(HeadTag(
                    tag: "script",
                    attributes: [("type", "application/ld+json")],
                    children: payload
                ))
            }
        }
        return tags
    }

    /// Ready-to-inject HTML, for a WKWebView or a server-rendered template.
    public static func render(from seo: [String: JSONValue]?, baseURL: String? = nil) -> String {
        headTags(from: seo, baseURL: baseURL).map { tag in
            let attrs = tag.attributes
                .map { "\($0.0)=\"\(escape($0.1))\"" }
                .joined(separator: " ")
            switch tag.tag {
            case "title":
                return "<title>\(escape(tag.children ?? ""))</title>"
            case "script":
                // `<` is what closes the script early; escaping the whole
                // payload would corrupt the JSON instead.
                let payload = (tag.children ?? "").replacingOccurrences(of: "<", with: "\\u003c")
                return "<script \(attrs)>\(payload)</script>"
            default:
                return "<\(tag.tag) \(attrs)>"
            }
        }.joined(separator: "\n")
    }

    // MARK: - Internals

    private static func meta(_ key: String, _ name: String, _ content: String) -> HeadTag {
        HeadTag(tag: "meta", attributes: [(key, name), ("content", content)], children: nil)
    }

    private static func text(_ value: JSONValue?) -> String? {
        guard case let .string(raw) = value else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func bool(_ value: JSONValue?) -> Bool? {
        if case let .bool(flag) = value { return flag }
        return nil
    }

    private static func absolute(_ url: String?, baseURL: String?) -> String? {
        guard let url else { return nil }
        if url.range(of: "^([a-z][a-z0-9+.-]*:|//)", options: [.regularExpression, .caseInsensitive]) != nil {
            return url
        }
        guard let baseURL, !baseURL.trimmingCharacters(in: .whitespaces).isEmpty else {
            return nil // see the note about relative canonicals above
        }
        let base = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        return url.hasPrefix("/") ? base + url : "\(base)/\(url)"
    }

    private static func escape(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }
}
