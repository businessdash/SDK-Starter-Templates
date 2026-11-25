package app.bd

import io.ktor.client.engine.mock.MockEngine
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertIs
import kotlin.test.assertTrue

class CancellationTest {
    /**
     * A screen that goes away cancels its request. That must stay a
     * cancellation: wrapped as a transport failure, it would fail the
     * screen's scope (and show "couldn't load") instead of ending quietly.
     */
    @Test
    fun `a cancelled request is cancelled, not a transport failure`() = runTest {
        val started = CompletableDeferred<Unit>()
        val client = BdClient(
            "https://bd.test",
            "pk_test",
            "site-1",
            MockEngine {
                started.complete(Unit)
                awaitCancellation()
            },
        )
        var failure: Throwable? = null
        val call = launch {
            try {
                client.cart("visitor-1")
            } catch (error: Throwable) {
                failure = error
                throw error
            }
        }
        started.await()
        call.cancelAndJoin()
        assertTrue(call.isCancelled)
        assertIs<CancellationException>(failure)
    }
}
