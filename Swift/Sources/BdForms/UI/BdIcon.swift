import SwiftUI

/// One of BD's element icons (the Lucide set), drawn natively.
///
/// BD serves each icon as a 24×24 stroked SVG made of a handful of
/// primitives; this parses those into a `Path` once and caches it, so an
/// icon is a vector `Shape` that takes the surrounding foreground style and
/// scales with Dynamic Type like an SF Symbol would.
public struct BdIcon: View {
    let name: String
    let size: CGFloat

    @Environment(\.bdIconBaseURL) private var base
    @State private var glyph: BdIconGlyph?

    public init(_ name: String, size: CGFloat = 20) {
        self.name = name
        self.size = size
    }

    public var body: some View {
        ZStack {
            if let glyph {
                BdIconShape(path: glyph.fill).fill(style: FillStyle())
                BdIconShape(path: glyph.stroke)
                    .stroke(style: StrokeStyle(lineWidth: 2 * size / 24, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .task(id: name) { glyph = await BdIconStore.shared.glyph(name, base: base) }
    }
}

struct BdIconShape: Shape {
    let path: Path
    func path(in rect: CGRect) -> Path {
        path.applying(CGAffineTransform(translationX: rect.minX, y: rect.minY)
            .scaledBy(x: rect.width / 24, y: rect.height / 24))
    }
}

struct BdIconGlyph: Sendable {
    let stroke: Path
    let fill: Path
}

@MainActor
final class BdIconStore {
    static let shared = BdIconStore()

    private var glyphs: [String: BdIconGlyph] = [:]
    private var names: [URL: [String]] = [:]
    private var inFlight: [String: Task<BdIconGlyph?, Never>] = [:]

    func glyph(_ name: String, base: URL) async -> BdIconGlyph? {
        let key = base.absoluteString + "|" + name
        if let g = glyphs[key] { return g }
        if let t = inFlight[key] { return await t.value }
        let url = base.appendingPathComponent("api/icons").appendingPathComponent("\(name).svg")
        let task = Task<BdIconGlyph?, Never> {
            guard let (data, response) = try? await URLSession.shared.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let svg = String(data: data, encoding: .utf8) else { return nil }
            return BdSVG.glyph(svg)
        }
        inFlight[key] = task
        let g = await task.value
        inFlight[key] = nil
        if let g { glyphs[key] = g }
        return g
    }

    /// Every icon name BD offers (for an unrestricted icon picker).
    func allNames(base: URL) async -> [String] {
        if let n = names[base] { return n }
        struct Index: Decodable { let icons: [String] }
        let url = base.appendingPathComponent("api/icons")
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let index = try? JSONDecoder().decode(Index.self, from: data) else { return [] }
        names[base] = index.icons
        return index.icons
    }
}

/// Just enough SVG for Lucide: circle, ellipse, line, path, polygon,
/// polyline and rect, in a 24×24 box.
enum BdSVG {
    nonisolated(unsafe) static let element = #/<(circle|ellipse|line|path|polygon|polyline|rect)\b([^>]*?)\/?>/#
    nonisolated(unsafe) static let attribute = #/([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/#

    static func glyph(_ svg: String) -> BdIconGlyph {
        var stroke = Path()
        var fill = Path()
        for m in svg.matches(of: element) {
            var a: [String: String] = [:]
            for attr in String(m.2).matches(of: attribute) { a[String(attr.1)] = String(attr.2) }
            func n(_ k: String) -> CGFloat { CGFloat(Double(a[k] ?? "") ?? 0) }
            var p = Path()
            switch m.1 {
            case "circle":
                let r = n("r")
                p.addEllipse(in: CGRect(x: n("cx") - r, y: n("cy") - r, width: 2 * r, height: 2 * r))
            case "ellipse":
                p.addEllipse(in: CGRect(x: n("cx") - n("rx"), y: n("cy") - n("ry"), width: 2 * n("rx"), height: 2 * n("ry")))
            case "line":
                p.move(to: CGPoint(x: n("x1"), y: n("y1")))
                p.addLine(to: CGPoint(x: n("x2"), y: n("y2")))
            case "rect":
                let rect = CGRect(x: n("x"), y: n("y"), width: n("width"), height: n("height"))
                let rx = a["rx"] != nil ? n("rx") : n("ry")
                let ry = a["ry"] != nil ? n("ry") : rx
                if rx > 0 || ry > 0 {
                    p.addRoundedRect(in: rect, cornerSize: CGSize(width: rx, height: ry))
                } else {
                    p.addRect(rect)
                }
            case "polygon", "polyline":
                let nums = numbers(a["points"] ?? "")
                var i = 0
                while i + 1 < nums.count {
                    let pt = CGPoint(x: nums[i], y: nums[i + 1])
                    if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                    i += 2
                }
                if m.1 == "polygon" { p.closeSubpath() }
            case "path":
                p = path(a["d"] ?? "")
            default:
                continue
            }
            if a["fill"] == "currentColor" { fill.addPath(p) } else { stroke.addPath(p) }
        }
        return BdIconGlyph(stroke: stroke, fill: fill)
    }

    static func numbers(_ s: String) -> [CGFloat] {
        var scanner = PathScanner(Array(s.utf8))
        var out: [CGFloat] = []
        while let n = scanner.number() { out.append(n) }
        return out
    }

    struct PathScanner {
        let b: [UInt8]
        var i = 0
        init(_ b: [UInt8]) { self.b = b }

        mutating func skip() {
            while i < b.count, b[i] == 32 || b[i] == 44 || b[i] == 9 || b[i] == 10 || b[i] == 13 { i += 1 }
        }

        mutating func command() -> UInt8? {
            skip()
            guard i < b.count else { return nil }
            let c = b[i]
            if (c >= 65 && c <= 90) || (c >= 97 && c <= 122), c != 101, c != 69 {
                i += 1
                return c
            }
            return nil
        }

        func atNumber() -> Bool {
            var j = i
            while j < b.count, b[j] == 32 || b[j] == 44 || b[j] == 9 || b[j] == 10 || b[j] == 13 { j += 1 }
            guard j < b.count else { return false }
            let c = b[j]
            return (c >= 48 && c <= 57) || c == 45 || c == 43 || c == 46
        }

        mutating func number() -> CGFloat? {
            skip()
            guard i < b.count else { return nil }
            let start = i
            if b[i] == 45 || b[i] == 43 { i += 1 }
            var sawDot = false
            while i < b.count {
                let c = b[i]
                if c >= 48 && c <= 57 { i += 1; continue }
                if c == 46 && !sawDot { sawDot = true; i += 1; continue }
                break
            }
            if i < b.count, b[i] == 101 || b[i] == 69 {
                var j = i + 1
                if j < b.count, b[j] == 45 || b[j] == 43 { j += 1 }
                if j < b.count, b[j] >= 48 && b[j] <= 57 {
                    i = j
                    while i < b.count, b[i] >= 48 && b[i] <= 57 { i += 1 }
                }
            }
            guard i > start, let v = Double(String(decoding: b[start..<i], as: UTF8.self)) else {
                i = start
                return nil
            }
            return CGFloat(v)
        }

        /// Arc flags may be written without separators (`a1 1 0 01 2 2`).
        mutating func flag() -> Bool? {
            skip()
            guard i < b.count, b[i] == 48 || b[i] == 49 else { return nil }
            defer { i += 1 }
            return b[i] == 49
        }
    }

    static func path(_ d: String) -> Path {
        var p = Path()
        var s = PathScanner(Array(d.utf8))
        var cur = CGPoint.zero
        var start = CGPoint.zero
        var lastCtrl: CGPoint?
        var lastQuad: CGPoint?
        var cmd: UInt8 = 0

        while true {
            if let c = s.command() {
                cmd = c
            } else if !s.atNumber() || cmd == 0 {
                break
            } else if cmd == 77 {
                cmd = 76
            } else if cmd == 109 {
                cmd = 108
            }
            let rel = cmd >= 97
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { rel ? CGPoint(x: cur.x + x, y: cur.y + y) : CGPoint(x: x, y: y) }
            var nextCtrl: CGPoint?
            var nextQuad: CGPoint?
            switch cmd | 0x20 {
            case 109: // m
                guard let x = s.number(), let y = s.number() else { return p }
                cur = pt(x, y)
                start = cur
                p.move(to: cur)
            case 108: // l
                guard let x = s.number(), let y = s.number() else { return p }
                cur = pt(x, y)
                p.addLine(to: cur)
            case 104: // h
                guard let x = s.number() else { return p }
                cur = CGPoint(x: rel ? cur.x + x : x, y: cur.y)
                p.addLine(to: cur)
            case 118: // v
                guard let y = s.number() else { return p }
                cur = CGPoint(x: cur.x, y: rel ? cur.y + y : y)
                p.addLine(to: cur)
            case 99: // c
                guard let x1 = s.number(), let y1 = s.number(), let x2 = s.number(), let y2 = s.number(),
                      let x = s.number(), let y = s.number() else { return p }
                let c1 = pt(x1, y1), c2 = pt(x2, y2), end = pt(x, y)
                p.addCurve(to: end, control1: c1, control2: c2)
                nextCtrl = c2
                cur = end
            case 115: // s
                guard let x2 = s.number(), let y2 = s.number(), let x = s.number(), let y = s.number() else { return p }
                let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let c2 = pt(x2, y2), end = pt(x, y)
                p.addCurve(to: end, control1: c1, control2: c2)
                nextCtrl = c2
                cur = end
            case 113: // q
                guard let x1 = s.number(), let y1 = s.number(), let x = s.number(), let y = s.number() else { return p }
                let c = pt(x1, y1), end = pt(x, y)
                p.addQuadCurve(to: end, control: c)
                nextQuad = c
                cur = end
            case 116: // t
                guard let x = s.number(), let y = s.number() else { return p }
                let c = lastQuad.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let end = pt(x, y)
                p.addQuadCurve(to: end, control: c)
                nextQuad = c
                cur = end
            case 97: // a
                guard let rx = s.number(), let ry = s.number(), let rot = s.number(),
                      let large = s.flag(), let sweep = s.flag(),
                      let x = s.number(), let y = s.number() else { return p }
                let end = pt(x, y)
                arc(&p, from: cur, to: end, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep)
                cur = end
            case 122: // z
                p.closeSubpath()
                cur = start
            default:
                return p
            }
            lastCtrl = nextCtrl
            lastQuad = nextQuad
        }
        return p
    }

    /// SVG endpoint arc → cubic Béziers (SVG 1.1 implementation notes, F.6).
    static func arc(_ p: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat,
                    rotation: CGFloat, large: Bool, sweep: Bool) {
        if p0 == p1 { return }
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 { p.addLine(to: p1); return }
        let phi = rotation * .pi / 180
        let cosP = cos(phi), sinP = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cosP * dx + sinP * dy
        let y1 = -sinP * dx + cosP * dy
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            rx *= lambda.squareRoot()
            ry *= lambda.squareRoot()
        }
        let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var coef = den == 0 ? 0 : (max(0, num / den)).squareRoot()
        if large == sweep { coef = -coef }
        let cx1 = coef * rx * y1 / ry
        let cy1 = -coef * ry * x1 / rx
        let cx = cosP * cx1 - sinP * cy1 + (p0.x + p1.x) / 2
        let cy = sinP * cx1 + cosP * cy1 + (p0.y + p1.y) / 2
        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
            return a
        }
        let theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && delta > 0 { delta -= 2 * .pi }
        if sweep && delta < 0 { delta += 2 * .pi }
        let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
        let step = delta / CGFloat(segments)
        let t = 4 / 3 * tan(step / 4)
        func point(_ a: CGFloat) -> CGPoint {
            let x = rx * cos(a), y = ry * sin(a)
            return CGPoint(x: cosP * x - sinP * y + cx, y: sinP * x + cosP * y + cy)
        }
        func deriv(_ a: CGFloat) -> CGPoint {
            let x = -rx * sin(a), y = ry * cos(a)
            return CGPoint(x: cosP * x - sinP * y, y: sinP * x + cosP * y)
        }
        var a = theta1
        for i in 0..<segments {
            let b = a + step
            let s0 = point(a), s1 = i == segments - 1 ? p1 : point(b)
            let d0 = deriv(a), d1 = deriv(b)
            p.addCurve(
                to: s1,
                control1: CGPoint(x: s0.x + t * d0.x, y: s0.y + t * d0.y),
                control2: CGPoint(x: s1.x - t * d1.x, y: s1.y - t * d1.y)
            )
            a = b
        }
    }
}
