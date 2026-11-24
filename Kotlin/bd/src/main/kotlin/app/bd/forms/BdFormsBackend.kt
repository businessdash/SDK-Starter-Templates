package app.bd.forms

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.appendPathSegments
import io.ktor.http.content.ByteArrayContent
import io.ktor.http.content.TextContent
import io.ktor.http.isSuccess
import io.ktor.http.takeFrom
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.builtins.MapSerializer

/**
 * Where a form comes from and where it goes. The default is
 * [BdPackageFormsBackend] (BD's Package API with a publishable key), but an
 * app can supply its own (a proxy through its server, a test double, a form
 * bundled offline) without touching the renderer.
 */
public interface BdFormsBackend {
    public suspend fun schema(form: String): BdFormSchema
    public suspend fun submit(form: String, submission: BdSubmission): BdSubmitResult
    public suspend fun upload(form: String, fieldId: String, file: BdPickedFile): BdUploadedFile
    /** Open booking start times (ISO instants) between two epoch-ms times. */
    public suspend fun scheduleSlots(form: String, fieldId: String, fromMs: Long, toMs: Long): List<String>
    public suspend fun paymentIntent(form: String, fieldId: String): BdPaymentIntent
    public suspend fun collectionOptions(form: String, fieldId: String): List<BdCollectionOption>
}

/** What goes over the wire on submit. */
public data class BdSubmission(
    val data: Map<String, BdJson>,
    val submitterEmail: String? = null,
    val submitterName: String? = null,
    /** Validate server-side without saving, notifying, or running actions. */
    val dryRun: Boolean? = null,
    val source: String? = null,
    val referrer: String? = null,
    val metadata: Map<String, BdJson>? = null,
) {
    /** The request body. Absent options are left out, not sent as null. */
    public fun toJson(): BdJson {
        val o = LinkedHashMap<String, BdJson>()
        o["data"] = BdJson.Obj(data)
        submitterEmail?.let { o["submitterEmail"] = BdJson.Str(it) }
        submitterName?.let { o["submitterName"] = BdJson.Str(it) }
        dryRun?.let { o["dryRun"] = BdJson.Bool(it) }
        source?.let { o["source"] = BdJson.Str(it) }
        referrer?.let { o["referrer"] = BdJson.Str(it) }
        metadata?.let { o["metadata"] = BdJson.Obj(it) }
        return BdJson.Obj(o)
    }
}

/** A file the visitor picked, held in memory until submit uploads it. */
public class BdPickedFile(public val data: ByteArray, public val name: String, public val mimeType: String) {
    public val size: Long get() = data.size.toLong()
}

/** A file stored by BD: the value a `file_upload` field submits. */
@Serializable
public data class BdUploadedFile(
    val storageId: String,
    val url: String,
    val name: String,
    val mimeType: String,
    val size: Long,
) {
    internal val json: BdJson
        get() = BdJson.obj(
            "storageId" to BdJson.Str(storageId),
            "url" to BdJson.Str(url),
            "name" to BdJson.Str(name),
            "mimeType" to BdJson.Str(mimeType),
            "size" to BdJson.Num(size.toDouble()),
        )
}

@Serializable
public data class BdPaymentIntent(
    /** `card_on_file` (SetupIntent) or `deposit` (PaymentIntent). */
    val mode: String,
    val clientSecret: String,
    val intentId: String,
    /** The platform's Stripe publishable key. */
    val publishableKey: String,
    /** The org's connected account: initialize Stripe with it. */
    val connectedAccountId: String,
)

/** One live option of a `collection_select`: a record from the org's collection, with the columns its conditions compare. */
@Serializable
public data class BdCollectionOption(
    val value: String,
    val label: String,
    val image: String? = null,
    val match: Map<String, String>? = null,
) {
    val id: String get() = value
}

public data class BdFormIssue(
    val fieldId: String,
    val label: String,
    /** `required | type | format | min | max | options | regex | business_email | unknown_field | …` */
    val reason: String,
    val message: String = BdFormMessages.message(reason, label, null),
)

