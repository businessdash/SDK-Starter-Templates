package app.biab

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/**
 * Key-path reads for the two surfaces that genuinely can't be data classes,
 * because the org defines their shape in the dashboard: the **marketing
 * bundle** (whatever `biab.config.ts` declared) and **custom-database
 * records**.
 *
 * Everything else in this library is a real model — reaching for this on a
 * typed endpoint means the model is wrong, not that the endpoint is dynamic.
 */
public fun parseBundle(raw: String): JsonElement =
    Json { ignoreUnknownKeys = true }.parseToJsonElement(raw)

/**
 * Walk a key path.
 *
 * Returns null for a missing key AND for an empty string, because those mean
 * the same thing to a screen: show the local fallback. An author who cleared a
 * field wants the default back, not a blank heading.
 */
public fun JsonElement?.path(vararg keys: String): JsonElement? {
    var current: JsonElement? = this
    for (key in keys) {
        val obj = current as? JsonObject ?: return null
        current = obj[key]
    }
    val primitive = current as? JsonPrimitive
    if (primitive != null && primitive.isString && primitive.content.isEmpty()) return null
    return current
}

/** `bundle.string("sections", "hero", "headline") ?: "A business, in a box."` */
public fun JsonElement?.string(vararg keys: String): String? =
    (path(*keys) as? JsonPrimitive)?.takeIf { it.isString }?.jsonPrimitive?.content

/**
 * A relation on a custom-database record arrives as either a link object
 * carrying `id`, or a bare id string. Both shapes appear depending on how the
 * object was declared.
 */
public fun JsonElement?.relationId(key: String): String? {
    val value = path(key) ?: return null
    (value as? JsonObject)?.let { return it["id"].string() }
    return (value as? JsonPrimitive)?.takeIf { it.isString }?.content
}
