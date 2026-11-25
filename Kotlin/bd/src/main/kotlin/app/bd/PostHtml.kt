package app.bd

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import kotlin.math.roundToInt

/**
 * A blog post's HTML made safe, and the small things every post shows.
 *
 * ## Why the post body is rebuilt, not trusted
 *
 * A post's `content` is HTML written in the BusinessDash editor, and the API
 * returns it as it was saved. [safe] reads the HTML and writes out only the
 * tags and attributes on the lists below, with every value escaped again;
 * everything else becomes text. It is the web starters' `safePostHtml`
 * (`src/shop/blog.ts`) line for line, and `post-html-parity.json` in the
 * tests holds the cases every starter's port must answer the same way.
 *
 * The app never shows this HTML as a web page: [PostBlocks] reads it into
 * native pieces. Cleaning it first means the reader only ever sees
 * well-nested, allowlisted tags.
 */
public object PostHtml {
    private val allowedTags = setOf(
        "a", "abbr", "b", "blockquote", "br", "caption", "code", "del", "div", "em",
        "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
        "ins", "kbd", "li", "mark", "ol", "p", "pre", "s", "small", "span", "strong",
        "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    )
    private val voidTags = setOf("br", "hr", "img")

    /** Tags whose whole content goes, not only the tag. */
    private val droppedWithContent = setOf(
        "script", "style", "iframe", "object", "embed", "template", "noscript", "textarea", "select",
    )
    private val allowedAttributes = mapOf(
        "*" to setOf("title", "id", "class"),
        "a" to setOf("href"),
        "img" to setOf("src", "alt", "width", "height", "loading"),
        "td" to setOf("colspan", "rowspan"),
        "th" to setOf("colspan", "rowspan", "scope"),
        "ol" to setOf("start"),
    )
    private val urlAttributes = setOf("href", "src")

    // JavaScript's \s, which the web starters' patterns use; Java's \s is
    // ASCII only.
    private const val SPACE = "\\t\\n\\u000B\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
    private val attribute = Regex("([^$SPACE\"'>/=]+)(?:[$SPACE]*=[$SPACE]*(?:\"([^\"]*)\"|'([^']*)'|([^$SPACE\"'>]+)))?")
    private val bareAmpersand = Regex("&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)")
    private val lazyLoading = Regex("[$SPACE]loading=")
    private val words = Regex("[$SPACE]+")
    private val webHref = Regex("^https?:", RegexOption.IGNORE_CASE)

    /** Make a post's HTML safe (see the note at the top). */
    public fun safe(html: String): String {
        val out = StringBuilder()
        val open = ArrayList<String>()
        var i = 0
        var dropping: String? = null
        while (i < html.length) {
            val lt = html.indexOf('<', i)
            if (lt == -1) {
                if (dropping == null) out.append(escapeText(html.substring(i)))
                break
            }
            if (dropping == null) out.append(escapeText(html.substring(i, lt)))
            if (html.startsWith("<!--", lt)) {
                val end = html.indexOf("-->", lt + 4)
                i = if (end == -1) html.length else end + 3
                continue
            }
            val tag = readTag(html, lt)
            if (tag == null) {
                if (dropping == null) out.append("&lt;")
                i = lt + 1
                continue
            }
            i = tag.end
            val name = tag.name.lowercase()
            if (dropping != null) {
                if (tag.closing && name == dropping) dropping = null
                continue
            }
            if (name in droppedWithContent) {
                if (!tag.closing && !html.startsWith("/>", tag.end - 2)) dropping = name
                continue
            }
            if (name !in allowedTags) continue
            if (tag.closing) {
                val at = open.lastIndexOf(name)
                if (at == -1) continue
                // Close anything left open inside it, so the nesting stays whole.
                while (open.size > at) out.append("</").append(open.removeAt(open.size - 1)).append('>')
                continue
            }
            val allowed = allowedAttributes[name]
            val attributes = StringBuilder()
            var external = false
            for (match in attribute.findAll(tag.attributes)) {
                val key = match.groupValues[1].lowercase()
                if (key !in allowedAttributes.getValue("*") && allowed?.contains(key) != true) continue
                var value = match.groups[2]?.value ?: match.groups[3]?.value ?: match.groups[4]?.value ?: ""
                if (key in urlAttributes) {
                    value = safeUrl(value) ?: continue
                    if (key == "href" && webHref.containsMatchIn(value)) external = true
                }
                attributes.append(' ').append(key).append("=\"").append(escapeAttribute(value)).append('"')
            }
            if (name == "a" && external) attributes.append(" target=\"_blank\" rel=\"noopener noreferrer nofollow\"")
            if (name == "img" && !lazyLoading.containsMatchIn(attributes)) attributes.append(" loading=\"lazy\"")
            out.append('<').append(name).append(attributes).append('>')
            if (name !in voidTags) open.add(name)
        }
        while (open.isNotEmpty()) out.append("</").append(open.removeAt(open.size - 1)).append('>')
        return out.toString()
    }

    /** Minutes to read a post: its words at 230 a minute, at least one. */
    public fun readingMinutes(html: String?): Int {
        val count = (html ?: "").replace(Regex("<[^>]*>"), " ").trim().split(words).count { it.isNotEmpty() }
        return maxOf(1, (count / 230.0).roundToInt())
    }

    /** "November 18, 2026" (in UTC), or "" without a date. */
    public fun date(iso: String?): String = formatDate(iso, short = false)

    private val months = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    )