/** How a submit ended: [BdSubmitSuccess] or [BdSubmitFailure]. */
public sealed interface BdSubmitResult {
    public val isSuccess: Boolean get() = this is BdSubmitSuccess
}

public data class BdSubmitSuccess(
    val status: Int = 201,
    val submissionId: String?,
    val dryRun: Boolean = false,
    /** The whole response body, for anything the server adds. */
    val body: Map<String, BdJson> = emptyMap(),
) : BdSubmitResult

public data class BdSubmitFailure(
    val status: Int,
    val reason: Reason,
    val message: String,
    val issues: List<BdFormIssue> = emptyList(),
) : BdSubmitResult {
    public enum class Reason(public val wire: String) {
        ClientValidationFailed("client_validation_failed"),
        ValidationFailed("validation_failed"),
        Unauthorized("unauthorized"),
        Forbidden("forbidden"),
        PlanRequired("plan_required"),
        PaymentRequired("payment_required"),
        ServiceSuspended("service_suspended"),
        RateLimited("rate_limited"),
        NotFound("not_found"),
        InvalidRequest("invalid_request"),
        ServerError("server_error"),
        NetworkError("network_error"),
    }
}

/** A request BD refused, or one that never reached it (status 0). The message is fit to show. */
public class BdFormsException(public val status: Int = 0, message: String) : Exception(message)

// Package API

/**
 * BD's Package API, authenticated with a publishable (`pk_…`) key.
 *
 * A publishable key is meant to ship inside an app. A secret key is not, and
 * passing one fails construction rather than letting it ride along.
 *
 * @param host e.g. `https://businessdash.us` (`/api/package/v1` is appended).
 *   Use the apex host: `www` answers with a cross-host redirect, and OkHttp
 *   drops the `Authorization` header when it follows one.
 * @param engine a Ktor engine; OkHttp by default, a `MockEngine` in tests.
 */
