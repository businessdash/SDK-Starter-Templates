package app.bd.forms

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlinx.coroutines.test.runTest

/** The wire shape of [BdPackageFormsBackend], against a scripted Ktor engine. */
class PackageFormsBackendTest {
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")
    private val seen = mutableListOf<HttpRequestData>()

    private fun backend(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        BdPackageFormsBackend("pk_test_123", host = "https://bd.test/", engine = MockEngine { req -> seen.add(req); handler(req) })

    private fun bodyText(req: HttpRequestData): String = when (val b = req.body) {
        is TextContent -> b.text
        is OutgoingContent.ByteArrayContent -> b.bytes().decodeToString()
        else -> ""
    }

    @Test fun refusesASecretKey() {
        assertFailsWith<IllegalArgumentException> { BdPackageFormsBackend("sk_live_oops") }
    }

    @Test fun fetchesTheSchemaWithThePublishableKey() = runTest {
        val b = backend {
            respond("""{"id":"f","slug":"contact form","name":"Contact","fields":[{"id":"a","type":"text","label":"A"}]}""", headers = jsonHeaders)
        }
        val schema = b.schema("contact form")
        assertEquals("Contact", schema.title)
        assertEquals(1, schema.fields.size)
        val req = seen.single()
        // The slug is one path segment, encoded, under the apex /api/package/v1.
        assertEquals("https://bd.test/api/package/v1/forms/contact%20form", req.url.toString())
        assertEquals("Bearer pk_test_123", req.headers[HttpHeaders.Authorization])
        assertEquals("kotlin-forms/1", req.headers["X-BD-Client"])
    }

    @Test fun aMissingFormIsAnExceptionWithTheServersMessage() = runTest {
        val b = backend { respond("""{"message":"Form not found."}""", HttpStatusCode.NotFound, jsonHeaders) }
        val e = assertFailsWith<BdFormsException> { b.schema("nope") }
        assertEquals(404, e.status)
        assertEquals("Form not found.", e.message)
    }

    @Test fun submitsTheBodyAndReadsTheSubmissionId() = runTest {
        val b = backend { respond("""{"submissionId":"sub_9","dryRun":false}""", HttpStatusCode.Created, jsonHeaders) }
        val r = b.submit("contact", BdSubmission(mapOf("email" to BdJson.Str("a@b.co")), source = "android-app"))
        val ok = assertIs<BdSubmitSuccess>(r)
        assertEquals("sub_9", ok.submissionId)
        val req = seen.single()
        assertEquals(HttpMethod.Post, req.method)
        // Absent options are left out, not sent as null.
        assertEquals("""{"data":{"email":"a@b.co"},"source":"android-app"}""", bodyText(req))
    }

    @Test fun validationFailuresCarryTheirIssues() = runTest {
        val b = backend {
            respond(
                """{"error":"validation_failed","message":"Fix it","issues":[{"id":"email","label":"Email","reason":"format"}]}""",
                HttpStatusCode.UnprocessableEntity, jsonHeaders,
            )
        }
        val f = assertIs<BdSubmitFailure>(b.submit("contact", BdSubmission(emptyMap())))
        assertEquals(BdSubmitFailure.Reason.ValidationFailed, f.reason)
        assertEquals("Fix it", f.message)
        assertEquals("format", f.issues.single().reason)
    }

    @Test fun anUnreachableServerIsANetworkFailureNotAThrow() = runTest {
        val b = backend { throw java.io.IOException("offline") }
        val f = assertIs<BdSubmitFailure>(b.submit("contact", BdSubmission(emptyMap())))
        assertEquals(BdSubmitFailure.Reason.NetworkError, f.reason)
        assertEquals(0, f.status)
    }

    @Test fun uploadsThroughThePresignedUrlWithoutTheKey() = runTest {
        val b = backend { req ->
            if (req.url.host == "bd.test") {
                respond("""{"uploadUrl":"https://storage.test/put/1","storageId":"s1","publicUrl":"https://cdn.test/1"}""", headers = jsonHeaders)
            } else {
                respond("", HttpStatusCode.OK)
            }
        }
        val file = b.upload("contact", "docs", BdPickedFile("hello".encodeToByteArray(), "a.txt", "text/plain"))
        assertEquals("https://cdn.test/1", file.url)
        assertEquals(5L, file.size)
        val (presign, put) = seen
        assertEquals("https://bd.test/api/package/v1/forms/contact/upload-url", presign.url.toString())
        assertEquals("""{"fieldId":"docs","filename":"a.txt","contentType":"text/plain","sizeBytes":5}""", bodyText(presign))
        assertEquals(HttpMethod.Put, put.method)
        assertNull(put.headers[HttpHeaders.Authorization], "the presigned URL carries its own authorization")
        assertEquals("hello", bodyText(put))
    }

    @Test fun readsCollectionOptionsAndSlots() = runTest {
        val b = backend { req ->
            when (req.url.encodedPath.substringAfterLast('/')) {
                "collection-options" -> respond("""{"options":[{"value":"r1","label":"Gold","match":{"tier":"premium"}}]}""", headers = jsonHeaders)
                else -> respond("""{"slots":[{"startAt":"2026-11-24T15:00:00Z"}]}""", headers = jsonHeaders)
            }
        }
        assertEquals("premium", b.collectionOptions("contact", "plan").single().match?.get("tier"))
        assertEquals(listOf("2026-11-24T15:00:00Z"), b.scheduleSlots("contact", "when", 0, 86_400_000))
        assertEquals("plan", seen[0].url.parameters["fieldId"])
        assertEquals("1970-01-02T00:00:00.000Z", seen[1].url.parameters["to"])
    }
}
