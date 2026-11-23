package app.bd.forms.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import java.time.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The renderer's pure logic: what the controls write and how stored HTML reads back. */
class RendererLogicTest {
    // Rich text: the editor's markup and the HTML BD keeps.

    @Test fun paragraphsAndInlineFormattingBecomeBdHtml() {
        assertEquals(
            "<p>Hello <strong>bold</strong> and <em>soft</em> and <s>gone</s></p><p>Second</p>",
            BdRichText.html("Hello **bold** and *soft* and ~~gone~~\nSecond"),
        )
    }

    @Test fun listsGroupConsecutiveItems() {
        assertEquals(
            "<p>Intro</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>",
            BdRichText.html("Intro\n• one\n- two\n1. first\n2. second"),
        )
    }

    @Test fun blankLinesSurviveButTrailingOnesDont() {
        assertEquals("<p>a</p><p><br></p><p>b</p>", BdRichText.html("a\n\nb\n\n"))
        assertEquals("", BdRichText.html("  \n "))
    }

    @Test fun typedMarkupIsEscapedNotInjected() {
        assertEquals("<p>&lt;script&gt;x&lt;/script&gt; &amp; 2*3*4</p>", BdRichText.html("<script>x</script> & 2*3*4"))
    }

    @Test fun storedHtmlRoundTripsThroughTheEditor() {
        val html = "<p>Hello <strong>bold</strong> <em>soft</em></p><p><br></p><ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>"
        val markup = BdRichText.markup(html)
        assertEquals("Hello **bold** *soft*\n\n• one\n• two\n1. a", markup)
        assertEquals(html, BdRichText.html(markup))
    }

    @Test fun wrapPutsMarkersAroundTheSelectionAndTakesThemOff() {
        val wrapped = BdRichText.wrap(TextFieldValue("make bold", TextRange(5, 9)), "**")
        assertEquals("make **bold**", wrapped.text)
        assertEquals(TextRange(7, 11), wrapped.selection)
        val unwrapped = BdRichText.wrap(wrapped, "**")
        assertEquals("make bold", unwrapped.text)
        val caret = BdRichText.wrap(TextFieldValue("ab", TextRange(1)), "*")
        assertEquals("a**b", caret.text)
        assertEquals(TextRange(2), caret.selection)
    }

    @Test fun pressingAFormatButtonAgainTurnsItOff() {
        // Before typing: the empty pair comes back out.
        val empty = BdRichText.wrap(TextFieldValue("a ****", TextRange(4)), "**")
        assertEquals("a ", empty.text)
        assertEquals(TextRange(2), empty.selection)
        // After typing: the caret steps past the closing marker.
        val typed = BdRichText.wrap(TextFieldValue("make **bold**", TextRange(11)), "**")
        assertEquals("make **bold**", typed.text)
        assertEquals(TextRange(13), typed.selection)
        // Italic's single star doesn't mistake bold's double star for its own.
        val italic = BdRichText.wrap(TextFieldValue("**bold**", TextRange(6)), "*")
        assertEquals("**bold****", italic.text)
        // Before the opening marker of a later run, it starts a new pair.
        val opening = BdRichText.wrap(TextFieldValue("x **y**", TextRange(2)), "**")
        assertEquals("x ******y**", opening.text)
        assertEquals(TextRange(4), opening.selection)
    }

    @Test fun listToggleAddsSwitchesAndRemovesTheMarker() {
        val bullet = BdRichText.toggleList(TextFieldValue("one\ntwo", TextRange(5)), ordered = false)
        assertEquals("one\n• two", bullet.text)
        val numbered = BdRichText.toggleList(bullet, ordered = true)
        assertEquals("one\n1. two", numbered.text)
        assertEquals("one\ntwo", BdRichText.toggleList(numbered, ordered = true).text)
        // Numbering continues from the line above.
        val next = BdRichText.toggleList(TextFieldValue("1. a\nb", TextRange(6)), ordered = true)
        assertEquals("1. a\n2. b", next.text)
    }

    // Reading richtext content.

    @Test fun htmlReadsAsStyledTextWithSafeLinksOnly() {
        val text = BdHtml.annotated(
            "<p>Hi <strong>there</strong> &amp; <a href=\"https://bd.test\">visit</a> <a href=\"javascript:alert(1)\">bad</a></p><ul><li>one</li><li>two</li></ul>",
            Color.Blue,
            Color.Gray,
        )
        assertEquals("Hi there & visit bad\n\n• one\n• two", text.text)
        val links = text.getLinkAnnotations(0, text.length)
        assertEquals(1, links.size)
        assertEquals("https://bd.test", (links.single().item as LinkAnnotation.Url).url)
        assertTrue(text.spanStyles.any { it.item.fontWeight == FontWeight.Bold && text.text.substring(it.start, it.end) == "there" })
    }

