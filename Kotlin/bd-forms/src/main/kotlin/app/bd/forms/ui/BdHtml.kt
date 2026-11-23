package app.bd.forms.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em

/**
 * The small HTML dialect BD forms use, read into native text: `richtext`
 * content (server-sanitized) becomes an [AnnotatedString] that `Text` draws,
 * links included. The same reading as the Swift renderer's.
 */
internal object BdHtml {
    private val whitespace = Regex("\\s+")

    fun annotated(html: String, linkColor: Color, quoteColor: Color): AnnotatedString {
        val out = AnnotatedString.Builder()
        val plain = StringBuilder()
        var bold = 0
        var italic = 0
        var underline = 0
        var strike = 0
        var code = 0
        var heading: Int? = null
        val links = ArrayDeque<String?>()
        val lists = ArrayDeque<IntArray>() // [ordered 0/1, counter]
        var quote = 0
        var pendingBreak = false
        var atLineStart = true

        fun raw(s: String) {
            out.append(s)
            plain.append(s)
        }

        fun newline(count: Int = 1) {
            if (plain.isEmpty()) return
            // Never more than one blank line in a row.
            val have = if (plain.endsWith("\n\n")) 2 else if (plain.endsWith("\n")) 1 else 0
            if (count > have) raw("\n".repeat(count - have))
            atLineStart = true
        }

        fun emit(text: String) {
            val t = if (atLineStart) text.trimStart(' ') else text
            if (t.isEmpty()) return
            if (pendingBreak) {
                newline(2)
                pendingBreak = false
            }
            val decorations = listOfNotNull(
                TextDecoration.Underline.takeIf { underline > 0 },
                TextDecoration.LineThrough.takeIf { strike > 0 },
            )
            val style = SpanStyle(
                fontWeight = if (bold > 0 || heading != null) FontWeight.Bold else null,
                fontStyle = if (italic > 0 || quote > 0) FontStyle.Italic else null,
                fontFamily = if (code > 0) FontFamily.Monospace else null,
                textDecoration = if (decorations.isEmpty()) null else TextDecoration.combine(decorations),
                fontSize = heading?.let { if (it <= 1) 1.4.em else if (it == 2) 1.2.em else 1.05.em } ?: TextUnit.Unspecified,
                color = if (quote > 0) quoteColor else Color.Unspecified,
            )
            val url = links.lastOrNull()
            if (url != null) {
                val link = LinkAnnotation.Url(url, TextLinkStyles(SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)))
                out.withLink(link) { withStyle(style) { append(t) } }
            } else {
                out.withStyle(style) { append(t) }
            }
            plain.append(t)
            atLineStart = false
        }

