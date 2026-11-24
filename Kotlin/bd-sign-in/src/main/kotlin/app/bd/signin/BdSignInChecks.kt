package app.bd.signin

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/** The boxes the sign-in screen can show. */
public enum class BdSignInBox { FirstName, LastName, Email, Password, Code, NewPassword }

/**
 * What's wrong with one box, or null — the same rules as `<BdSignIn>` on the
 * web, Swift `BdSignInChecks` and BD's own `auth/customer/` routes. The screen
 * runs them when the person leaves a box they've typed in, and for every box
 * when they press the button; BD checks again on its side.
 */
public object BdSignInChecks {
    /** A new password's minimum length — BD's rule. */
    public const val MIN_PASSWORD_LENGTH: Int = 10
    public const val MAX_PASSWORD_LENGTH: Int = 256
    public const val MAX_EMAIL_LENGTH: Int = 320
    public const val MAX_NAME_LENGTH: Int = 100

    /** Local part @ domain . TLD (≥ 2) — the rule BD's forms use for email. */
    private val emailPattern = Regex("""^[^\s@]+@[^\s@]+\.[^\s@]{2,}$""")

    /**
     * @param newPassword the password box is choosing one (a new account), not
     *   just signing in — BD's minimum applies.
     */
    public fun problem(
        box: BdSignInBox,
        value: String,
        newPassword: Boolean,
        strings: BdSignInStrings = BdSignInStrings(),
    ): String? = when (box) {
        BdSignInBox.FirstName, BdSignInBox.LastName ->
            if (value.trim().length > MAX_NAME_LENGTH) strings.nameTooLong else null
        BdSignInBox.Email -> {
            val email = value.trim()
            when {
                email.isEmpty() -> strings.enterEmail
                email.length > MAX_EMAIL_LENGTH || !emailPattern.matches(email) -> strings.invalidEmail
                else -> null
            }
        }
        BdSignInBox.Password -> if (newPassword) choosing(value, strings) else when {
            value.isEmpty() -> strings.enterPassword
            value.length > MAX_PASSWORD_LENGTH -> strings.passwordTooLong
            else -> null
        }
        BdSignInBox.NewPassword -> choosing(value, strings)
        BdSignInBox.Code ->
            if (value.length == 6 && value.all { it in '0'..'9' }) null else strings.enterCode
    }

    private fun choosing(value: String, strings: BdSignInStrings): String? = when {
        value.length < MIN_PASSWORD_LENGTH -> strings.passwordTooShort
        value.length > MAX_PASSWORD_LENGTH -> strings.passwordTooLong
        else -> null
    }

    /** BD's answers that are about one box, so they show under it. */
    internal fun boxFor(code: String, shown: List<BdSignInBox>): BdSignInBox? {
        val candidates = when (code) {
            "weak_password", "password_too_short" -> listOf(BdSignInBox.NewPassword, BdSignInBox.Password)
            "invalid_code", "code_expired" -> listOf(BdSignInBox.Code)
            "invalid_email" -> listOf(BdSignInBox.Email)
            else -> emptyList()
        }
        return candidates.firstOrNull { it in shown }
    }
}

/**
 * A business's two brand colours (Settings → Branding in BD) as the screen
 * uses them, as ARGB ints: the primary on the main button, exactly as set,
 * with black or white text — whichever reads; the secondary (else the
 * primary) on links, nudged only as far as it takes to read at 4.5:1 on a
 * light or dark screen.
 */
public data class BdSignInPalette(
    val accent: Int,
    val onAccent: Int,
    val linkLight: Int,
    val linkDark: Int,
) {
    public fun link(dark: Boolean): Int = if (dark) linkDark else linkLight

    public companion object {
        /** Null when [primary] isn't `#rrggbb` (or `#rgb`). */
        public fun from(primary: String?, secondary: String?): BdSignInPalette? {
            val accent = Rgb.parse(primary) ?: return null
            val linkBase = Rgb.parse(secondary) ?: accent
            return BdSignInPalette(
                accent = accent.argb,
                onAccent = (if (accent.contrast(Rgb.WHITE) >= accent.contrast(Rgb.INK)) Rgb.WHITE else Rgb.INK).argb,
                linkLight = linkBase.legible(Rgb.WHITE, 4.5).argb,
                linkDark = linkBase.legible(Rgb.INK, 4.5).argb,
            )
        }

        /** Black (near-black) or white text, whichever reads better on [argb]. */
        public fun foreground(argb: Int): Int {
            val c = Rgb((argb shr 16) and 0xff, (argb shr 8) and 0xff, argb and 0xff)
            return (if (c.contrast(Rgb.WHITE) >= c.contrast(Rgb.INK)) Rgb.WHITE else Rgb.INK).argb
        }
    }
}

/** An sRGB colour, 0…255 per channel. */
internal data class Rgb(val r: Int, val g: Int, val b: Int) {
    val argb: Int get() = (0xff shl 24) or (r shl 16) or (g shl 8) or b

    val luminance: Double
        get() {
            fun lin(c: Int): Double {
                val v = c / 255.0
                return if (v <= 0.03928) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4)
            }
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        }

    fun contrast(other: Rgb): Double {
        val a = luminance
        val b = other.luminance
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    private fun mixed(toward: Rgb, t: Double) = Rgb(
        (r + (toward.r - r) * t).roundToInt(),
        (g + (toward.g - g) * t).roundToInt(),
        (b + (toward.b - b) * t).roundToInt(),
    )

    /** Darkened (light surface) or lightened (dark one) just enough to read. */
    fun legible(surface: Rgb, minimum: Double): Rgb {
        val toward = if (surface.luminance > 0.5) BLACK else WHITE
        for (step in 0..40) {
            val candidate = mixed(toward, step / 40.0)
            if (candidate.contrast(surface) >= minimum) return candidate
        }
        return toward
    }

    companion object {
        val WHITE = Rgb(255, 255, 255)
        val BLACK = Rgb(0, 0, 0)
        /** Near-black text, and the dark screen links must read on (#111827). */
        val INK = Rgb(17, 24, 39)

        fun parse(hex: String?): Rgb? {
            var text = hex?.trim()?.lowercase() ?: return null
            if (!text.startsWith("#")) return null
            text = text.drop(1)
            if (text.length == 3) text = text.map { "$it$it" }.joinToString("")
            if (text.length != 6) return null
            val value = text.toIntOrNull(16) ?: return null
            return Rgb((value shr 16) and 0xff, (value shr 8) and 0xff, value and 0xff)
        }
    }
}
