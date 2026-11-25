package app.bd

/**
 * A post's body as native pieces — a heading, a paragraph, a list, a photo…
 * — for an app to draw with its own text and image composables. The HTML goes
 * through [PostHtml.safe] first, so what is read here is well nested and
 * holds only the allowlisted tags, and nothing in a post ever runs.
 *
 * Links keep web, mail and phone addresses only (a path on the website means
 * nothing in an app), and photos need a full http(s) address. The Swift,
 * React Native and Flutter starters read posts the same way.
 */
public object PostBlocks {
    /** A post's HTML as blocks. */
    public fun from(html: String?): List<PostBlock> = Reader().apply { read(PostHtml.safe(html ?: "")) }.blocks
}

/** A stretch of text with its inline styles. */
public data class PostRun(
    val text: String,
    val bold: Boolean = false,
    val italic: Boolean = false,
    val code: Boolean = false,
    val strike: Boolean = false,
    /** http(s), mailto: or tel: only. */
    val link: String? = null,
)

/** The text of runs, styles dropped. */
public fun List<PostRun>.plainText(): String = joinToString("") { it.text }

public data class PostListItem(
    /** "1.", "•" or "◦"; empty for a line that continues the item above. */
    val marker: String,
    val text: List<PostRun>,
    /** 0 for the outer list, 1 for a list inside it, … */
    val depth: Int,
)

public data class PostTableRow(
    val cells: List<List<PostRun>>,
    /** Every cell is a `<th>`, or the row is in `<thead>`. */
    val isHeader: Boolean,
)

public sealed interface PostBlock {
    public data class Heading(val level: Int, val text: List<PostRun>) : PostBlock
    public data class Paragraph(val text: List<PostRun>) : PostBlock
    public data class Quote(val text: List<PostRun>) : PostBlock
    public data class ItemList(val items: List<PostListItem>) : PostBlock
    public data class Code(val text: String) : PostBlock
    public data class Image(val url: String, val alt: String) : PostBlock

    /** A photo's caption (`<figcaption>`) or a table's (`<caption>`). */
    public data class Caption(val text: List<PostRun>) : PostBlock
    public data class Table(val rows: List<PostTableRow>) : PostBlock
    public data object Rule : PostBlock
}

private val TAG = Regex("<(/?)([a-z0-9]+)((?:\\s+[a-z-]+=\"[^\"]*\")*)\\s*/?>")
private val ATTRIBUTE = Regex("([a-z-]+)=\"([^\"]*)\"")
private val SPACE = Regex("[\\t\\n\\r\\f ]+")
private val ENTITY = Regex("&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});")
private val WEB_PHOTO = Regex("^https?://", RegexOption.IGNORE_CASE)
private val OPEN_LINK = Regex("^(https?://|mailto:|tel:)", RegexOption.IGNORE_CASE)
private val NAMED = mapOf(
    "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to " ",
    "lsquo" to "‘", "rsquo" to "’", "ldquo" to "“", "rdquo" to "”",
    "ndash" to "–", "mdash" to "—", "hellip" to "…", "middot" to "·",
    "bull" to "•", "copy" to "©", "reg" to "®", "trade" to "™",
    "times" to "×", "deg" to "°", "euro" to "€", "pound" to "£",
)

private class ListState(val ordered: Boolean, var next: Int)

private class Reader {
    val blocks = mutableListOf<PostBlock>()

    // The text being gathered, and the inline styles open around it.
    // Underline and highlight (<u>, <mark>) read as plain text.
    private var inline = mutableListOf<PostRun>()
    private var bold = 0
    private var italic = 0
    private var strike = 0
    private var code = 0
    private val links = mutableListOf<String?>()

    // Where the text goes when it's finished.
    private var heading: Int? = null
    private var quoteDepth = 0
    private var preDepth = 0
    private var inCaption = false
    private val lists = mutableListOf<ListState>()
    private var listItems = mutableListOf<PostListItem>()

    /** One marker per open `<li>`; "" once its first line is out. */
    private var items = mutableListOf<String>()
    private var tableRows: MutableList<PostTableRow>? = null
    private var row: MutableList<List<PostRun>>? = null
    private var rowIsHeader = true
    private var inHead = false