    internal fun formatDate(iso: String?, short: Boolean): String {
        if (iso.isNullOrBlank()) return ""
        val day = parseUtc(iso.trim()) ?: return ""
        val month = months[day.monthValue - 1].let { if (short) it.take(3) else it }
        return "$month ${day.dayOfMonth}, ${day.year}"
    }

    /** An ISO 8601 date or time, in UTC. A time without an offset is taken as UTC. */
    private fun parseUtc(value: String): ZonedDateTime? =
        runCatching { Instant.parse(value).atZone(ZoneOffset.UTC) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(value).atZoneSameInstant(ZoneOffset.UTC) }.getOrNull()
            ?: runCatching { LocalDateTime.parse(value).atZone(ZoneOffset.UTC) }.getOrNull()
            ?: runCatching { LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC) }.getOrNull()

    private class Tag(val name: String, val closing: Boolean, val attributes: String, val end: Int)

    /**
     * The tag starting at [start] (a '<'), as the web starters' pattern
     * reads it: `</?name`, then anything up to '>', where a quoted value may
     * hold a '>'. Null when it isn't one, e.g. `a < b` or an unclosed quote.
     * Scanned by hand: Java's regex engine recurses on that pattern, and a
     * long tag could overflow the stack.
     */
    private fun readTag(html: String, start: Int): Tag? {
        var i = start + 1
        val closing = i < html.length && html[i] == '/'
        if (closing) i++
        val nameStart = i
        if (i >= html.length || !html[i].isAsciiLetter()) return null
        while (i < html.length && (html[i].isAsciiLetter() || html[i] in '0'..'9')) i++
        val name = html.substring(nameStart, i)
        // \b: the name must not run on into a word character.
        if (i < html.length && html[i] == '_') return null
        val attributesStart = i
        while (i < html.length) {
            when (html[i]) {
                '>' -> return Tag(name, closing, html.substring(attributesStart, i), i + 1)
                '"', '\'' -> {
                    val close = html.indexOf(html[i], i + 1)
                    if (close == -1) return null
                    i = close + 1
                }
                else -> i++
            }
        }
        return null
    }

    private fun Char.isAsciiLetter(): Boolean = this in 'a'..'z' || this in 'A'..'Z'

    private fun escapeText(value: String): String =
        // An entity already in the text (&amp; &#8217;) stays one.
        value.replace(bareAmpersand, "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    private fun escapeAttribute(value: String): String = escapeText(value).replace("\"", "&quot;")

    private fun fromCode(digits: String, radix: Int): String {
        val code = digits.toIntOrNull(radix) ?: 0
        // Out of range or a lone surrogate: the replacement character.
        if (code <= 0 || code > 0x10ffff || code in 0xd800..0xdfff) return "�"
        return String(Character.toChars(code))
    }

    private fun decodeEntities(value: String): String = value
        .replace(Regex("&#x([0-9a-f]+);?", RegexOption.IGNORE_CASE)) { fromCode(it.groupValues[1], 16) }
        .replace(Regex("&#([0-9]+);?")) { fromCode(it.groupValues[1], 10) }
        .replace(Regex("&colon;", RegexOption.IGNORE_CASE), ":")
        .replace(Regex("&tab;", RegexOption.IGNORE_CASE), "\t")
        .replace(Regex("&newline;", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("&amp;", RegexOption.IGNORE_CASE), "&")

    private val controlAndSpace = Regex("[\\u0000- \\u007f-\\u009f]")
    private val safeScheme = Regex("^(https?:|mailto:|tel:)", RegexOption.IGNORE_CASE)
    private val anyScheme = Regex("^[a-z][a-z0-9+.-]*:", RegexOption.IGNORE_CASE)

    /** http(s), mailto, tel, a path on the website, or a #fragment. */
    private fun safeUrl(raw: String): String? {
        // Browsers ignore control characters and whitespace inside a scheme
        // ("java\nscript:"), so they are removed before the check.
        val value = decodeEntities(raw).replace(controlAndSpace, "")
        if (safeScheme.containsMatchIn(value)) return raw.trim()
        if (anyScheme.containsMatchIn(value)) return null
        if (value.startsWith("//")) return null
        return raw.trim()
    }
}
