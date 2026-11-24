import Foundation
import SwiftUI

/// The boxes the sign-in screen can show.
public enum BdSignInBox: Hashable, Sendable, CaseIterable {
    case firstName, lastName, email, password, code, newPassword
}

/// What's wrong with one box, or nil — the same rules as `<BdSignIn>` on the
/// web and BD's own `auth/customer/*` routes. The screen runs them when the
/// person leaves a box they've typed in, and for every box when they press
/// the button; BD checks again on its side.
public enum BdSignInChecks {
    /// A new password's minimum length — BD's rule.
    public static let minPasswordLength = 10
    public static let maxPasswordLength = 256
    public static let maxEmailLength = 320
    public static let maxNameLength = 100

    /// Local part @ domain . TLD (≥ 2) — the rule BD's forms use for email.
    nonisolated(unsafe) private static let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    /// - Parameter newPassword: the password box is choosing one (a new
    ///   account), not just signing in — BD's minimum applies.
    public static func problem(
        _ box: BdSignInBox,
        _ value: String,
        newPassword: Bool,
        strings: BdSignInStrings = BdSignInStrings()
    ) -> String? {
        switch box {
        case .firstName, .lastName:
            return value.trimmingCharacters(in: .whitespacesAndNewlines).count > maxNameLength
                ? strings.nameTooLong : nil
        case .email:
            let email = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if email.isEmpty { return strings.enterEmail }
            if email.count > maxEmailLength || email.wholeMatch(of: emailPattern) == nil {
                return strings.invalidEmail
            }
            return nil
        case .password where !newPassword:
            if value.isEmpty { return strings.enterPassword }
            return value.count > maxPasswordLength ? strings.passwordTooLong : nil
        case .password, .newPassword:
            if value.count < minPasswordLength { return strings.passwordTooShort }
            return value.count > maxPasswordLength ? strings.passwordTooLong : nil
        case .code:
            return value.count == 6 && value.allSatisfy(\.isASCIIDigit) ? nil : strings.enterCode
        }
    }

    /// BD's answers that are about one box, so they show under it.
    static func box(for error: BdSignInError, among shown: [BdSignInBox]) -> BdSignInBox? {
        let candidates: [BdSignInBox] = switch error.code {
        case "weak_password", "password_too_short": [.newPassword, .password]
        case "invalid_code", "code_expired": [.code]
        case "invalid_email": [.email]
        default: []
        }
        return candidates.first(where: shown.contains)
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}

/// A business's two brand colours (Settings → Branding in BD) as the screen
/// uses them: the primary on the main button, exactly as set, with black or
/// white text — whichever reads; the secondary (else the primary) on links,
/// nudged only as far as it takes to read at 4.5:1 on a light or dark screen.
public struct BdSignInPalette: Equatable, Sendable {
    public let accent: Color
    public let onAccent: Color
    let linkLight: Color
    let linkDark: Color

    public func link(_ scheme: ColorScheme) -> Color { scheme == .dark ? linkDark : linkLight }

    /// Nil when `primary` isn't `#rrggbb` (or `#rgb`).
    public init?(primary: String?, secondary: String?) {
        guard let accent = RGB(hex: primary) else { return nil }
        let linkBase = RGB(hex: secondary) ?? accent
        self.accent = accent.color
        self.onAccent = accent.contrast(with: .white) >= accent.contrast(with: .ink) ? .white : RGB.ink.color
        self.linkLight = linkBase.legible(on: .white, minimum: 4.5).color
        self.linkDark = linkBase.legible(on: .darkSurface, minimum: 4.5).color
    }

    /// Black or white text, whichever reads better on `color`.
    public static func foreground(on color: Color, in environment: EnvironmentValues) -> Color {
        let resolved = color.resolve(in: environment)
        let lum = 0.2126 * Double(resolved.linearRed) + 0.7152 * Double(resolved.linearGreen)
            + 0.0722 * Double(resolved.linearBlue)
        let onWhite = 1.05 / (lum + 0.05)
        let onInk = (lum + 0.05) / (RGB.ink.luminance + 0.05)
        return onWhite >= onInk ? .white : RGB.ink.color
    }
}

/// An sRGB colour, 0…255 per channel.
struct RGB: Equatable {
    var r: Double, g: Double, b: Double

    static let white = RGB(r: 255, g: 255, b: 255)
    static let black = RGB(r: 0, g: 0, b: 0)
    /// Near-black text (#111827).
    static let ink = RGB(r: 17, g: 24, b: 39)
    /// The dark screen links must read on (#111827).
    static let darkSurface = ink

    init(r: Double, g: Double, b: Double) {
        self.r = r; self.g = g; self.b = b
    }

    init?(hex: String?) {
        guard var text = hex?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              text.hasPrefix("#") else { return nil }
        text.removeFirst()
        if text.count == 3 { text = text.map { "\($0)\($0)" }.joined() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        r = Double((value >> 16) & 0xff)
        g = Double((value >> 8) & 0xff)
        b = Double(value & 0xff)
    }

    var color: Color { Color(.sRGB, red: r / 255, green: g / 255, blue: b / 255) }

    var luminance: Double {
        func lin(_ c: Double) -> Double {
            let v = c / 255
            return v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }

    func contrast(with other: RGB) -> Double {
        let (a, b) = (luminance, other.luminance)
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    func mixed(toward other: RGB, _ t: Double) -> RGB {
        RGB(r: (r + (other.r - r) * t).rounded(),
            g: (g + (other.g - g) * t).rounded(),
            b: (b + (other.b - b) * t).rounded())
    }

    /// Darkened (light surface) or lightened (dark one) just enough to read.
    func legible(on surface: RGB, minimum: Double) -> RGB {
        let toward: RGB = surface.luminance > 0.5 ? .black : .white
        for step in 0...40 {
            let candidate = mixed(toward: toward, Double(step) / 40)
            if candidate.contrast(with: surface) >= minimum { return candidate }
        }
        return toward
    }
}