    fun read(html: String) {
        var at = 0
        for (match in TAG.findAll(html)) {
            if (match.range.first > at) text(html.substring(at, match.range.first))
            at = match.range.last + 1
            val name = match.groupValues[2]
            if (match.groupValues[1] == "/") close(name) else open(name, attributes(match.groupValues[3]))
        }
        if (at < html.length) text(html.substring(at))
        finishParagraph()
        finishList()
    }

    /**
     * A finished block. A list still being gathered goes out first, so a
     * photo inside a list item lands between its lines, not before them.
     */
    private fun emit(block: PostBlock) {
        if (listItems.isNotEmpty()) {
            blocks += PostBlock.ItemList(listItems)
            listItems = mutableListOf()
        }
        blocks += block
    }

    private fun open(name: String, attrs: Map<String, String>) {
        when (name) {
            "p", "div" -> if (items.isNotEmpty() || row != null) newLine() else finishParagraph()
            "h1", "h2", "h3", "h4", "h5", "h6" -> {
                finishParagraph()
                heading = name.substring(1).toIntOrNull() ?: 2
            }
            "blockquote" -> {
                finishParagraph()
                quoteDepth += 1
            }
            "pre" -> {
                finishParagraph()
                preDepth += 1
            }
            "ul", "ol" -> {
                // A list inside an item: the item's text so far is its first line.
                finishParagraph()
                val start = attrs["start"]?.toIntOrNull()
                lists += ListState(ordered = name == "ol", next = if (start == null || start == 0) 1 else start)
            }
            "li" -> {
                finishParagraph()
                val list = lists.lastOrNull() ?: return
                if (list.ordered) {
                    items += "${list.next}."
                    list.next += 1
                } else {
                    items += if (lists.size == 1) "•" else "◦"
                }
            }
            "table" -> {
                finishParagraph()
                tableRows = mutableListOf()
            }
            "thead" -> inHead = true
            "tr" -> {
                row = mutableListOf()
                rowIsHeader = true
            }
            "td", "th" -> {
                inline = mutableListOf()
                if (name == "td") rowIsHeader = false
            }
            "caption", "figcaption" -> {
                finishParagraph()
                inCaption = true
            }
            "img" -> {
                finishParagraph()
                val src = attrs["src"].orEmpty()
                if (WEB_PHOTO.containsMatchIn(src)) emit(PostBlock.Image(src, attrs["alt"].orEmpty()))
            }
            "hr" -> {
                finishParagraph()
                emit(PostBlock.Rule)
            }
            "br" -> newLine()
            "b", "strong" -> bold += 1
            "i", "em" -> italic += 1
            "s", "del" -> strike += 1
            "code", "kbd" -> code += 1
            "a" -> links += linkUrl(attrs["href"])
            // abbr, span, small, sub, sup, tbody, tfoot, figure: no styling of their own.
            else -> Unit
        }
    }

    private fun close(name: String) {
        when (name) {
            "p", "div" -> if (items.isEmpty() && row == null) finishParagraph()
            "h1", "h2", "h3", "h4", "h5", "h6" -> {
                finishParagraph()
                heading = null
            }
            "blockquote" -> {
                finishParagraph()
                if (quoteDepth > 0) quoteDepth -= 1
            }
            "pre" -> {
                val text = inline.plainText()
                inline = mutableListOf()
                if (text.isNotBlank()) emit(PostBlock.Code(text.trim('\n')))
                if (preDepth > 0) preDepth -= 1
            }
            "li" -> {
                finishParagraph()
                if (items.isNotEmpty()) items.removeAt(items.size - 1)
            }
            "ul", "ol" -> {
                finishParagraph()
                if (lists.isNotEmpty()) lists.removeAt(lists.size - 1)
                if (lists.isEmpty()) finishList()
            }
            "td", "th" -> {
                row?.add(trimmed(inline))
                inline = mutableListOf()
            }
            "tr" -> {
                val cells = row
                if (!cells.isNullOrEmpty()) tableRows?.add(PostTableRow(cells, isHeader = inHead || rowIsHeader))
                row = null
            }
            "thead" -> inHead = false
            "table" -> {
                val rows = tableRows
                if (!rows.isNullOrEmpty()) emit(PostBlock.Table(rows))
                tableRows = null
            }
            "caption", "figcaption" -> {
                finishParagraph()
                inCaption = false
            }
            "b", "strong" -> if (bold > 0) bold -= 1
            "i", "em" -> if (italic > 0) italic -= 1
            "s", "del" -> if (strike > 0) strike -= 1
            "code", "kbd" -> if (code > 0) code -= 1
            "a" -> if (links.isNotEmpty()) links.removeAt(links.size - 1)
            else -> Unit
        }
    }

