import Testing
@testable import BdSignIn

struct BdSignInChecksTests {
    @Test func emailNeedsAFullAddress() {
        #expect(BdSignInChecks.problem(.email, "", newPassword: false) == "Enter your email.")
        #expect(BdSignInChecks.problem(.email, "ada@example", newPassword: false)
            == "Enter a full email address, like name@example.com.")
        #expect(BdSignInChecks.problem(.email, " ada@example.com ", newPassword: false) == nil)
    }

    @Test func signingInNeedsAPasswordChoosingOneNeedsTen() {
        #expect(BdSignInChecks.problem(.password, "short", newPassword: false) == nil)
        #expect(BdSignInChecks.problem(.password, "", newPassword: false) == "Enter your password.")
        #expect(BdSignInChecks.problem(.password, "short", newPassword: true)
            == "Use at least 10 characters for your password.")
        #expect(BdSignInChecks.problem(.newPassword, String(repeating: "x", count: 257), newPassword: true)
            == "Use 256 characters or fewer for your password.")
    }

    @Test func namesAreOptionalCodesAreSixDigits() {
        #expect(BdSignInChecks.problem(.firstName, "", newPassword: true) == nil)
        #expect(BdSignInChecks.problem(.lastName, String(repeating: "x", count: 101), newPassword: true)
            == "Use 100 characters or fewer.")
        #expect(BdSignInChecks.problem(.code, "12345", newPassword: false) != nil)
        #expect(BdSignInChecks.problem(.code, "123456", newPassword: false) == nil)
    }

    @Test func bdsAnswersAboutABoxLandUnderIt() {
        let wrong = BdSignInError(code: "invalid_code", message: "That code isn't right.")
        #expect(BdSignInChecks.box(for: wrong, among: [.code, .newPassword]) == .code)
        let weak = BdSignInError(code: "weak_password", message: "Too weak.")
        #expect(BdSignInChecks.box(for: weak, among: [.email, .password]) == .password)
        let other = BdSignInError(code: "invalid_credentials", message: "No match.")
        #expect(BdSignInChecks.box(for: other, among: [.email, .password]) == nil)
    }

    @Test func paletteKeepsThePrimaryAndMakesLinksRead() throws {
        #expect(BdSignInPalette(primary: "blue", secondary: nil) == nil)
        let palette = try #require(BdSignInPalette(primary: "#1D4ED8", secondary: "#16a34a"))
        #expect(palette.onAccent == .white)
        let light = try #require(RGB(hex: "#fde047"))
        #expect(light.contrast(with: .white) < 4.5)
        #expect(light.legible(on: .white, minimum: 4.5).contrast(with: .white) >= 4.5)
        // A colour that already reads is used exactly.
        let green = try #require(RGB(hex: "#16a34a"))
        #expect(green.legible(on: .darkSurface, minimum: 4.5) == green)
    }
}
