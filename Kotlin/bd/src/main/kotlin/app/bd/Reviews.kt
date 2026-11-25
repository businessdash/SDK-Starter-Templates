package app.bd

import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

/**
 * The rules for showing and writing reviews of the business, the same in
 * every BD starter (the web starters' `src/reviews.ts`):
 *
 * - the summary's average and total come from the page bundle's `reviews`
 *   block, and each star's bar from its `counts`;
 * - a platform review links out only over http(s), and a review written in
 *   the app (`other`) has no platform to link to;
 * - a written review needs 1 to 5 stars and some words, up to 5,000
 *   characters; a title over 200 characters is cut, not refused.
 */
public object Reviews {
    public const val PAGE_SIZE: Int = 10
    public const val MAX_LENGTH: Int = 5000
    public const val MAX_TITLE_LENGTH: Int = 200

    /** What a customer reads once their review is sent. */
    public const val SENT: String = "Thanks! Your review shows once it's approved."

    /** The platforms a review can come from, in the order filters show them. */
    public val SOURCES: List<String> = listOf("google", "yelp", "housecall_pro", "other")

    private val platforms = mapOf("google" to "Google", "yelp" to "Yelp", "housecall_pro" to "Housecall Pro")

    /** The average, the total and a bar per star, 5 down to 1. */
    public fun summarize(totals: ReviewTotals?, fallbackTotal: Int = 0): ReviewSummary {
        val byStars = mutableMapOf<Int, Int>()
        for (row in totals?.counts.orEmpty()) {
            if (row.rating in 1..5 && row.count > 0) byStars[row.rating] = (byStars[row.rating] ?: 0) + row.count
        }
        val counted = byStars.values.sum()
        return ReviewSummary(
            average = totals?.rating?.takeIf { it.isFinite() },
            total = totals?.totalCount ?: if (counted > 0) counted else fallbackTotal,
            histogram = (5 downTo 1).map { stars ->
                val count = byStars[stars] ?: 0
                StarBar(stars, count, if (counted > 0) count.toDouble() / counted else 0.0)
            },
        )
    }

    /** "Google", "Yelp", "Housecall Pro", or null for a review written here. */
    public fun platformName(source: String?): String? = platforms[source]

    /** A filter's label: the platform, or "Other". */
    public fun sourceLabel(source: String?): String = platformName(source) ?: "Other"

    /** The known platforms among [reviews], in the order first seen. */
    public fun sourcesIn(reviews: Iterable<Review>): List<String> =
        reviews.mapNotNull { it.source }.filter { it in SOURCES }.distinct()

    /** The review on its platform, when it has one and the address is http(s). */
    public fun link(review: Review): String? =
        if (platformName(review.source) == null) null else safeWebUrl(review.reviewUrl)

    /** [url] when it is an http(s) address with a host, else null. */
    public fun safeWebUrl(url: String?): String? {
        if (url.isNullOrEmpty()) return null
        val authority = WEB_URL.find(url)?.groupValues?.get(1) ?: return null
        val host = authority.substringAfterLast('@').substringBefore(':')
        return if (host.isNotEmpty()) url else null
    }

    public fun reviewerName(review: Review): String = review.reviewerName?.trim().orEmpty().ifEmpty { "Anonymous" }

    /** The first letter of the name, for an avatar without a photo. */
    public fun reviewerInitial(review: Review): String {
        val name = reviewerName(review)
        return String(Character.toChars(name.codePointAt(0))).uppercase()
    }

    /** "★★★★☆". */
    public fun stars(rating: Double): String {
        val full = rating.roundToInt().coerceIn(0, 5)
        return "★".repeat(full) + "☆".repeat(5 - full)
    }

    /** "Nov 20, 2026" (in UTC), or "" without a date. */
    public fun date(iso: String?): String = PostHtml.formatDate(iso, short = true)

    /** A review ready to send, or what to fix first. */
    public fun check(rating: Int, title: String? = null, body: String): ReviewCheck {
        if (rating !in 1..5) return ReviewCheck(error = "Choose a rating from 1 to 5 stars.")
        val text = body.trim()
        if (text.isEmpty()) return ReviewCheck(error = "Write a few words about your experience.")
        if (text.length > MAX_LENGTH) return ReviewCheck(error = "Reviews are up to 5,000 characters.")
        val heading = title?.trim().orEmpty().take(MAX_TITLE_LENGTH)
        return ReviewCheck(review = ReviewInput(rating, heading.ifEmpty { null }, text))
    }

    private val WEB_URL = Regex("^https?://([^/?#]*)", RegexOption.IGNORE_CASE)
}

public data class ReviewSummary(
    /** Null when there is no rating yet. */
    val average: Double?,
    val total: Int,
    /** 5 stars first. */
    val histogram: List<StarBar>,
)

/** One bar: how many reviews gave [stars], and their [share] of all counted (0 to 1). */
public data class StarBar(val stars: Int, val count: Int, val share: Double)

/** A review to post to `customer-portal/reviews`. A null title is left out. */
@Serializable
public data class ReviewInput(
    val rating: Int,
    val title: String? = null,
    val body: String,
)

public data class ReviewCheck(
    val review: ReviewInput? = null,
    val error: String? = null,
) {
    public val isOk: Boolean get() = review != null
}
