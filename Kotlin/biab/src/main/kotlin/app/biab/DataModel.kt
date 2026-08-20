package app.biab

import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * The org's custom database — the metadata engine, not the store tables.
 *
 * ## Reads are the common case
 *
 * An app reads records: `records("projects")` pages through one collection,
 * `allRecords("projects")` follows the cursor for you. Both need the
 * `data_model:read` scope.
 *
 * ## Writes go through a DRAFT
 *
 * `plan()` computes what a schema change would do WITHOUT touching anything,
 * and `pushDraftSchema()` uploads it to the draft slot. **Neither applies it.**
 * Promotion stays a deliberate step in the dashboard, under Site Builder →
 * Site Data → Database.
 *
 * That split is the whole safety model: a mobile app should never be the thing
 * that drops a column from a live database, and a plan nobody read is how that
 * happens. Compute the plan, look at it, promote by hand.
 */
public class DataModelResource internal constructor(
    private val client: BiabClient,
    private val siteId: String,
) {
    private fun path(suffix: String): String =
        "sites/${siteId.encodeURLPathPart()}/data-model/$suffix"

    /** One page of records from a collection. */
    public suspend fun records(
        objectName: String,
        cursor: String? = null,
        limit: Int? = null,
    ): JsonElement = client.get(
        path("records"),
        mapOf(
            "object" to objectName,
            "cursor" to cursor,
            "limit" to limit?.toString(),
        ),
    )

    /**
     * Every record in a collection, following the cursor.
     *
     * Capped at 50 pages. An unbounded loop against a collection that keeps
     * growing is a way to hang a phone on a background refresh; if you hit the
     * cap you want explicit paging, not a bigger number here.
     */
    public suspend fun allRecords(objectName: String, pageLimit: Int = 50): List<JsonElement> {
        val all = mutableListOf<JsonElement>()
        var cursor: String? = null
        repeat(pageLimit) {
            val page = records(objectName, cursor)
            val obj = page as? JsonObject ?: return all
            (obj["records"] as? JsonArray)?.let(all::addAll)
            cursor = (obj["nextCursor"] as? JsonPrimitive)?.contentOrNull
            if (cursor == null) return all
        }
        return all
    }

    /** The live schema as the platform currently serves it. */
    public suspend fun live(): JsonElement = client.get(path("live"))

    /**
     * What WOULD change, without changing it.
     *
     * Read the returned plan before pushing: it names destructive and
     * exposure-class changes, which are exactly the ones you do not want to
     * discover after the fact.
     */
    public suspend fun plan(schema: JsonElement): JsonElement =
        client.post(path("plan"), mapOf("schema" to schema))

    /**
     * Upload a schema to the DRAFT slot.
     *
     * Does not apply it. Promote in the dashboard.
     */
    public suspend fun pushDraftSchema(schema: JsonElement): JsonElement =
        client.post(path("draft-schema"), mapOf("schema" to schema))
}

/** The org's custom database for [siteId]. */
public fun BiabClient.dataModel(siteId: String): DataModelResource =
    DataModelResource(this, siteId)
