package app.bd

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Front Desk chat as a cold [Flow] of message batches.
 *
 * The BD chat API is **polling-only** — there is no SSE and no WebSocket
 * anywhere in the Package API. The platform's guidance is `chatbot/messages`
 * every 3–5 seconds while a widget is open. This wraps that loop so a screen
 * can `collect` instead of owning a timer.
 *
 * Design notes worth knowing before you change it:
 *
 * * A **cold** flow, so the poll starts when someone collects and stops when
 *   the collecting coroutine is cancelled. `delay` is cancellable, so leaving
 *   a screen halts the network work at the next suspension point — nothing to
 *   unregister and nothing to leak.
 * * `since` carries forward so each poll is a delta.
 * * Batches are also de-duplicated on id. `since` is only as good as what the
 *   server returns: with no cursor **and** no timestamp it can't advance, and
 *   the next poll replays rows a naive collector would render twice.
 * * A transient failure backs off rather than ending the flow — a blip should
 *   not close a chat screen.
 */
public class ChatFeed(
    private val client: BdClient,
    public val sessionId: String,
    public val visitorToken: String,
    private val pollIntervalMillis: Long = 4_000,
    private val backoffMillis: Long = 15_000,
) {
    public fun messages(): Flow<List<ChatMessage>> = flow {
        var since: String? = null
        val seen = mutableSetOf<String>()

        while (true) {
            val batch = try {
                val response: ChatMessagesResponse = client.get(
                    "chatbot/messages",
                    mapOf(
                        "sessionId" to sessionId,
                        "visitorToken" to visitorToken,
                        "since" to since,
                    ),
                )

                since = response.cursor ?: response.messages.lastOrNull()?.createdAt ?: since
                response.messages.filter { seen.add(it.id) }
            } catch (_: BdException) {
                delay(backoffMillis)
                continue
            }

            if (batch.isNotEmpty()) emit(batch)
            delay(pollIntervalMillis)
        }
    }

    /**
     * Post a message. The next poll picks up the echo, so nothing is merged
     * locally.
     */
    public suspend fun send(text: String) {
        client.post<ChatSendResult>(
            "chatbot/chat",
            ChatSendInput(sessionId, visitorToken, text),
        )
    }
}

public fun BdClient.chat(sessionId: String, visitorToken: String): ChatFeed =
    ChatFeed(this, sessionId, visitorToken)

/** Mint (or resume) a Front Desk session, then hand back a feed bound to it. */
public suspend fun BdClient.startChat(visitorToken: String): ChatFeed {
    val session: ChatSessionResponse =
        post("chatbot/persisted-session", ChatSessionInput(visitorToken))
    return ChatFeed(this, session.sessionId, visitorToken)
}
