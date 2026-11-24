package app.bd.forms

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.headersOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.test.runTest

/** A form slug is one path segment, whatever is in it (encodeURIComponent). */
class FormsBackendPathTest {
    @Test fun aSlashInTheSlugStaysInOneSegment() = runTest {
        val seen = mutableListOf<HttpRequestData>()
        val backend = BdPackageFormsBackend(
            "pk_test_123",
            host = "https://bd.test",
            engine = MockEngine { req ->
                seen.add(req)
                respond("""{"slots":[]}""", headers = headersOf(HttpHeaders.ContentType, "application/json"))
            },
        )
        backend.scheduleSlots("team/intake", "when", 0, 1)
        assertEquals("/api/package/v1/forms/team%2Fintake/schedule-slots", seen.single().url.encodedPath)
    }
}