    @Test fun aStrayAngleBracketIsTextNotAHang() {
        assertEquals("a < b", BdHtml.annotated("a < b", Color.Blue, Color.Gray).text)
    }

    @Test fun entitiesDecode() {
        assertEquals("“Fish” & chips — 5 > 3 ©", BdHtml.decodeEntities("&ldquo;Fish&rdquo; &amp; chips &mdash; 5 &gt; 3 &#169;"))
        assertEquals("&unknown; &#xZZ;", BdHtml.decodeEntities("&unknown; &#xZZ;"))
    }

    @Test fun onlyWebMailAndPhoneLinksAreSafe() {
        assertEquals("mailto:a@b.co", BdHtml.safeLink(" mailto:a@b.co "))
        assertEquals("tel:+15550100", BdHtml.safeLink("tel:+15550100"))
        assertNull(BdHtml.safeLink("javascript:alert(1)"))
        assertNull(BdHtml.safeLink("intent://scan/#Intent;end"))
        assertNull(BdHtml.safeLink("not a url"))
    }

    // Numbers typed as text.

    @Test fun numericEntryKeepsPartialInputAndFiltersTheRest() {
        assertEquals("-12.5", BdNumeric.sanitize("-12.5", allowDecimal = true, allowNegative = true))
        // A comma is a decimal point; a second point is dropped.
        assertEquals("12.57", BdNumeric.sanitize("1a2,5.7", allowDecimal = true, allowNegative = false))
        assertEquals("125", BdNumeric.sanitize("1-2.5", allowDecimal = false, allowNegative = true))
        assertEquals("12", BdNumeric.sanitize("-12", allowDecimal = true, allowNegative = false))
        // Typing after the seeded 0 replaces it.
        assertEquals("40", BdNumeric.sanitize("040", allowDecimal = true, allowNegative = true))
        assertEquals("-7", BdNumeric.sanitize("-007", allowDecimal = true, allowNegative = true))
        assertEquals("0.5", BdNumeric.sanitize("0.5", allowDecimal = true, allowNegative = true))
        assertEquals("0", BdNumeric.sanitize("00", allowDecimal = true, allowNegative = true))
        assertNull(BdNumeric.parse("-"))
        assertNull(BdNumeric.parse("-."))
        assertEquals(1.0, BdNumeric.parse("1."))
        assertEquals("", BdNumeric.format(null))
        assertEquals("1.5", BdNumeric.format(1.5))
        assertEquals("3", BdNumeric.format(3.0))
    }

    // Colors and times.

    @Test fun hexColorsParseAndNormalize() {
        assertEquals(Color(0x33, 0x66, 0x99), BdColor.parse("#369"))
        assertEquals("#3B82F6", BdColor.normalize("3b82f6"))
        assertNull(BdColor.parse("#12345"))
        assertEquals(Color.White, BdColor.contrasting(Color(0x1E, 0x29, 0x3B)))
        assertEquals(Color.Black, BdColor.contrasting(Color(0xFA, 0xCC, 0x15)))
    }

    @Test fun timesReadAndWriteAsHoursAndMinutes() {
        assertEquals(LocalTime.of(9, 5), BdDateText.time("09:05"))
        assertEquals(LocalTime.of(23, 59), BdDateText.time("23:59:30"))
        assertNull(BdDateText.time("24:00"))
        assertNull(BdDateText.time("9"))
        assertEquals("07:30", BdDateText.hhmm(LocalTime.of(7, 30)))
        assertEquals("2026-11-20", BdDateText.date("2026-11-20T10:00:00Z").toString())
        assertNull(BdDateText.date(""))
    }

    // Icons: Lucide SVG as served by /api/icons.

    @Test fun lucideSvgBecomesStrokedPaths() {
        val svg = """<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-life-buoy"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><rect width="5" height="7" x="16" y="14" rx="1"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707z"/></svg>"""
        val v = BdSvg.vector("life-buoy", svg)
        val paths = (0 until v.root.size).map { v.root[it] }.filterIsInstance<androidx.compose.ui.graphics.vector.VectorPath>()
        assertEquals(5, paths.size)
        assertTrue(paths.all { it.pathData.isNotEmpty() && it.stroke != null && it.strokeLineWidth == 2f })
    }

    @Test fun autofillTokensPickTheKeyboard() {
        assertEquals(BdKeyboard.Email, keyboardFor("email"))
        assertEquals(BdKeyboard.Phone, keyboardFor("tel"))
        assertEquals(BdKeyboard.Words, keyboardFor("given-name"))
        assertEquals(BdKeyboard.Text, keyboardFor(null))
    }
}
