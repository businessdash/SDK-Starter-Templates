package app.bd.signin

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BdSignInChecksTest {
    @Test
    fun emailNeedsAFullAddress() {
        assertEquals("Enter your email.", BdSignInChecks.problem(BdSignInBox.Email, "", newPassword = false))
        assertEquals(
            "Enter a full email address, like name@example.com.",
            BdSignInChecks.problem(BdSignInBox.Email, "ada@example", newPassword = false),
        )
        assertNull(BdSignInChecks.problem(BdSignInBox.Email, " ada@example.com ", newPassword = false))
    }

    @Test
    fun signingInNeedsAPasswordChoosingOneNeedsTen() {
        assertNull(BdSignInChecks.problem(BdSignInBox.Password, "short", newPassword = false))
        assertEquals("Enter your password.", BdSignInChecks.problem(BdSignInBox.Password, "", newPassword = false))
        assertEquals(
            "Use at least 10 characters for your password.",
            BdSignInChecks.problem(BdSignInBox.Password, "short", newPassword = true),
        )
        assertEquals(
            "Use 256 characters or fewer for your password.",
            BdSignInChecks.problem(BdSignInBox.NewPassword, "x".repeat(257), newPassword = true),
        )
    }

    @Test
    fun codeIsSixDigitsAndNamesHaveACap() {
        assertNull(BdSignInChecks.problem(BdSignInBox.Code, "123456", newPassword = false))
        assertNotNull(BdSignInChecks.problem(BdSignInBox.Code, "12345a", newPassword = false))
        assertNotNull(BdSignInChecks.problem(BdSignInBox.FirstName, "a".repeat(101), newPassword = false))
        assertNull(BdSignInChecks.problem(BdSignInBox.FirstName, "", newPassword = false))
    }

    @Test
    fun bdsAnswersLandOnTheirBox() {
        val reset = listOf(BdSignInBox.Code, BdSignInBox.NewPassword)
        assertEquals(BdSignInBox.NewPassword, BdSignInChecks.boxFor("weak_password", reset))
        assertEquals(BdSignInBox.Code, BdSignInChecks.boxFor("code_expired", reset))
        assertNull(BdSignInChecks.boxFor("invalid_credentials", reset))
    }

    @Test
    fun paletteKeepsThePrimaryAndMakesLinksRead() {
        val palette = assertNotNull(BdSignInPalette.from("#facc15", null))
        // The button is the brand's own yellow, with dark text on it.
        assertEquals(0xfffacc15.toInt(), palette.accent)
        assertEquals(Rgb.INK.argb, palette.onAccent)
        // The link is darkened until it reads on white; on dark it already does.
        val onWhite = Rgb((palette.linkLight shr 16) and 0xff, (palette.linkLight shr 8) and 0xff, palette.linkLight and 0xff)
        assertTrue(onWhite.contrast(Rgb.WHITE) >= 4.5)
        assertEquals(0xfffacc15.toInt(), palette.linkDark)
        assertNull(BdSignInPalette.from("blue", "#000000"))
        // A secondary colours the links.
        assertEquals(0xff1d4ed8.toInt(), assertNotNull(BdSignInPalette.from("#111827", "#1d4ed8")).linkLight)
    }
}
