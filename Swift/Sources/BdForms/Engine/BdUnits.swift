import Foundation

public struct BdUnit: Sendable, Hashable {
    public let symbol: String
    public let factor: Double
}

public struct BdUnitCategory: Sendable, Hashable {
    public let key: String
    public let label: String
    public let baseUnit: String
    /// Temperature: units differ by an offset, not just a factor.
    public let isAffine: Bool
    public let units: [BdUnit]

    public func contains(_ unit: String) -> Bool { units.contains { $0.symbol == unit } }
    func unit(_ symbol: String) -> BdUnit? { units.first { $0.symbol == symbol } }
}

/// Measurement conversion: the same table and arithmetic as forms-core's
/// `units.ts` (the table itself is generated from it).
public enum BdUnits {
    public static var categories: [BdUnitCategory] { BdFormsData.unitCategories }

    public static func category(_ key: String?) -> BdUnitCategory? {
        guard let key else { return nil }
        return BdFormsData.unitCategories.first { $0.key == key }
    }

    public static func convertToBase(_ value: Double, unit: String, in cat: BdUnitCategory) -> Double? {
        guard let u = cat.unit(unit) else { return nil }
        if cat.isAffine {
            switch unit {
            case "°C": return value
            case "°F": return (value - 32) * (5.0 / 9.0)
            case "K": return value - 273.15
            default: return nil
            }
        }
        return value * u.factor
    }

    public static func convertFromBase(_ base: Double, unit: String, in cat: BdUnitCategory) -> Double? {
        guard let u = cat.unit(unit) else { return nil }
        if cat.isAffine {
            switch unit {
            case "°C": return base
            case "°F": return base * (9.0 / 5.0) + 32
            case "K": return base + 273.15
            default: return nil
            }
        }
        return base / u.factor
    }

    /// A friendly restatement: 1500 m → "1.5 km". Picks the largest unit the
    /// value reaches, rounded to 4 places.
    public static func format(_ value: Double?, unit: String, in cat: BdUnitCategory) -> String {
        guard let value, !value.isNaN else { return "" }
        func tidy(_ n: Double) -> String { BdJS.string(BdJS.number(BdJS.toFixed(n, 4))) }
        guard !cat.isAffine, cat.contains(unit), let base = convertToBase(value, unit: unit, in: cat) else {
            return "\(tidy(value)) \(unit)"
        }
        let ordered = cat.units.enumerated().sorted {
            $0.element.factor != $1.element.factor ? $0.element.factor > $1.element.factor : $0.offset < $1.offset
        }.map(\.element)
        let magnitude = abs(base)
        for u in ordered where magnitude >= u.factor || u.symbol == ordered.last?.symbol {
            return "\(tidy(base / u.factor)) \(u.symbol)"
        }
        return "\(tidy(value)) \(unit)"
    }
}

/// Date parsing with the server's rules (`toUtcLegacyDate`): a bare
/// `YYYY-MM-DD` is midnight UTC, an ISO instant with an offset is that
/// instant, anything else falls back to the looser `Date.parse` shapes.
public enum BdDates {
    public static let utc: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    public static func parse(_ value: BdJSON) -> Date? {
        switch value {
        case .number(let ms): return ms.isFinite ? Date(timeIntervalSince1970: ms / 1000) : nil
        default: return parseInstant(BdJS.string(value))
        }
    }

    public static func parseInstant(_ raw: String) -> Date? {
        let s = raw.trimmingCharacters(in: BdJS.jsWhitespace)
        if let m = s.wholeMatch(of: #/(\d{4})-(\d{2})-(\d{2})/#),
           let y = Int(m.1), let mo = Int(m.2), let d = Int(m.3)
        {
            return utc.date(from: DateComponents(year: y, month: mo, day: d))
        }
        // ISO 8601 with an explicit offset or Z (Temporal.Instant.from).
        if let m = s.wholeMatch(of: #/(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})/#) {
            var comps = DateComponents(
                year: Int(m.1), month: Int(m.2), day: Int(m.3),
                hour: Int(m.4), minute: Int(m.5), second: m.6.flatMap { Int($0) } ?? 0
            )
            if let frac = m.7 {
                let padded = String(frac.prefix(9)).padding(toLength: 9, withPad: "0", startingAt: 0)
                comps.nanosecond = Int(padded)
            }
            let zone = String(m.8)
            if zone == "Z" || zone == "z" {
                comps.timeZone = TimeZone(identifier: "UTC")
            } else {
                let sign = zone.hasPrefix("-") ? -1 : 1
                let digits = zone.dropFirst().filter(\.isASCIIDigit)
                let hours = Int(digits.prefix(2)) ?? 0
                let minutes = Int(digits.suffix(2)) ?? 0
                comps.timeZone = TimeZone(secondsFromGMT: sign * (hours * 3600 + minutes * 60))
            }
            return utc.date(from: comps)
        }
        // Date.parse fallbacks: a date-time without offset is LOCAL time.
        if let m = s.wholeMatch(of: #/(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?/#) {
            var local = Calendar(identifier: .gregorian)
            local.timeZone = .current
            return local.date(from: DateComponents(
                year: Int(m.1), month: Int(m.2), day: Int(m.3),
                hour: Int(m.4), minute: Int(m.5), second: m.6.flatMap { Int($0) } ?? 0,
                nanosecond: m.7.flatMap { Int($0.padding(toLength: 3, withPad: "0", startingAt: 0)) }.map { $0 * 1_000_000 }
            ))
        }
        if let m = s.wholeMatch(of: #/(\d{4})-(\d{2})/#), let y = Int(m.1), let mo = Int(m.2) {
            return utc.date(from: DateComponents(year: y, month: mo, day: 1))
        }
        if let m = s.wholeMatch(of: #/(\d{4})/#), let y = Int(m.1) {
            return utc.date(from: DateComponents(year: y, month: 1, day: 1))
        }
        for format in ["MMMM d, yyyy", "MMM d, yyyy", "yyyy/MM/dd", "MM/dd/yyyy", "EEE, dd MMM yyyy HH:mm:ss zzz"] {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = .current
            f.dateFormat = format
            if let d = f.date(from: s) { return d }
        }
        return nil
    }

    /// `Date.toISOString()`: `2024-03-15T10:00:00.000Z`.
    public static func isoString(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: date)
    }

    /// `YYYY-MM-DD` in the given calendar's zone (UTC by default).
    public static func ymd(_ date: Date, calendar: Calendar = utc) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// A `YYYY-MM-DD` as a local-calendar date, for date pickers.
    public static func localDate(fromYMD ymd: String) -> Date? {
        guard let m = ymd.wholeMatch(of: #/(\d{4})-(\d{2})-(\d{2})/#) else { return nil }
        return Calendar.current.date(from: DateComponents(year: Int(m.1), month: Int(m.2), day: Int(m.3)))
    }

    /// A local-calendar date as `YYYY-MM-DD` (what date fields submit).
    public static func ymd(local date: Date) -> String {
        ymd(date, calendar: .current)
    }
}
