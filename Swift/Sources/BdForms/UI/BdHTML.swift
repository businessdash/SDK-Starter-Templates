import SwiftUI

/// The small HTML dialect BD forms use, both ways.
///
/// - Reading: `richtext` content (server-sanitized) becomes an
///   `AttributedString` that `Text` draws natively, links included.
/// - Writing: a `rich_text_input` edited in a native `TextEditor` becomes the
///   HTML the server keeps (`p strong em u s a ul ol li br`), so a visitor's
///   bold on iPhone is bold in the BD dashboard.
public enum BdHTML {
    // MARK: HTML → AttributedString

    public static func attributedString(_ html: String, baseFont: Font = .body) -> AttributedString {
        var out = AttributedString()
        var bold = 0, italic = 0, underline = 0, strike = 0, code = 0
        var heading: Int?
        var link: [URL?] = []
        var lists: [(ordered: Bool, counter: Int)] = []
        var quote = 0
        var pendingBreak = false
        var atLineStart = true

        func newline(_ count: Int = 1) {
            guard !out.characters.isEmpty else { return }
            // Never more than one blank line in a row.
            let tail = String(out.characters.suffix(2))
            let have = tail == "\n\n" ? 2 : (tail.hasSuffix("\n") ? 1 : 0)
            if count > have { out.append(AttributedString(String(repeating: "\n", count: count - have))) }
            atLineStart = true
        }

        func emit(_ text: String) {
            var t = text
            if atLineStart { t = String(t.drop(while: { $0 == " " })) }
            guard !t.isEmpty else { return }
            if pendingBreak { newline(2); pendingBreak = false }
            var piece = AttributedString(t)
            var intent: InlinePresentationIntent = []
            if bold > 0 || heading != nil { intent.insert(.stronglyEmphasized) }
            if italic > 0 || quote > 0 { intent.insert(.emphasized) }
            if code > 0 { intent.insert(.code) }
            if strike > 0 { intent.insert(.strikethrough) }
            if !intent.isEmpty { piece.inlinePresentationIntent = intent }
            if underline > 0 { piece.underlineStyle = .single }
            if let h = heading {
                piece.font = h <= 1 ? .title2.bold() : h == 2 ? .title3.bold() : .headline
            }
            if quote > 0 { piece.foregroundColor = .secondary }
            if let url = link.last ?? nil { piece.link = url }
            out.append(piece)
            atLineStart = false
        }

        var i = html.startIndex
        while i < html.endIndex {
            if html[i] == "<", let close = html[i...].firstIndex(of: ">") {
                let raw = html[html.index(after: i)..<close]
                i = html.index(after: close)
                if raw.hasPrefix("!") { continue }
                let isEnd = raw.hasPrefix("/")
                let body = isEnd ? raw.dropFirst() : raw
                let name = body.prefix(while: { $0.isLetter || $0.isNumber }).lowercased()
                switch (name, isEnd) {
                case ("b", false), ("strong", false): bold += 1
                case ("b", true), ("strong", true): bold = max(0, bold - 1)
                case ("i", false), ("em", false): italic += 1
                case ("i", true), ("em", true): italic = max(0, italic - 1)
                case ("u", false): underline += 1
                case ("u", true): underline = max(0, underline - 1)
                case ("s", false), ("strike", false), ("del", false): strike += 1
                case ("s", true), ("strike", true), ("del", true): strike = max(0, strike - 1)
                case ("code", false): code += 1
                case ("code", true): code = max(0, code - 1)
                case ("a", false):
                    let href = attribute("href", in: String(body))
                    link.append(href.flatMap(safeLink))
                case ("a", true): _ = link.popLast()
                case ("br", _): newline(); pendingBreak = false
                case ("p", false), ("div", false), ("pre", false):
                    if !out.characters.isEmpty { pendingBreak = true }
                case ("p", true), ("div", true), ("pre", true):
                    pendingBreak = true
                case ("h1", false), ("h2", false), ("h3", false), ("h4", false), ("h5", false), ("h6", false):
                    if !out.characters.isEmpty { pendingBreak = true }
                    heading = Int(name.dropFirst())
                case ("h1", true), ("h2", true), ("h3", true), ("h4", true), ("h5", true), ("h6", true):
                    heading = nil
                    pendingBreak = true
                case ("blockquote", false):
                    if !out.characters.isEmpty { pendingBreak = true }
                    quote += 1
                case ("blockquote", true):
                    quote = max(0, quote - 1)
                    pendingBreak = true
                case ("ul", false), ("ol", false):
                    if lists.isEmpty, !out.characters.isEmpty { pendingBreak = true }
                    lists.append((name == "ol", 0))
                case ("ul", true), ("ol", true):
                    _ = lists.popLast()
                    if lists.isEmpty { pendingBreak = true }
                case ("li", false):
                    if pendingBreak { newline(2); pendingBreak = false } else { newline() }
                    let depth = max(lists.count - 1, 0)
                    var marker = "•"
                    if var top = lists.last {
                        top.counter += 1
                        lists[lists.count - 1] = top
                        if top.ordered { marker = "\(top.counter)." }
                    }
                    out.append(AttributedString(String(repeating: "    ", count: depth) + marker + " "))
                    atLineStart = true
                case ("li", true):
                    break
                default:
                    break
                }
                continue
            }
            // A stray "<" with no ">" after it is text; start past it, or
            // this would find it again and never advance.
            let from = html[i] == "<" ? html.index(after: i) : i
            let next = html[from...].firstIndex(of: "<") ?? html.endIndex
            let text = decodeEntities(String(html[i..<next]))
                .replacingOccurrences(of: "[\\s]+", with: " ", options: .regularExpression)
            emit(text)
            i = next
        }
        // Trim trailing newlines.
        while out.characters.last == "\n" { out.characters.removeLast() }
        return out
    }

