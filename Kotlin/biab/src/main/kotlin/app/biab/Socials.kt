package app.biab

/**
 * One resolved social profile: which platform, what to call it, and where it
 * points once the org's raw value has been turned into a real URL.
 */
public data class SocialProfile(
    val key: String,
    val label: String,
    /** A simple-icons slug, or null for platforms with no icon in that set. */
    val iconSlug: String?,
    val url: String,
)

private val ABSOLUTE = Regex("^(https?://|mailto:|tel:)", RegexOption.IGNORE_CASE)

/**
 * Resolve one stored value into a real URL.
 *
 * Orgs type these by hand, so the same field arrives as
 * `https://instagram.com/acme`, `acme`, `@acme` or `instagram.com/acme`:
 *
 *  - anything already absolute (`http`, `https`, `mailto:`, `tel:`) is left
 *    alone — the org meant that link;
 *  - a known platform prefixes its handle, dropping a leading `@`;
 *  - anything else is assumed to be a bare domain and gets `https://`.
 */
public fun socialHref(value: String, platform: SocialPlatform): String {
    val v = value.trim()
    if (ABSOLUTE.containsMatchIn(v)) return v
    val prefix = platform.hrefPrefix
    if (prefix != null) return prefix + v.removePrefix("@")
    return "https://" + v.trimStart('/')
}

/**
 * Case-insensitive platform lookup — these keys come from stored JSON, where
 * `twitterX`, `twitterx` and `TWITTERX` are all plausible.
 */
public fun socialPlatformFor(key: String): SocialPlatform? {
    val needle = key.lowercase()
    return SOCIAL_PLATFORMS.firstOrNull { it.key.lowercase() == needle }
}

/**
 * Turn a company profile's `socials` map into a render-ready list.
 *
 * There is no endpoint for this — social handles arrive on the branding /
 * page bundle as a plain map, and every consumer has to do the same three
 * things with them: drop the empties, work out the real URL, and put them in a
 * stable order. Doing that in a composable is how an app ends up launching
 * `https://@acme` and reshuffling its social row whenever an unrelated field
 * is edited.
 *
 * Returned in the platform table's canonical order. Empty values and unknown
 * keys are dropped; the first value wins if a platform somehow appears twice.
 */
public fun resolveSocialProfiles(socials: Map<String, String?>?): List<SocialProfile> {
    if (socials == null) return emptyList()

    val present = LinkedHashMap<String, String>()
    for ((rawKey, rawValue) in socials) {
        val value = rawValue?.trim().orEmpty()
        if (value.isEmpty()) continue
        val platform = socialPlatformFor(rawKey) ?: continue
        if (present.containsKey(platform.key)) continue
        present[platform.key] = value
    }

    return SOCIAL_PLATFORMS.mapNotNull { platform ->
        val value = present[platform.key] ?: return@mapNotNull null
        SocialProfile(
            key = platform.key,
            label = platform.label,
            iconSlug = platform.iconSlug,
            url = socialHref(value, platform),
        )
    }
}
