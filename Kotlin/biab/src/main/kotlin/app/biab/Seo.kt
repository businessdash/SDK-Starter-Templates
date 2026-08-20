package app.biab

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

/** One tag for a document `<head>`. */
public data class HeadTag(
    val tag: String,
    val attributes: List<Pair<String, String>>,
    /** Text content — the title string, or a JSON-LD payload. */
    val children: String? = null,
)

/**
 * The org's per-page SEO, turned into head tags.
 *
 * The marketing page bundle carries a `seo` object for the page you asked for:
 * title, description, canonical, `noIndex`, Open Graph, Twitter card,
 * keywords, JSON-LD and hreflang. Reading four of those and forgetting the
 * rest is the normal failure, and the two people forget are `noIndex` and
 * `canonicalUrl` — exactly the two where being wrong is expensive and silent.
 *
 * An Android app mostly has no `<head>`. This matters anyway for a WebView
 * rendering org content, and for populating a share intent, where `ogTitle`
 * and `ogImageUrl` are the whole payload.
 *
 * Rules, matching the TypeScript `seo-core`:
 *
 *  - Open Graph falls back to the page's own title/description. A missing
 *    `og:title` renders a shared link as a bare URL.
 *  - A RELATIVE canonical is dropped rather than emitted: crawlers resolve it
 *    against whatever URL they fetched, so on a parameterised URL it points
 *    somewhere nobody intended. A missing canonical is recoverable; a wrong one
 *    consolidates ranking onto the wrong page.
 *  - `robots` is always emitted, both ways. Absence means "index", so relying
 *    on absence to express noindex is catastrophic.
 */
public object Seo {
    public fun headTags(seo: JsonObject?, baseUrl: String? = null): List<HeadTag> {
        if (seo == null) return emptyList()

        val title = text(seo["seoTitle"])
        val description = text(seo["seoDescription"])
        val canonical = absolute(text(seo["canonicalUrl"]), baseUrl)
        val noIndex = (seo["noIndex"] as? JsonPrimitive)?.booleanOrNull == true

        val ogTitle = text(seo["ogTitle"]) ?: title
        val ogDescription = text(seo["ogDescription"]) ?: description
        val ogImage = absolute(text(seo["ogImageUrl"]), baseUrl)

        val tags = mutableListOf<HeadTag>()
        title?.let { tags += HeadTag("title", emptyList(), it) }
        description?.let { tags += meta("name", "description", it) }
        (seo["keywords"] as? JsonArray)
            ?.mapNotNull { text(it) }
            ?.takeIf { it.isNotEmpty() }
            ?.let { tags += meta("name", "keywords", it.joinToString(", ")) }
        tags += meta("name", "robots", if (noIndex) "noindex, nofollow" else "index, follow")

        ogTitle?.let { tags += meta("property", "og:title", it) }
        ogDescription?.let { tags += meta("property", "og:description", it) }
        ogImage?.let { tags += meta("property", "og:image", it) }
        canonical?.let { tags += meta("property", "og:url", it) }
        tags += meta("property", "og:type", "website")

        tags += meta("name", "twitter:card", text(seo["twitterCard"]) ?: "summary_large_image")
        ogTitle?.let { tags += meta("name", "twitter:title", it) }
        ogDescription?.let { tags += meta("name", "twitter:description", it) }
        ogImage?.let { tags += meta("name", "twitter:image", it) }

        canonical?.let {
            tags += HeadTag("link", listOf("rel" to "canonical", "href" to it))
        }
        (seo["hreflang"] as? JsonObject)?.forEach { (lang, href) ->
            absolute(text(href), baseUrl)?.let {
                tags += HeadTag("link", listOf("rel" to "alternate", "hreflang" to lang, "href" to it))
            }
        }
        (seo["jsonldNodes"] as? JsonArray)?.forEach { node ->
            tags += HeadTag("script", listOf("type" to "application/ld+json"), node.toString())
        }
        return tags
    }

    /** Ready-to-inject HTML, for a WebView or a server-rendered template. */
    public fun render(seo: JsonObject?, baseUrl: String? = null): String =
        headTags(seo, baseUrl).joinToString("\n") { tag ->
            val attrs = tag.attributes.joinToString(" ") { (k, v) -> "$k=\"${escape(v)}\"" }
            when (tag.tag) {
                "title" -> "<title>${escape(tag.children.orEmpty())}</title>"
                // `<` is what closes the script early; escaping the whole
                // payload would corrupt the JSON instead.
                "script" -> "<script $attrs>${tag.children.orEmpty().replace("<", "\\u003c")}</script>"
                else -> "<${tag.tag} $attrs>"
            }
        }

    private fun meta(key: String, name: String, content: String) =
        HeadTag("meta", listOf(key to name, "content" to content))

    private fun text(value: JsonElement?): String? =
        (value as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }

    private fun absolute(url: String?, baseUrl: String?): String? {
        if (url == null) return null
        if (Regex("^([a-z][a-z0-9+.-]*:|//)", RegexOption.IGNORE_CASE).containsMatchIn(url)) return url
        // A relative canonical is worse than none — see the note above.
        if (baseUrl.isNullOrBlank()) return null
        val base = baseUrl.trimEnd('/')
        return if (url.startsWith("/")) base + url else "$base/$url"
    }

    private fun escape(value: String): String =
        value.replace("&", "&amp;").replace("\"", "&quot;")
            .replace("<", "&lt;").replace(">", "&gt;")
}
