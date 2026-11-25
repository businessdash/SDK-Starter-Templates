import Foundation

/// One piece of a post's body, ready for native views: a heading, a
/// paragraph, a list, a photo… Text runs carry their bold, italic, code and
/// links in an `AttributedString`, which SwiftUI's `Text` shows as is.
public enum PostBlock: Sendable, Equatable {
    case heading(level: Int, text: AttributedString)
    case paragraph(AttributedString)
    case quote(AttributedString)
    case list([PostListItem])
    case code(String)
    case image(url: URL, alt: String)
    /// A photo's caption (`<figcaption>`) or a table's (`<caption>`).
    case caption(AttributedString)
    case table([PostTableRow])
    case rule
}

public struct PostListItem: Sendable, Equatable {
    /// "1.", "•" or "◦"; empty for a line that continues the item above.
    public let marker: String
    public let text: AttributedString
    /// 0 for the outer list, 1 for a list inside it, …
    public let depth: Int
}

public struct PostTableRow: Sendable, Equatable {
    public let cells: [AttributedString]
    /// Every cell is a `<th>`, or the row is in `<thead>`.
    public let isHeader: Bool
}

/// A post's HTML as ``PostBlock``s.
///
/// The HTML goes through ``PostHtml/safe(_:)`` first, so what is read here is
/// well nested and holds only the allowlisted tags. Links keep web, mail and
/// phone addresses only (a path on the website means nothing in the app), and
/// photos need a full http(s) address.
public enum PostBlocks {
    public static func from(_ html: String?) -> [PostBlock] {
        var reader = Reader()
        reader.read(PostHtml.safe(html))
        return reader.blocks
    }
}

private struct Reader {
    var blocks: [PostBlock] = []

    // The text being gathered, and the inline styles open around it.
    private var inline = AttributedString()
    // Underline and highlight (<u>, <mark>) read as plain text: they are
    // drawing styles, and this module has no UI framework.
    private var bold = 0, italic = 0, strike = 0, code = 0
    private var links: [URL?] = []

    // Where the text goes when it's finished.
    private var heading: Int?
    private var quoteDepth = 0
    private var preDepth = 0
    private var inCaption = false
    private var lists: [(ordered: Bool, next: Int)] = []
    private var listItems: [PostListItem] = []
    /// One marker per open `<li>`; "" once its first line is out.
    private var items: [String] = []
    private var tableRows: [PostTableRow]?
    private var row: [AttributedString]?
    private var rowIsHeader = true
    private var inHead = false

