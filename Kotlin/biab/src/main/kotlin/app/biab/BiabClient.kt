package app.biab

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * Transport for the BIAB Package API.
 *
 * ## The token rule
 *
 * A mobile app **holds its credential in the artifact** — `strings` on an APK
 * finds anything you ship. So this takes a **publishable `pk_…` token** and
 * `require`s that you didn't hand it an `sk_…` key.
 *
 * That is barely limiting: the publishable scope set covers the entire
 * customer-facing surface — storefront, cart, checkout, blog, marketing
 * content, chat, forms, **the whole customer portal**, sign-in, and public
 * custom-object reads. Only operator/admin writes need a secret key, and a
 * customer app never makes those. If you need one, put it behind a server you
 * control and point the app at that.
 *
 * ## What it does not leave to callers
 *
 * The **access gate**. A read against a lapsed plan answers HTTP **200** with
 * `available: false` in the BODY — reads use a body-only signal so a cached
 * CDN response can't hard-fail a page. A client that only checks the status
 * code decodes an empty screen and never notices, so [decode] inspects the
 * body first.
 */
public class BiabClient(
    host: String,
    publishableKey: String,
    public val siteId: String,
    engine: HttpClientEngine? = null,
) {
    init {
        require(!publishableKey.startsWith("sk_")) {
            "BiabClient was given a SECRET key. A mobile app ships its " +
                "credential inside the binary, where `strings` finds it — use " +
                "a publishable pk_ token instead, and route anything that " +
                "genuinely needs a secret key through a server you control."
        }
    }

    // `@PublishedApi internal` rather than `private`: the request helpers
    // below are `inline` (they need `reified T` to decode), and a public
    // inline function cannot touch a private member. Marking them keeps the
    // inlining legal without widening the real public API.
    @PublishedApi internal val baseUrl: String = host.trimEnd('/') + "/api/package/v1"
    @PublishedApi internal val apiKey: String = publishableKey

    @PublishedApi internal val json: Json = Json {
        // The platform adds fields between releases; refusing to decode
        // because of one is how an app breaks on somebody else's deploy.
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    @PublishedApi internal val http: HttpClient = HttpClient(engine ?: OkHttp.create()) {
        expectSuccess = false
        install(ContentNegotiation) { json(this@BiabClient.json) }
    }

    /** Path prefix for every site-scoped route. */
    public fun sitePath(suffix: String): String = "sites/$siteId/$suffix"

    public suspend inline fun <reified T> get(
        path: String,
        query: Map<String, String?> = emptyMap(),
        headers: Map<String, String> = emptyMap(),
    ): T = send(HttpMethod.Get, path, query, null, headers)

    public suspend inline fun <reified T> post(
        path: String,
        body: Any? = null,
        headers: Map<String, String> = emptyMap(),
    ): T = send(HttpMethod.Post, path, emptyMap(), body, headers)

    public suspend inline fun <reified T> patch(
        path: String,
        body: Any,
        headers: Map<String, String> = emptyMap(),
    ): T = send(HttpMethod.Patch, path, emptyMap(), body, headers)

    public suspend inline fun <reified T> delete(
        path: String,
        headers: Map<String, String> = emptyMap(),
    ): T = send(HttpMethod.Delete, path, emptyMap(), null, headers)

    @PublishedApi
    internal suspend inline fun <reified T> send(
        method: HttpMethod,
        path: String,
        query: Map<String, String?>,
        body: Any?,
        headers: Map<String, String>,
    ): T {
        val response = try {
            http.request("$baseUrl/$path") {
                this.method = method
                header("Authorization", "Bearer $apiKey")
                header("Accept", "application/json")
                headers.forEach { (name, value) -> header(name, value) }

                // Nulls are dropped rather than sent as empty — the platform
                // treats an absent `search` differently from an empty one.
                query.forEach { (key, value) -> if (value != null) parameter(key, value) }

                if (body != null) {
                    contentType(ContentType.Application.Json)
                    setBody(body)
                }
            }
        } catch (error: Throwable) {
            throw BiabTransportException(error)
        }

        return decode(response, path)
    }

    @PublishedApi
    internal suspend inline fun <reified T> decode(response: HttpResponse, path: String): T {
        val text = response.bodyAsText()

        // Checked BEFORE the status code, deliberately.
        runCatching { json.decodeFromString<AccessGateBody>(text) }
            .getOrNull()
            ?.takeIf { !it.available }
            ?.let { gate ->
                throw BiabAccessRejectedException(
                    reason = AccessRejectionReason.parse(gate.reason),
                    upgradeUrl = gate.upgradeUrl,
                    message = gate.message,
                )
            }

        if (response.status.value >= 300) {
            val message = runCatching { json.decodeFromString<ErrorBody>(text) }.getOrNull()?.message
            throw BiabHttpException(response.status.value, path, message)
        }

        return try {
            json.decodeFromString<T>(text)
        } catch (error: Throwable) {
            throw BiabDecodingException(path, error)
        }
    }

    public fun close(): Unit = http.close()
}