        var i = 0
        while (i < html.length) {
            if (html[i] == '<') {
                val close = html.indexOf('>', i)
                if (close >= 0) {
                    val tag = html.substring(i + 1, close)
                    i = close + 1
                    if (tag.startsWith("!")) continue
                    val isEnd = tag.startsWith("/")
                    val body = if (isEnd) tag.drop(1) else tag
                    val name = body.takeWhile { it.isLetterOrDigit() }.lowercase()
                    when (name) {
                        "b", "strong" -> bold = if (isEnd) maxOf(0, bold - 1) else bold + 1
                        "i", "em" -> italic = if (isEnd) maxOf(0, italic - 1) else italic + 1
                        "u" -> underline = if (isEnd) maxOf(0, underline - 1) else underline + 1
                        "s", "strike", "del" -> strike = if (isEnd) maxOf(0, strike - 1) else strike + 1
                        "code" -> code = if (isEnd) maxOf(0, code - 1) else code + 1
                        "a" -> if (isEnd) links.removeLastOrNull() else links.addLast(attribute("href", body)?.let(::safeLink))
                        "br" -> {
                            newline()
                            pendingBreak = false
                        }
                        "p", "div", "pre" -> if (isEnd || plain.isNotEmpty()) pendingBreak = true
                        "h1", "h2", "h3", "h4", "h5", "h6" -> if (isEnd) {
                            heading = null
                            pendingBreak = true
                        } else {
                            if (plain.isNotEmpty()) pendingBreak = true
                            heading = name.drop(1).toInt()
                        }
                        "blockquote" -> if (isEnd) {
                            quote = maxOf(0, quote - 1)
                            pendingBreak = true
                        } else {
                            if (plain.isNotEmpty()) pendingBreak = true
                            quote++
                        }
                        "ul", "ol" -> if (isEnd) {
                            lists.removeLastOrNull()
                            if (lists.isEmpty()) pendingBreak = true
                        } else {
                            if (lists.isEmpty() && plain.isNotEmpty()) pendingBreak = true
                            lists.addLast(intArrayOf(if (name == "ol") 1 else 0, 0))
                        }
                        "li" -> if (!isEnd) {
                            if (pendingBreak) {
                                newline(2)
                                pendingBreak = false
                            } else {
                                newline()
                            }
                            val depth = maxOf(lists.size - 1, 0)
                            var marker = "•"
                            lists.lastOrNull()?.let { top ->
                                top[1]++
                                if (top[0] == 1) marker = "${top[1]}."
                            }
                            raw("    ".repeat(depth) + marker + " ")
                            atLineStart = true
                        }
                    }
                    continue
                }
            }
            // Text up to the next tag. A stray "<" with no ">" after it is text.
            val next = html.indexOf('<', if (html[i] == '<') i + 1 else i).let { if (it < 0) html.length else it }
            emit(decodeEntities(html.substring(i, next)).replace(whitespace, " "))
            i = next
        }
        val built = out.toAnnotatedString()
        return built.subSequence(0, built.text.trimEnd('\n').length)
    }

    fun attribute(name: String, tag: String): String? {
        val re = Regex("$name\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", RegexOption.IGNORE_CASE)
        val m = re.find(tag) ?: return null
        for (g in 2..4) m.groups[g]?.let { return decodeEntities(it.value) }
        return null
    }

    /** Only links a visitor can safely open: web, mail and phone. */
    fun safeLink(raw: String): String? {
        val s = raw.trim()
        val scheme = runCatching { java.net.URI(s).scheme }.getOrNull()?.lowercase() ?: return null
        return if (scheme in setOf("http", "https", "mailto", "tel")) s else null
    }

    private val named = mapOf(
        "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to "\u00A0",
        "mdash" to "—", "ndash" to "–", "hellip" to "…", "rsquo" to "’", "lsquo" to "‘",
        "rdquo" to "”", "ldquo" to "“", "copy" to "©", "reg" to "®", "trade" to "™", "bull" to "•",
    )

    fun decodeEntities(s: String): String {
        if ('&' !in s) return s
        val out = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            if (s[i] == '&') {
                val semi = s.indexOf(';', i).takeIf { it in (i + 1)..(i + 12) }
                if (semi != null) {
                    val name = s.substring(i + 1, semi)
                    val replacement = when {
                        name.startsWith("#x") || name.startsWith("#X") -> name.drop(2).toIntOrNull(16)?.let(::codePoint)
                        name.startsWith("#") -> name.drop(1).toIntOrNull()?.let(::codePoint)
                        else -> named[name]
                    }
                    if (replacement != null) {
                        out.append(replacement)
                        i = semi + 1
                        continue
                    }
                }
            }
            out.append(s[i])
            i++
        }
        return out.toString()
    }

    private fun codePoint(cp: Int): String? = if (Character.isValidCodePoint(cp)) String(Character.toChars(cp)) else null

    fun escape(s: String): String {
        val out = StringBuilder(s.length)
        for (c in s) {
            when (c) {
                '&' -> out.append("&amp;")
                '<' -> out.append("&lt;")
                '>' -> out.append("&gt;")
                '"' -> out.append("&quot;")
                else -> out.append(c)
            }
        }
        return out.toString()
    }
}

/**
 * The rich text editor's text: light markup ↔ the HTML BD keeps
 * (`p strong em s ul ol li br`), so a visitor's bold on Android is bold in
 * the BD dashboard and in every other renderer.
 *
 * One line is one paragraph; `• `, `- ` or `* ` starts a bullet, `1. ` a
 * numbered item; `**bold**`, `*italic*`, `~~struck~~` inline.
 */