public class BdPackageFormsBackend(
    publishableKey: String,
    host: String = "https://businessdash.us",
    engine: HttpClientEngine? = null,
) : BdFormsBackend {
    init {
        require(!publishableKey.startsWith("sk_")) { "BdForms: never ship a secret key in an app; use a pk_ key." }
    }

    public val baseUrl: String = host.trimEnd('/') + "/api/package/v1"
    private val publishableKey = publishableKey
    private val http = HttpClient(engine ?: OkHttp.create()) { expectSuccess = false }

    private suspend fun call(
        method: HttpMethod,
        form: String,
        suffix: String? = null,
        query: Map<String, String> = emptyMap(),
        json: BdJson? = null,
    ): HttpResponse = http.request {
        this.method = method
        url {
            takeFrom(baseUrl)
            // The slug is one segment, even with a "/" in it (encodeURIComponent).
            appendPathSegments("forms", form, encodeSlash = true)
            if (suffix != null) appendPathSegments(suffix)
        }
        query.forEach { (k, v) -> parameter(k, v) }
        header("Authorization", "Bearer $publishableKey")
        header("Accept", "application/json")
        header("X-BD-Client", "kotlin-forms/1")
        if (json != null) setBody(TextContent(json.toJsonString(), ContentType.Application.Json))
    }

    private suspend fun <T> decode(response: HttpResponse, strategy: DeserializationStrategy<T>): T {
        val text = response.bodyAsText()
        val status = response.status.value
        if (!response.status.isSuccess()) {
            val message = runCatching { BdJson.from(formsJson.parseToJsonElement(text))["message"]?.stringValue }.getOrNull()
            throw BdFormsException(status, message ?: "BD returned $status.")
        }
        return formsJson.decodeFromString(strategy, text)
    }

    /** Transport failures become a [BdFormsException] with status 0; cancellation passes through. */
    private suspend fun <T> guarded(block: suspend () -> T): T = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: BdFormsException) {
        throw e
    } catch (e: Exception) {
        throw BdFormsException(0, "Could not reach BD: ${e.message ?: e::class.simpleName}")
    }

    override suspend fun schema(form: String): BdFormSchema = guarded {
        val response = call(HttpMethod.Get, form)
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) {
            val message = runCatching { BdJson.from(formsJson.parseToJsonElement(text))["message"]?.stringValue }.getOrNull()
            throw BdFormsException(response.status.value, message ?: "BD returned ${response.status.value}.")
        }
        BdFormSchema.fromJson(text)
    }

    override suspend fun submit(form: String, submission: BdSubmission): BdSubmitResult {
        val response = try {
            call(HttpMethod.Post, form, json = submission.toJson())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return BdSubmitFailure(0, BdSubmitFailure.Reason.NetworkError, "Could not reach BD: ${e.message ?: e::class.simpleName}")
        }
        val status = response.status.value
        val json = runCatching { BdJson.from(formsJson.parseToJsonElement(response.bodyAsText())).objectValue }.getOrNull() ?: emptyMap()
        if (response.status.isSuccess()) {
            return BdSubmitSuccess(status, json["submissionId"]?.stringValue, json["dryRun"]?.boolValue ?: false, json)
        }
        return failure(status, json)
    }

    @Serializable private data class Presign(val uploadUrl: String, val storageId: String, val publicUrl: String)

    override suspend fun upload(form: String, fieldId: String, file: BdPickedFile): BdUploadedFile = guarded {
        val body = BdJson.obj(
            "fieldId" to BdJson.Str(fieldId),
            "filename" to BdJson.Str(file.name),
            "contentType" to BdJson.Str(file.mimeType),
            "sizeBytes" to BdJson.Num(file.size.toDouble()),
        )
        val presign = decode(call(HttpMethod.Post, form, "upload-url", json = body), Presign.serializer())
        val contentType = runCatching { ContentType.parse(file.mimeType) }.getOrDefault(ContentType.Application.OctetStream)
        // The presigned URL carries its own authorization: no bearer token.
        val put = http.request(presign.uploadUrl) {
            method = HttpMethod.Put
            setBody(ByteArrayContent(file.data, contentType))
        }
        if (!put.status.isSuccess()) {
            throw BdFormsException(put.status.value, "Uploading ${file.name} failed (${put.status.value}).")
        }
        BdUploadedFile(presign.storageId, presign.publicUrl, file.name, file.mimeType, file.size)
    }

    @Serializable private data class Slot(val startAt: String)

    @Serializable private data class Slots(val slots: List<Slot>)

    override suspend fun scheduleSlots(form: String, fieldId: String, fromMs: Long, toMs: Long): List<String> = guarded {
        val query = mapOf("fieldId" to fieldId, "from" to BdDates.isoString(fromMs), "to" to BdDates.isoString(toMs))
        decode(call(HttpMethod.Get, form, "schedule-slots", query), Slots.serializer()).slots.map { it.startAt }
    }

    override suspend fun paymentIntent(form: String, fieldId: String): BdPaymentIntent = guarded {
        decode(call(HttpMethod.Post, form, "payment-intent", json = BdJson.obj("fieldId" to BdJson.Str(fieldId))), BdPaymentIntent.serializer())
    }

    @Serializable private data class Options(val options: List<BdCollectionOption>)

    override suspend fun collectionOptions(form: String, fieldId: String): List<BdCollectionOption> = guarded {
        decode(call(HttpMethod.Get, form, "collection-options", mapOf("fieldId" to fieldId)), Options.serializer()).options
    }

    public companion object {
        /**
         * Map a non-2xx response the way the JS SDK does, so the same server
         * answer becomes the same reason in every language.
         */
        public fun failure(status: Int, body: Map<String, BdJson>): BdSubmitFailure {
            val message = body["message"]?.stringValue?.takeIf { it.isNotEmpty() } ?: "Submission failed ($status)."
            val code = body["error"]?.stringValue
            val gate = body["reason"]?.stringValue
            val issues = (body["issues"]?.arrayValue ?: emptyList()).map { raw ->
                val id = raw["id"]?.stringValue ?: raw["fieldId"]?.stringValue ?: ""
                val label = raw["label"]?.stringValue ?: id.ifEmpty { "field" }
                val reason = raw["reason"]?.stringValue ?: "type"
                BdFormIssue(id, label, reason, raw["message"]?.stringValue ?: BdFormMessages.message(reason, label, null))
            }
            val reason = when (status) {
                401 -> BdSubmitFailure.Reason.Unauthorized
                403 -> BdSubmitFailure.Reason.Forbidden
                402 -> when (gate) {
                    "payment_required" -> BdSubmitFailure.Reason.PaymentRequired
                    "service_suspended" -> BdSubmitFailure.Reason.ServiceSuspended
                    else -> BdSubmitFailure.Reason.PlanRequired
                }
                429 -> BdSubmitFailure.Reason.RateLimited
                404 -> BdSubmitFailure.Reason.NotFound
                400, 422 ->
                    if (code == "validation_failed" || issues.isNotEmpty()) BdSubmitFailure.Reason.ValidationFailed
                    else BdSubmitFailure.Reason.InvalidRequest
                else -> BdSubmitFailure.Reason.ServerError
            }
            return BdSubmitFailure(status, reason, message, issues)
        }
    }
}