    static func attribute(_ name: String, in tag: String) -> String? {
        let pattern = "\(name)\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))"
        guard let re = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let m = re.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)) else { return nil }
        for g in 2...4 {
            if let r = Range(m.range(at: g), in: tag) { return decodeEntities(String(tag[r])) }
        }
        return nil
    }

    static func safeLink(_ raw: String) -> URL? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        guard let url = URL(string: s), let scheme = url.scheme?.lowercased(),
              ["http", "https", "mailto", "tel"].contains(scheme) else { return nil }
        return url
    }

    static let namedEntities: [String: String] = [
        "amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": "\u{00A0}",
        "mdash": "—", "ndash": "–", "hellip": "…", "rsquo": "’", "lsquo": "‘",
        "rdquo": "”", "ldquo": "“", "copy": "©", "reg": "®", "trade": "™", "bull": "•",
    ]

    public static func decodeEntities(_ s: String) -> String {
        guard s.contains("&") else { return s }
        var out = ""
        var i = s.startIndex
        while i < s.endIndex {
            if s[i] == "&", let semi = s[i...].prefix(12).firstIndex(of: ";") {
                let name = s[s.index(after: i)..<semi]
                var replacement: String?
                if name.hasPrefix("#x") || name.hasPrefix("#X") {
                    replacement = UInt32(name.dropFirst(2), radix: 16).flatMap(Unicode.Scalar.init).map { String(Character($0)) }
                } else if name.hasPrefix("#") {
                    replacement = UInt32(name.dropFirst()).flatMap(Unicode.Scalar.init).map { String(Character($0)) }
                } else {
                    replacement = namedEntities[String(name)]
                }
                if let replacement {
                    out += replacement
                    i = s.index(after: semi)
                    continue
                }
            }
            out.append(s[i])
            i = s.index(after: i)
        }
        return out
    }

    public static func escape(_ s: String) -> String {
        var out = ""
        out.reserveCapacity(s.count)
        for c in s {
            switch c {
            case "&": out += "&amp;"
            case "<": out += "&lt;"
            case ">": out += "&gt;"
            case "\"": out += "&quot;"
            default: out.append(c)
            }
        }
        return out
    }

    // MARK: AttributedString → HTML

    /// Bullet and number markers the editor's list buttons write.
    static let bullet = "•\u{2002}"

    static func numberedPrefix(_ line: Substring) -> Substring.Index? {
        var j = line.startIndex
        while j < line.endIndex, line[j].isASCIIDigit { j = line.index(after: j) }
        guard j > line.startIndex, j < line.endIndex, line[j] == "." else { return nil }
        let after = line.index(after: j)
        guard after < line.endIndex, line[after] == "\u{2002}" || line[after] == " " else { return nil }
        return line.index(after: after)
    }

    /// The HTML for an edited rich text value. `isBold`/`isItalic` read the
    /// run's font (the editor stores formatting as fonts); pass the resolver
    /// from `\.fontResolutionContext`.
    public static func html(
        from text: AttributedString,
        isBold: (AttributedString.Runs.Run) -> Bool,
        isItalic: (AttributedString.Runs.Run) -> Bool
    ) -> String {
        guard !String(text.characters).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return "" }

        // Inline HTML for one line of the document.
        func inline(_ range: Range<AttributedString.Index>) -> String {
            var html = ""
            for run in text[range].runs {
                let raw = String(text[run.range].characters)
                if raw.isEmpty { continue }
                var s = escape(raw)
                let intent = run.inlinePresentationIntent ?? []
                if run.strikethroughStyle != nil || intent.contains(.strikethrough) { s = "<s>\(s)</s>" }
                if run.underlineStyle != nil { s = "<u>\(s)</u>" }
                if isItalic(run) || intent.contains(.emphasized) { s = "<em>\(s)</em>" }
                if isBold(run) || intent.contains(.stronglyEmphasized) { s = "<strong>\(s)</strong>" }
                if intent.contains(.code) { s = "<code>\(s)</code>" }
                if let url = run.link, let safe = safeLink(url.absoluteString) {
                    s = "<a href=\"\(escape(safe.absoluteString))\">\(s)</a>"
                }
                html += s
            }
            return html
        }

        var blocks: [String] = []
        var openList: String?
        func closeList() {
            if let l = openList { blocks.append("</\(l)>") }
            openList = nil
        }

        let chars = text.characters
        var lineStart = chars.startIndex
        var idx = chars.startIndex
        func finishLine(_ end: AttributedString.Index) {
            let line = String(chars[lineStart..<end])
            var contentStart = lineStart
            var kind = "p"
            if line.hasPrefix(bullet) || line.hasPrefix("• ") {
                kind = "ul"
                contentStart = chars.index(lineStart, offsetBy: 2)
            } else if let after = numberedPrefix(Substring(line)) {
                kind = "ol"
                contentStart = chars.index(lineStart, offsetBy: line.distance(from: line.startIndex, to: after))
            }
            let body = inline(contentStart..<end)
            if kind == "p" {
                closeList()
                blocks.append(body.isEmpty ? "<p><br></p>" : "<p>\(body)</p>")
            } else {
                if openList != kind { closeList(); blocks.append("<\(kind)>"); openList = kind }
                blocks.append("<li>\(body)</li>")
            }
        }
        while idx < chars.endIndex {
            if chars[idx] == "\n" {
                finishLine(idx)
                lineStart = chars.index(after: idx)
            }
            idx = chars.index(after: idx)
        }
        if lineStart < chars.endIndex { finishLine(chars.endIndex) }
        closeList()
        // Drop trailing empty paragraphs.
        while blocks.last == "<p><br></p>" { blocks.removeLast() }
        return blocks.joined()
    }

    /// Editable text from stored HTML (to restore a draft or default).
    public static func editable(_ html: String) -> AttributedString {
        var a = attributedString(html)
        // The editor carries formatting as fonts; translate intents.
        for run in a.runs {
            let intent = run.inlinePresentationIntent ?? []
            guard !intent.isEmpty else { continue }
            var font = Font.body
            if intent.contains(.stronglyEmphasized) { font = font.bold() }
            if intent.contains(.emphasized) { font = font.italic() }
            a[run.range].font = font
            if intent.contains(.strikethrough) { a[run.range].strikethroughStyle = .single }
            a[run.range].inlinePresentationIntent = nil
        }
        // Bullets the reader drew become the editor's own markers.
        return a
    }
}