internal object BdRichText {
    private val numbered = Regex("^(\\d+)\\. ")
    private val bulletPrefixes = listOf("• ", "- ", "* ")
    val BOLD = Regex("\\*\\*(?=\\S)(.+?)(?<=\\S)\\*\\*")
    val ITALIC = Regex("(?<![*\\w])\\*(?=[^\\s*])(.+?)(?<=[^\\s*])\\*(?![*\\w])")
    val STRIKE = Regex("~~(?=\\S)(.+?)(?<=\\S)~~")
    private val whitespace = Regex("\\s+")

    fun html(markup: String): String {
        if (markup.isBlank()) return ""
        val blocks = mutableListOf<String>()
        var open: String? = null
        fun closeList() {
            open?.let { blocks += "</$it>" }
            open = null
        }
        for (line in markup.split('\n')) {
            val bullet = bulletPrefixes.firstOrNull { line.startsWith(it) }
            val number = numbered.find(line)
            val (kind, body) = when {
                bullet != null -> "ul" to line.substring(bullet.length)
                number != null -> "ol" to line.substring(number.value.length)
                else -> "p" to line
            }
            val inner = inline(body)
            if (kind == "p") {
                closeList()
                blocks += if (inner.isEmpty()) "<p><br></p>" else "<p>$inner</p>"
            } else {
                if (open != kind) {
                    closeList()
                    blocks += "<$kind>"
                    open = kind
                }
                blocks += "<li>$inner</li>"
            }
        }
        closeList()
        // Drop trailing empty paragraphs.
        while (blocks.lastOrNull() == "<p><br></p>") blocks.removeAt(blocks.size - 1)
        return blocks.joinToString("")
    }

    private fun inline(text: String): String {
        var s = BdHtml.escape(text)
        s = BOLD.replace(s) { "<strong>${it.groupValues[1]}</strong>" }
        s = ITALIC.replace(s) { "<em>${it.groupValues[1]}</em>" }
        s = STRIKE.replace(s) { "<s>${it.groupValues[1]}</s>" }
        return s
    }

    /** Stored HTML as editable markup (to restore a draft or default). */
    fun markup(html: String): String {
        if (html.isBlank()) return ""
        val out = StringBuilder()
        val lists = ArrayDeque<IntArray>()
        fun lineBreak() {
            if (out.isNotEmpty() && !out.endsWith("\n")) out.append('\n')
        }
        var i = 0
        while (i < html.length) {
            if (html[i] == '<') {
                val close = html.indexOf('>', i)
                if (close >= 0) {
                    val tag = html.substring(i + 1, close)
                    i = close + 1
                    val isEnd = tag.startsWith("/")
                    when (val name = tag.removePrefix("/").takeWhile { it.isLetterOrDigit() }.lowercase()) {
                        "strong", "b" -> out.append("**")
                        "em", "i" -> out.append("*")
                        "s", "strike", "del" -> out.append("~~")
                        "br" -> out.append('\n')
                        "p", "div", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6" -> lineBreak()
                        "ul", "ol" -> {
                            lineBreak()
                            if (isEnd) lists.removeLastOrNull() else lists.addLast(intArrayOf(if (name == "ol") 1 else 0, 0))
                        }
                        "li" -> {
                            lineBreak()
                            if (!isEnd) {
                                val top = lists.lastOrNull()
                                if (top != null && top[0] == 1) {
                                    top[1]++
                                    out.append("${top[1]}. ")
                                } else {
                                    out.append("• ")
                                }
                            }
                        }
                    }
                    continue
                }
            }
            val next = html.indexOf('<', if (html[i] == '<') i + 1 else i).let { if (it < 0) html.length else it }
            var text = BdHtml.decodeEntities(html.substring(i, next)).replace(whitespace, " ")
            if (out.isEmpty() || out.endsWith("\n")) text = text.trimStart(' ')
            out.append(text)
            i = next
        }
        return out.toString().trim('\n')
    }