// Messages

/**
 * What a visitor reads under a field. One function so every element says the
 * same thing for the same problem; an app rewords or localizes by giving the
 * controller its own `messages` function.
 */
public object BdFormMessages {
    public fun message(reason: String, label: String, field: BdFormField?): String {
        val name = label.ifEmpty { "This field" }
        return when (reason) {
            "required" -> when {
                field?.type == "boolean" && field.mustBeTrue == true -> "Please confirm to continue."
                field?.type == "or_condition" -> "Fill in at least one side to continue."
                field?.type == "multi_populator" -> "Add at least one entry."
                else -> "$name is required."
            }
            "business_email" -> "Please use your work email address."
            "regex" -> "$name isn't in the expected format."
            "options" -> "Choose one of the listed options."
            "unknown_field" -> "$name isn't part of this form."
            "range_order" -> "The end must come after the start."
            "range_same_day" -> "Choose an end date after the start date."
            "format" -> when (field?.type) {
                "email" -> "Enter a valid email address."
                "phone" -> "Enter a valid phone number."
                "url", "image_input" -> "Enter a valid web address, like example.com."
                "address" -> "Enter a 5-digit ZIP code."
                "month_year" -> "Choose a month and a year."
                "color_picker" -> "Enter a hex color, like #3366FF."
                "schedule" -> "Choose a valid time."
                "number", "measurement" -> "Enter a whole number."
                "currency" -> if (field.currencyConfig?.allowDecimal == false) "Enter a whole amount." else "Enter an amount of 0 or more."
                else -> "$name isn't valid."
            }
            "min" -> (field?.validation?.min ?: field?.sliderConfig?.min)?.let { "Enter ${BdJS.string(it)} or more." } ?: "Enter 0 or more."
            "max" -> {
                val max = field?.validation?.max ?: field?.sliderConfig?.max
                when {
                    max != null -> "Enter ${BdJS.string(max)} or less."
                    field?.type == "file_upload" -> {
                        val n = field.fileConfig?.maxFiles ?: 1
                        "Attach at most $n file${if (n == 1) "" else "s"}."
                    }
                    field?.type == "star_rating" -> "Choose up to ${field.starRatingConfig?.maxStars ?: 5} stars."
                    else -> "$name is too long."
                }
            }
            "type" -> "$name has an invalid value."
            else -> {
                // A repeater reports its child: "Age: max".
                val colon = reason.indexOf(':')
                if (colon >= 0) {
                    "${reason.substring(0, colon)}: ${message(reason.substring(colon + 1).trim(), "", null).lowercase()}"
                } else {
                    "$name isn't valid."
                }
            }
        }
    }
}
