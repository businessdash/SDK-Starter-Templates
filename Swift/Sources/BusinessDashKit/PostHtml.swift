import Foundation

/// A blog post's HTML, made safe, and the small things every post shows
/// (reading time, date).
///
/// A post's `content` is HTML written in the BusinessDash editor, and the API
/// returns it as it was saved. `safe(_:)` reads it and writes out only the
/// tags and attributes on the lists below, with every value escaped again;
/// everything else becomes text. An app shows the result as native views
/// (``PostBlocks``); a web view or a server page can show it as is.
///
/// The same rules as `safePostHtml` in the web starters, line for line.
/// `Tests/BusinessDashKitTests/PostHtmlTests.swift` replays the TypeScript's
/// answers.
public enum PostHtml {
    private static let allowedTags: Set<String> = [
        "a", "abbr", "b", "blockquote", "br", "caption", "code", "del", "div", "em",
        "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
        "ins", "kbd", "li", "mark", "ol", "p", "pre", "s", "small", "span", "strong",
        "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ]

    private static let voidTags: Set<String> = ["br", "hr", "img"]

    /// Tags whose whole content goes, not only the tag.
    private static let droppedWithContent: Set<String> = [
        "script", "style", "iframe", "object", "embed", "template", "noscript", "textarea", "select",
    ]

    private static let anyTagAttributes = ["title", "id", "class"]
    private static let tagAttributes: [String: [String]] = [
        "a": ["href"],
        "img": ["src", "alt", "width", "height", "loading"],
        "td": ["colspan", "rowspan"],
        "th": ["colspan", "rowspan", "scope"],
        "ol": ["start"],
    ]

    private static let urlAttributes: Set<String> = ["href", "src"]

    private static let months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    // `.anchored` matches at the start of the searched range, as `\G` does in
    // the PCRE versions. Whitespace is ASCII, as there.
    private static let tag = regex(#"<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*+)>"#)
    private static let attribute = regex(
        #"([^\t\n\x0B\f\r "'>\/=]+)(?:[\t\n\x0B\f\r ]*=[\t\n\x0B\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\x0B\f\r "'>]+)))?"#
    )
    private static let entityInText = regex(#"&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)"#)
    private static let hexEntity = regex(#"&#x([0-9a-f]+);?"#, caseInsensitive: true)
    private static let decimalEntity = regex(#"&#([0-9]+);?"#)
    private static let anyTagInText = regex(#"<[^>]*>"#)
    private static let whitespace = regex(#"[\t\n\x0B\f\r ]+"#)
    private static let lazyLoading = regex(#"[\t\n\x0B\f\r ]loading="#)
    private static let webScheme = regex(#"^(https?:|mailto:|tel:)"#, caseInsensitive: true)
    private static let anyScheme = regex(#"^[a-z][a-z0-9+.-]*:"#, caseInsensitive: true)
    private static let httpScheme = regex(#"^https?:"#, caseInsensitive: true)

    /// Make a post's HTML safe to render (see the note at the top).
    public static func safe(_ html: String?) -> String {
        guard let html, !html.isEmpty else { return "" }
        let source = html as NSString
        let length = source.length
        var out = ""
        var open: [String] = []
        var i = 0
        var dropping: String?

        while i < length {
            let lt = source.range(of: "<", range: NSRange(location: i, length: length - i)).location
            if lt == NSNotFound {
                if dropping == nil { out += escapeText(source.substring(from: i)) }
                break
            }
            if dropping == nil { out += escapeText(source.substring(with: NSRange(location: i, length: lt - i))) }

            if source.range(of: "<!--", options: .anchored, range: NSRange(location: lt, length: length - lt)).location != NSNotFound {
                let end = source.range(of: "-->", range: NSRange(location: lt + 4, length: length - lt - 4)).location
                i = end == NSNotFound ? length : end + 3
                continue
            }

            guard let match = tag.firstMatch(in: html, options: .anchored, range: NSRange(location: lt, length: length - lt)) else {
                if dropping == nil { out += "&lt;" }
                i = lt + 1
                continue
            }
            i = lt + match.range.length
            let whole = source.substring(with: match.range)
            let closing = whole.hasPrefix("</")
            let name = source.substring(with: match.range(at: 1)).lowercased()

            if let current = dropping {
                if closing && name == current { dropping = nil }
                continue
            }
            if droppedWithContent.contains(name) {
                if !closing && !whole.hasSuffix("/>") { dropping = name }
                continue
            }
            if !allowedTags.contains(name) { continue }
            if closing {
                guard let at = open.lastIndex(of: name) else { continue }
                // Close anything left open inside it, so the nesting stays whole.
                while open.count > at { out += "</\(open.removeLast())>" }
                continue
            }

            out += "<\(name)\(attributes(name, source.substring(with: match.range(at: 2))))>"
            if !voidTags.contains(name) { open.append(name) }
        }
        while let name = open.popLast() { out += "</\(name)>" }
        return out
    }

    private static func attributes(_ name: String, _ raw: String) -> String {
        let allowed = anyTagAttributes + (tagAttributes[name] ?? [])
        let text = raw as NSString
        var attributes = ""
        var external = false

        for found in attribute.matches(in: raw, range: NSRange(location: 0, length: text.length)) {
            let key = text.substring(with: found.range(at: 1)).lowercased()
            guard allowed.contains(key) else { continue }
            var value = (2...4)
                .map { found.range(at: $0) }
                .first { $0.location != NSNotFound }
                .map { text.substring(with: $0) } ?? ""
            if urlAttributes.contains(key) {
                guard let url = safeURL(value) else { continue }
                value = url
                if key == "href" && matches(httpScheme, url) { external = true }
            }
            attributes += " \(key)=\"\(escapeAttribute(value))\""
        }
        if name == "a" && external {
            attributes += #" target="_blank" rel="noopener noreferrer nofollow""#
        }
        if name == "img" && !matches(lazyLoading, attributes) {
            attributes += #" loading="lazy""#
        }
        return attributes
    }

    /// Minutes to read a post, at 230 words a minute; tags don't count.
    public static func readingMinutes(_ html: String?) -> Int {
        let text = replace(anyTagInText, in: html ?? "", with: " ")
        let words = whitespace
            .stringByReplacingMatches(in: text, range: NSRange(location: 0, length: (text as NSString).length), withTemplate: " ")
            .split(separator: " ")
            .count
        return max(1, Int((Double(words) / 230).rounded(.toNearestOrAwayFromZero)))
    }

    /// "November 18, 2026", or "" without a date.
    public static func date(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let full = ISO8601DateFormatter()
        full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        let day = ISO8601DateFormatter()
        day.formatOptions = [.withFullDate]
        guard let parsed = full.date(from: iso) ?? plain.date(from: iso) ?? day.date(from: String(iso.prefix(10))) else {
            return ""
        }
        let parts = calendar.dateComponents([.year, .month, .day], from: parsed)
        guard let year = parts.year, let month = parts.month, let dayOfMonth = parts.day else { return "" }
        return "\(months[month - 1]) \(dayOfMonth), \(year)"
    }

    // MARK: - Escaping and URLs

    private static func escapeText(_ value: String) -> String {
        // An entity already in the text (&amp; &#8217;) stays one.
        replace(entityInText, in: value, with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static func escapeAttribute(_ value: String) -> String {
        escapeText(value).replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static func decodeEntities(_ value: String) -> String {
        var value = replaceEach(hexEntity, in: value) { codePoint($0, radix: 16) }
        value = replaceEach(decimalEntity, in: value) { codePoint($0, radix: 10) }
        for (entity, char) in [("&colon;", ":"), ("&tab;", "\t"), ("&newline;", "\n"), ("&amp;", "&")] {
            value = value.replacingOccurrences(of: entity, with: char, options: .caseInsensitive)
        }
        return value
    }

    /// Leading zeros count for nothing (&#0000106; is "j"); a number too big
    /// to be a character, a surrogate or zero becomes U+FFFD, as it does in a
    /// browser.
    private static func codePoint(_ digits: String, radix: Int) -> String {
        let digits = String(digits.drop { $0 == "0" })
        let n = digits.isEmpty || digits.count > 8 ? 0 : Int(digits, radix: radix) ?? 0
        guard n > 0, let scalar = Unicode.Scalar(UInt32(n)) else { return "\u{FFFD}" }
        return String(Character(scalar))
    }

    /// http(s), mailto, tel, a path on this site, or a #fragment.
    private static func safeURL(_ raw: String) -> String? {
        // Browsers ignore control characters and whitespace inside a scheme
        // ("java\nscript:"), so they are removed before the check.
        var scalars = String.UnicodeScalarView()
        scalars.append(contentsOf: decodeEntities(raw).unicodeScalars.filter {
            !($0.value <= 0x20 || (0x7F...0x9F).contains($0.value))
        })
        let value = String(scalars)
        if matches(webScheme, value) { return trim(raw) }
        if matches(anyScheme, value) { return nil }
        if value.hasPrefix("//") { return nil }
        return trim(raw)
    }

    /// PHP's trim(): space, tab, newline, carriage return, NUL and vertical tab.
    private static func trim(_ value: String) -> String {
        value.trimmingCharacters(in: CharacterSet(charactersIn: " \t\n\r\0\u{0B}"))
    }

    // MARK: - Regex helpers

    private static func regex(_ pattern: String, caseInsensitive: Bool = false) -> NSRegularExpression {
        // The patterns are constants; a typo is a programming error caught on first use.
        try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
    }

    private static func matches(_ regex: NSRegularExpression, _ value: String) -> Bool {
        regex.firstMatch(in: value, range: NSRange(location: 0, length: (value as NSString).length)) != nil
    }

    private static func replace(_ regex: NSRegularExpression, in value: String, with template: String) -> String {
        regex.stringByReplacingMatches(
            in: value,
            range: NSRange(location: 0, length: (value as NSString).length),
            withTemplate: NSRegularExpression.escapedTemplate(for: template)
        )
    }

    /// Replace each match with `transform(group 1)`.
    private static func replaceEach(_ regex: NSRegularExpression, in value: String, _ transform: (String) -> String) -> String {
        let text = value as NSString
        var out = ""
        var at = 0
        for match in regex.matches(in: value, range: NSRange(location: 0, length: text.length)) {
            out += text.substring(with: NSRange(location: at, length: match.range.location - at))
            out += transform(text.substring(with: match.range(at: 1)))
            at = match.range.location + match.range.length
        }
        return out + text.substring(from: at)
    }
}
