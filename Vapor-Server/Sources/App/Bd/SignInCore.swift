import Foundation

// The sign-in screen's words, checks and brand colours: a Swift port of
// `@businessdash/sdk/sign-in-core`, so this server renders the same screen as
// every other starter (`<BdSignIn>`, the Swift app's `BdSignInView`, Kotlin's
// `:bd-sign-in`). Keep it in step with the SDK.

enum SignInField: String, CaseIterable, Sendable {
    case firstName, lastName, email, password, code, newPassword
}

enum SignInStep: String, CaseIterable, Sendable {
    case signIn, createAccount, forgot, code
}

enum SignInPurpose: String, Codable, Sendable {
    /// A new account, made when the code comes back.
    case signUp
    /// A forgotten password, set with the code.
    case reset
    /// WorkOS wants the email confirmed before a password sign-in.
    case verify
}

enum SignInProvider: String, CaseIterable, Sendable {
    // The order the screen shows them.
    case apple, google, github, discord
}

/// Every word the screen shows (`DEFAULT_SIGN_IN_STRINGS`).
enum SignInWords {
    static let signInTitle = "Sign in to {name}"
    static let createTitle = "Create your {name} account"
    static let createSubtitle = "Your account with {name}. We'll email you a code to confirm it."
    static let signInTitleNoName = "Sign in"
    static let createTitleNoName = "Create your account"
    static let createSubtitleNoName = "We'll email you a code to confirm it."
    static let forgotTitle = "Reset your password"
    static let forgotSubtitle = "Enter your email and we'll send you a code."
    static let codeTitle = "Check your email"
    static let codeSubtitle = "We sent a 6-digit code to {email}."
    static let codeResetSubtitle = "We sent a 6-digit code to {email}. Enter it with your new password."
    static let passwordRule = "At least 10 characters."
    static let signIn = "Sign in"
    static let createAccount = "Create account"
    static let sendCode = "Send code"
    static let confirm = "Continue"
    static let resendCode = "Send a new code"
    static let codeResent = "A new code is on its way."
    static let forgotPassword = "Forgot password?"
    static let noAccount = "New here? Create an account"
    static let haveAccount = "Already have an account? Sign in"
    static let backToSignIn = "Back to sign in"
    static let or = "or"
    static let enterEmail = "Enter your email."
    static let invalidEmail = "Enter a full email address, like name@example.com."
    static let enterPassword = "Enter your password."
    static let enterCode = "Enter the 6-digit code from the email."
    static let passwordTooShort = "Use at least 10 characters for your password."
    static let passwordTooLong = "Use 256 characters or fewer for your password."
    static let nameTooLong = "Use 100 characters or fewer."

    static func label(_ field: SignInField) -> String {
        switch field {
        case .firstName: "First name"
        case .lastName: "Last name"
        case .email: "Email"
        case .password: "Password"
        case .code: "6-digit code"
        case .newPassword: "New password"
        }
    }

    static func continueWith(_ provider: SignInProvider) -> String {
        switch provider {
        case .apple: "Continue with Apple"
        case .google: "Continue with Google"
        case .github: "Continue with GitHub"
        case .discord: "Continue with Discord"
        }
    }

    /// `{name}` → the business's name, `{email}` → where a code went.
    static func fill(_ template: String, _ values: [String: String]) -> String {
        values.reduce(template) { $0.replacingOccurrences(of: "{\($1.key)}", with: $1.value) }
    }
}

/// What's wrong with one box (`validateSignInField`), and which box BD's own
/// answers belong under.
enum SignInChecks {
    static let minPasswordLength = 10
    static let maxPasswordLength = 256
    static let maxEmailLength = 320
    static let maxNameLength = 100
    /// Local part @ domain . TLD (≥ 2) — the rule the SDK's email fields use.
    private static let emailPattern = #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#

    /// Lengths as JavaScript counts them (UTF-16), so both sides agree.
    private static func length(_ text: String) -> Int { text.utf16.count }