    private fun text(raw: String) {
        var value = decodeReferences(raw)
        if (preDepth == 0) {
            value = value.replace(SPACE, " ")
            // Spaces collapse, as in a browser: none at the start of a line.
            val last = inline.plainText().lastOrNull()
            if (last == null || last == ' ' || last == '\n') value = value.trimStart(' ')
        }
        if (value.isEmpty()) return
        inline += PostRun(
            text = value,
            bold = bold > 0,
            italic = italic > 0,
            code = code > 0 && preDepth == 0,
            strike = strike > 0,
            link = links.lastOrNull { it != null },
        )
    }

    private fun newLine() {
        val gathered = inline.plainText()
        if (gathered.isNotEmpty() && !gathered.endsWith('\n')) inline += PostRun("\n")
    }

    /**
     * Send the text gathered so far where it belongs: a list line, a
     * caption, a heading, a quote or a paragraph.
     */
    private fun finishParagraph() {
        val text = trimmed(inline)
        inline = mutableListOf()
        if (text.plainText().isEmpty()) return
        val level = heading
        when {
            lists.isNotEmpty() -> {
                // In an item (or loose in the list): one line, marked the first time.
                listItems += PostListItem(items.lastOrNull().orEmpty(), text, lists.size - 1)
                if (items.isNotEmpty()) items[items.size - 1] = ""
            }
            inCaption -> emit(PostBlock.Caption(text))
            level != null -> emit(PostBlock.Heading(level, text))
            quoteDepth > 0 -> emit(PostBlock.Quote(text))
            else -> emit(PostBlock.Paragraph(text))
        }
    }

    private fun finishList() {
        items = mutableListOf()
        if (listItems.isNotEmpty()) blocks += PostBlock.ItemList(listItems)
        listItems = mutableListOf()
    }
}

/** Runs without spaces or line breaks at either end. */
private fun trimmed(runs: List<PostRun>): List<PostRun> {
    val out = runs.toMutableList()
    while (out.isNotEmpty()) {
        val text = out.first().text.trimStart(' ', '\n')
        if (text.isNotEmpty()) {
            out[0] = out.first().copy(text = text)
            break
        }
        out.removeAt(0)
    }
    while (out.isNotEmpty()) {
        val text = out.last().text.trimEnd(' ', '\n')
        if (text.isNotEmpty()) {
            out[out.size - 1] = out.last().copy(text = text)
            break
        }
        out.removeAt(out.size - 1)
    }
    return out
}

/**
 * Web, mail and phone links open from the app; a path or a #fragment of the
 * website would go nowhere, so its text stays plain.
 */
private fun linkUrl(href: String?): String? =
    href?.takeIf { it.isNotEmpty() && OPEN_LINK.containsMatchIn(it) }

private fun attributes(raw: String): Map<String, String> =
    ATTRIBUTE.findAll(raw).associate { it.groupValues[1] to decodeReferences(it.groupValues[2]) }

/**
 * Character references: numeric ones, and the named ones posts use. An
 * unknown name stays as written.
 */
internal fun decodeReferences(value: String): String {
    if ('&' !in value) return value
    return ENTITY.replace(value) { match ->
        val body = match.groupValues[1]
        if (body.startsWith('#')) {
            val hex = body.length > 1 && (body[1] == 'x' || body[1] == 'X')
            val code = (if (hex) body.substring(2) else body.substring(1)).toIntOrNull(if (hex) 16 else 10) ?: 0
            if (code <= 0 || code > 0x10ffff || code in 0xd800..0xdfff) "�" else String(Character.toChars(code))
        } else {
            NAMED[body] ?: match.value
        }
    }
}