    /** Wrap the selection in [marker] (or unwrap it), or drop a pair at the caret. */
    fun wrap(v: TextFieldValue, marker: String): TextFieldValue {
        val s = v.selection.min
        val e = v.selection.max
        val text = v.text
        val m = marker.length
        if (s == e) {
            val c = marker[0]
            val before = run(text, s, c, forward = false)
            val after = run(text, s, c, forward = true)
            // Pressed again before typing anything: take the empty pair back out.
            if (before == m && after == m) return TextFieldValue(text.removeRange(s - m, s + m), TextRange(s - m))
            // Pressed again at the end of a formatted run: step past the
            // closing marker, so what's typed next is plain.
            if (after == m && openBefore(text, s, c, m)) return v.copy(selection = TextRange(s + m))
            return TextFieldValue(text.substring(0, s) + marker + marker + text.substring(s), TextRange(s + m))
        }
        if (s >= m && text.startsWith(marker, s - m) && text.startsWith(marker, e)) {
            val unwrapped = text.substring(0, s - m) + text.substring(s, e) + text.substring(e + m)
            return TextFieldValue(unwrapped, TextRange(s - m, e - m))
        }
        return TextFieldValue(text.substring(0, s) + marker + text.substring(s, e) + marker + text.substring(e), TextRange(s + m, e + m))
    }

    /** How many [c] in a row start at [at] (or end there, going back). */
    private fun run(text: String, at: Int, c: Char, forward: Boolean): Int {
        var n = 0
        if (forward) while (at + n < text.length && text[at + n] == c) n++
        else while (at - n - 1 >= 0 && text[at - n - 1] == c) n++
        return n
    }

    /** Whether the caret's line has an unclosed [m]-long run of [c] before [at]. */
    private fun openBefore(text: String, at: Int, c: Char, m: Int): Boolean {
        var i = if (at == 0) 0 else text.lastIndexOf('\n', at - 1) + 1
        var markers = 0
        while (i < at) {
            if (text[i] != c) {
                i++
                continue
            }
            var n = 0
            while (i + n < at && text[i + n] == c) n++
            if (n == m) markers++
            i += n
        }
        return markers % 2 == 1
    }

    /** Make the caret's line a list item, switch its kind, or make it a paragraph again. */
    fun toggleList(v: TextFieldValue, ordered: Boolean): TextFieldValue {
        var text = v.text
        val point = v.selection.min
        val start = if (point == 0) 0 else text.lastIndexOf('\n', point - 1) + 1
        val line = text.substring(start).substringBefore('\n')
        val bulletLen = bulletPrefixes.firstOrNull { line.startsWith(it) }?.length ?: 0
        val numberLen = numbered.find(line)?.value?.length ?: 0
        val existing = if (bulletLen > 0) bulletLen else numberLen
        var shift = 0
        if (existing > 0) {
            text = text.removeRange(start, start + existing)
            shift -= existing
            if ((numberLen > 0) == ordered) {
                return TextFieldValue(text, TextRange((v.selection.start + shift).coerceAtLeast(start), (v.selection.end + shift).coerceAtLeast(start)))
            }
        }
        var marker = "• "
        if (ordered) {
            // Continue the numbering of the line above.
            var n = 1
            if (start > 0) {
                val prevEnd = start - 1
                val prevStart = if (prevEnd == 0) 0 else text.lastIndexOf('\n', prevEnd - 1) + 1
                numbered.find(text.substring(prevStart, prevEnd))?.let { n = it.groupValues[1].toInt() + 1 }
            }
            marker = "$n. "
        }
        text = text.substring(0, start) + marker + text.substring(start)
        shift += marker.length
        return TextFieldValue(text, TextRange((v.selection.start + shift).coerceAtLeast(start + marker.length), (v.selection.end + shift).coerceAtLeast(start + marker.length)))
    }
}

/** Draws the editor's markup: bold bold, italic italic, markers dimmed. Same text, same offsets. */
internal data class BdMarkupHighlighter(val markerColor: Color) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val s = text.text
        val b = AnnotatedString.Builder(s)
        val dim = SpanStyle(color = markerColor)
        fun mark(re: Regex, marker: Int, style: SpanStyle) {
            for (m in re.findAll(s)) {
                val start = m.range.first
                val end = m.range.last + 1
                b.addStyle(style, start + marker, end - marker)
                b.addStyle(dim, start, start + marker)
                b.addStyle(dim, end - marker, end)
            }
        }
        mark(BdRichText.BOLD, 2, SpanStyle(fontWeight = FontWeight.Bold))
        mark(BdRichText.ITALIC, 1, SpanStyle(fontStyle = FontStyle.Italic))
        mark(BdRichText.STRIKE, 2, SpanStyle(textDecoration = TextDecoration.LineThrough))
        return TransformedText(b.toAnnotatedString(), OffsetMapping.Identity)
    }
}