    static func problem(_ field: SignInField, _ value: String, step: SignInStep) -> String? {
        switch field {
        case .firstName, .lastName:
            return length(value.trimmingCharacters(in: .whitespacesAndNewlines)) > maxNameLength ? SignInWords.nameTooLong : nil
        case .email:
            let email = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if email.isEmpty { return SignInWords.enterEmail }
            if length(email) > maxEmailLength || email.range(of: emailPattern, options: .regularExpression) == nil {
                return SignInWords.invalidEmail
            }
            return nil
        case .password:
            if step == .signIn {
                if value.isEmpty { return SignInWords.enterPassword }
                return length(value) > maxPasswordLength ? SignInWords.passwordTooLong : nil
            }
            return newPasswordProblem(value)
        case .newPassword:
            return newPasswordProblem(value)
        case .code:
            return value.range(of: #"^\d{6}$"#, options: .regularExpression) == nil ? SignInWords.enterCode : nil
        }
    }

    private static func newPasswordProblem(_ value: String) -> String? {
        if length(value) < minPasswordLength { return SignInWords.passwordTooShort }
        if length(value) > maxPasswordLength { return SignInWords.passwordTooLong }
        return nil
    }

    /// BD's answers that are about one box go under that box.
    static func field(forCode code: String, among shown: [SignInField]) -> SignInField? {
        func pick(_ candidates: SignInField...) -> SignInField? { candidates.first(where: shown.contains) }
        switch code {
        case "weak_password", "password_too_short": return pick(.newPassword, .password)
        case "invalid_code", "code_expired": return pick(.code)
        case "invalid_email": return pick(.email)
        default: return nil
        }
    }
}

/// A business's two colours as the screen uses them (`signInPalette`): the
/// button keeps the primary as set, with readable text on it; links use the
/// secondary (the primary when there's none), nudged only as far as it takes
/// to read at 4.5:1 on a light and on a dark page.
struct SignInPalette: Equatable, Sendable {
    let accent: String
    let onAccent: String
    let link: String
    let linkDark: String
    let ring: String
    let ringDark: String

    private static let lightSurface = "#ffffff"
    private static let darkSurface = "#111827"

    init?(primary: String?, secondary: String?) {
        guard let accent = Self.normalize(primary) else { return nil }
        let linkBase = Self.normalize(secondary) ?? accent
        self.accent = accent
        onAccent = Self.contrast(accent, "#ffffff") >= Self.contrast(accent, "#111827") ? "#ffffff" : "#111827"
        link = Self.legible(linkBase, on: Self.lightSurface, min: 4.5)
        linkDark = Self.legible(linkBase, on: Self.darkSurface, min: 4.5)
        ring = Self.legible(accent, on: Self.lightSurface, min: 3)
        ringDark = Self.legible(accent, on: Self.darkSurface, min: 3)
    }

    /// The CSS variables the SDK screen's stylesheet reads.
    var style: String {
        [
            "--bd-sign-in-accent:\(accent)",
            "--bd-sign-in-on-accent:\(onAccent)",
            "--bd-sign-in-link:\(link)",
            "--bd-sign-in-link-dark:\(linkDark)",
            "--bd-sign-in-ring-light:\(ring)",
            "--bd-sign-in-ring-dark:\(ringDark)",
        ].joined(separator: ";")
    }

    /// `#abc` / `#AABBCC` → `#aabbcc`; anything else → nil.
    static func normalize(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let color = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let hex = Set("0123456789abcdef")
        guard color.hasPrefix("#"), color.dropFirst().allSatisfy(hex.contains) else { return nil }
        let digits = Array(color.dropFirst())
        if digits.count == 6 { return color }
        if digits.count == 3 { return "#" + digits.map { "\($0)\($0)" }.joined() }
        return nil
    }

    private static func channels(_ hex: String) -> [Double] {
        let digits = Array(hex.dropFirst())
        return stride(from: 0, to: 6, by: 2).map { Double(Int(String(digits[$0...$0 + 1]), radix: 16) ?? 0) }
    }

    private static func luminance(_ hex: String) -> Double {
        let lin = channels(hex).map { value -> Double in
            let c = value / 255
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    }

    /// WCAG contrast ratio of two `#rrggbb` colours (1–21).
    static func contrast(_ a: String, _ b: String) -> Double {
        let la = luminance(a), lb = luminance(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
    }

    private static func mix(_ hex: String, toward: String, _ t: Double) -> String {
        let from = channels(hex), to = channels(toward)
        let out = zip(from, to).map { pair -> String in
            let value = Int((pair.0 + (pair.1 - pair.0) * t).rounded())
            let text = String(value, radix: 16)
            return text.count == 1 ? "0" + text : text
        }
        return "#" + out.joined()
    }

    /// Darkened (light surface) or lightened (dark one) just enough to read.
    private static func legible(_ hex: String, on surface: String, min: Double) -> String {
        let toward = luminance(surface) > 0.5 ? "#000000" : "#ffffff"
        for step in 0...40 {
            let candidate = mix(hex, toward: toward, Double(step) / 40)
            if contrast(candidate, surface) >= min { return candidate }
        }
        return toward
    }
}