    private static let tag = try! NSRegularExpression(pattern: #"<(/?)([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*/?>"#)
    private static let attribute = try! NSRegularExpression(pattern: #"([a-z-]+)="([^"]*)""#)
    private static let space = try! NSRegularExpression(pattern: #"[\t\n\r\f ]+"#)
    private static let entity = try! NSRegularExpression(pattern: #"&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});"#)
    private static let named: [String: String] = [
        "amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": "\u{00A0}",
        "lsquo": "\u{2018}", "rsquo": "\u{2019}", "ldquo": "\u{201C}", "rdquo": "\u{201D}",
        "ndash": "\u{2013}", "mdash": "\u{2014}", "hellip": "\u{2026}", "middot": "\u{00B7}",
        "bull": "\u{2022}", "copy": "\u{00A9}", "reg": "\u{00AE}", "trade": "\u{2122}",
        "times": "\u{00D7}", "deg": "\u{00B0}", "euro": "\u{20AC}", "pound": "\u{00A3}",
    ]

    mutating func read(_ html: String) {
        let source = html as NSString
        var at = 0
        for match in Self.tag.matches(in: html, range: NSRange(location: 0, length: source.length)) {
            if match.range.location > at {
                text(source.substring(with: NSRange(location: at, length: match.range.location - at)))
            }
            at = match.range.location + match.range.length
            let closing = match.range(at: 1).length > 0
            let name = source.substring(with: match.range(at: 2))
            let attributes = Self.attributes(source.substring(with: match.range(at: 3)))
            closing ? close(name) : open(name, attributes)
        }
        if at < source.length { text(source.substring(from: at)) }
        finishParagraph()
        finishList()
    }

    /// A finished block. A list still being gathered goes out first, so a
    /// photo inside a list item lands between its lines, not before them.
    private mutating func emit(_ block: PostBlock) {
        if !listItems.isEmpty {
            blocks.append(.list(listItems))
            listItems = []
        }
        blocks.append(block)
    }

    // MARK: Tags

    private mutating func open(_ name: String, _ attributes: [String: String]) {
        switch name {
        case "p", "div":
            if !items.isEmpty || row != nil {
                newLine()
            } else {
                finishParagraph()
            }
        case "h1", "h2", "h3", "h4", "h5", "h6":
            finishParagraph()
            heading = Int(name.dropFirst()) ?? 2
        case "blockquote":
            finishParagraph()
            quoteDepth += 1
        case "pre":
            finishParagraph()
            preDepth += 1
        case "ul", "ol":
            // A list inside an item: the item's text so far is its first line.
            finishParagraph()
            lists.append((name == "ol", Int(attributes["start"] ?? "") ?? 1))
        case "li":
            finishParagraph()
            guard !lists.isEmpty else { break }
            let depth = lists.count - 1
            if lists[depth].ordered {
                items.append("\(lists[depth].next).")
                lists[depth].next += 1
            } else {
                items.append(depth == 0 ? "•" : "◦")
            }
        case "table":
            finishParagraph()
            tableRows = []
        case "thead":
            inHead = true
        case "tr":
            row = []
            rowIsHeader = true
        case "td", "th":
            inline = AttributedString()
            if name == "td" { rowIsHeader = false }
        case "caption", "figcaption":
            finishParagraph()
            inCaption = true
        case "img":
            finishParagraph()
            if let src = attributes["src"], src.lowercased().hasPrefix("http"), let url = URL(string: src) {
                emit(.image(url: url, alt: attributes["alt"] ?? ""))
            }
        case "hr":
            finishParagraph()
            emit(.rule)
        case "br":
            newLine()
        case "b", "strong": bold += 1
        case "i", "em": italic += 1
        case "s", "del": strike += 1
        case "code", "kbd": code += 1
        case "a": links.append(attributes["href"].flatMap(Self.linkURL))
        default: break // abbr, span, small, sub, sup, tbody, tfoot, figure: no styling of their own.
        }
    }

    private mutating func close(_ name: String) {
        switch name {
        case "p", "div":
            if items.isEmpty && row == nil { finishParagraph() }
        case "h1", "h2", "h3", "h4", "h5", "h6":
            finishParagraph()
            heading = nil
        case "blockquote":
            finishParagraph()
            quoteDepth = max(0, quoteDepth - 1)
        case "pre":
            let text = String(inline.characters)
            inline = AttributedString()
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                emit(.code(text.trimmingCharacters(in: .newlines)))
            }
            preDepth = max(0, preDepth - 1)
        case "li":
            finishParagraph()
            if !items.isEmpty { items.removeLast() }
        case "ul", "ol":
            finishParagraph()
            if !lists.isEmpty { lists.removeLast() }
            if lists.isEmpty { finishList() }
        case "td", "th":
            let cell = trimmed(inline)
            row?.append(cell)
            inline = AttributedString()
        case "tr":
            if let cells = row, !cells.isEmpty {
                tableRows?.append(PostTableRow(cells: cells, isHeader: inHead || rowIsHeader))
            }
            row = nil
        case "thead":
            inHead = false
        case "table":
            if let rows = tableRows, !rows.isEmpty { emit(.table(rows)) }
            tableRows = nil
        case "caption", "figcaption":
            finishParagraph()
            inCaption = false
        case "b", "strong": bold = max(0, bold - 1)
        case "i", "em": italic = max(0, italic - 1)
        case "s", "del": strike = max(0, strike - 1)
        case "code", "kbd": code = max(0, code - 1)
        case "a": if !links.isEmpty { links.removeLast() }
        default: break
        }
    }

    // MARK: Text

    private mutating func text(_ raw: String) {
        var value = Self.decode(raw)
        if preDepth == 0 {
            value = Self.space.stringByReplacingMatches(
                in: value, range: NSRange(location: 0, length: (value as NSString).length), withTemplate: " "
            )
            // Spaces collapse, as in a browser: none at the start of a line.
            if inline.characters.isEmpty || inline.characters.last == " " || inline.characters.last == "\n" {
                value = String(value.drop { $0 == " " })
            }
        }
        guard !value.isEmpty else { return }

        var run = AttributedString(value)
        var intent: InlinePresentationIntent = []
        if bold > 0 { intent.insert(.stronglyEmphasized) }
        if italic > 0 { intent.insert(.emphasized) }
        if code > 0 && preDepth == 0 { intent.insert(.code) }
        if strike > 0 { intent.insert(.strikethrough) }
        if !intent.isEmpty { run.inlinePresentationIntent = intent }
        if let link = links.last(where: { $0 != nil }) ?? nil { run.link = link }
        inline.append(run)
    }

    private mutating func newLine() {
        if !inline.characters.isEmpty && inline.characters.last != "\n" {
            inline.append(AttributedString("\n"))
        }
    }

    // MARK: Finishing blocks

    /// Send the text gathered so far where it belongs: a list line, a
    /// caption, a heading, a quote or a paragraph.
    private mutating func finishParagraph() {
        let text = trimmed(inline)
        inline = AttributedString()
        guard !text.characters.isEmpty else { return }
        if !lists.isEmpty {
            // In an item (or loose in the list): one line, marked the first time.
            let marker = items.last ?? ""
            listItems.append(PostListItem(marker: marker, text: text, depth: lists.count - 1))
            if !items.isEmpty { items[items.count - 1] = "" }
        } else if inCaption {
            emit(.caption(text))
        } else if let heading {
            emit(.heading(level: heading, text: text))
        } else if quoteDepth > 0 {
            emit(.quote(text))
        } else {
            emit(.paragraph(text))
        }
    }

    private mutating func finishList() {
        items = []
        if !listItems.isEmpty { blocks.append(.list(listItems)) }
        listItems = []
    }

    // MARK: Helpers

    private func trimmed(_ text: AttributedString) -> AttributedString {
        var text = text
        while let first = text.characters.first, first == " " || first == "\n" {
            text.removeSubrange(text.startIndex..<text.index(afterCharacter: text.startIndex))
        }
        while let last = text.characters.last, last == " " || last == "\n" {
            text.removeSubrange(text.index(beforeCharacter: text.endIndex)..<text.endIndex)
        }
        return text
    }

    /// Web, mail and phone links open from the app; a path or a #fragment of
    /// the website would go nowhere, so its text stays plain.
    private static func linkURL(_ href: String) -> URL? {
        let value = decode(href)
        let lower = value.lowercased()
        guard lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("mailto:") || lower.hasPrefix("tel:") else {
            return nil
        }
        return URL(string: value)
    }

    private static func attributes(_ raw: String) -> [String: String] {
        let text = raw as NSString
        var out: [String: String] = [:]
        for match in attribute.matches(in: raw, range: NSRange(location: 0, length: text.length)) {
            out[text.substring(with: match.range(at: 1))] = decode(text.substring(with: match.range(at: 2)))
        }
        return out
    }

    /// Character references: numeric ones, and the named ones posts use.
    /// An unknown name stays as written.
    static func decode(_ value: String) -> String {
        guard value.contains("&") else { return value }
        let text = value as NSString
        var out = ""
        var at = 0
        for match in entity.matches(in: value, range: NSRange(location: 0, length: text.length)) {
            out += text.substring(with: NSRange(location: at, length: match.range.location - at))
            at = match.range.location + match.range.length
            let body = text.substring(with: match.range(at: 1))
            if body.hasPrefix("#") {
                let hex = body.dropFirst().first == "x" || body.dropFirst().first == "X"
                let digits = hex ? String(body.dropFirst(2)) : String(body.dropFirst())
                if let n = UInt32(digits, radix: hex ? 16 : 10), n > 0, let scalar = Unicode.Scalar(n) {
                    out.append(Character(scalar))
                } else {
                    out += "\u{FFFD}"
                }
            } else {
                out += named[body] ?? text.substring(with: match.range)
            }
        }
        return out + text.substring(from: at)
    }
}
