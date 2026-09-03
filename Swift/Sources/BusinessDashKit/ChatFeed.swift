import Foundation

/// Front Desk chat as an `AsyncStream` of message batches.
///
/// The BD chat API is **polling-only** — there is no SSE and no WebSocket
/// anywhere in the Package API. The platform's guidance is `chatbot/messages`
/// every 3–5 seconds while a widget is open. This wraps that loop so a SwiftUI
/// view can `for await` instead of owning a timer.
///
/// Design notes worth knowing before you change it:
///
/// * `since` carries forward, so each poll returns only new rows rather than
///   the whole transcript.
/// * The producer runs in a **structured** child task inside the stream's
///   lifetime and is torn down by `onTermination`. Cancelling the consuming
///   task, or simply leaving the `for await` loop, stops the network work —
///   no timer to invalidate and no retain cycle to break.
/// * Failures back off instead of hammering a failing endpoint at 4s forever.
///   A transient error is not a reason to end the stream, so the loop
///   continues; only cancellation finishes it.
public struct ChatFeed: Sendable {
    let client: BdClient
    public let sessionID: String
    public let visitorToken: String

    /// Seconds between polls while the stream is being consumed.
    public var pollInterval: Duration = .seconds(4)
    /// Backoff after a failed poll.
    public var backoffInterval: Duration = .seconds(15)

    public init(client: BdClient, sessionID: String, visitorToken: String) {
        self.client = client
        self.sessionID = sessionID
        self.visitorToken = visitorToken
    }

    /// New messages, in batches, until the consuming task is cancelled.
    public func messages() -> AsyncStream<[ChatMessage]> {
        // `.bufferingNewest` rather than the unbounded default: if a view
        // stops consuming (backgrounded, mid-navigation) an unbounded buffer
        // would grow for as long as the app lives.
        let (stream, continuation) = AsyncStream.makeStream(
            of: [ChatMessage].self,
            bufferingPolicy: .bufferingNewest(32)
        )

        let producer = Task {
            var since: String?
            // `since` is only as good as what the server gives back. If a
            // response carries no cursor AND the last message has no
            // timestamp, `since` can't advance and the next poll returns the
            // same rows — which a view appending batches would render twice.
            // Filtering on ids makes the stream's "new messages" contract
            // true regardless of what the cursor does.
            var seen = Set<String>()

            while !Task.isCancelled {
                do {
                    let response: ChatMessagesResponse = try await client.get(
                        "chatbot/messages",
                        query: [
                            "sessionId": sessionID,
                            "visitorToken": visitorToken,
                            "since": since
                        ]
                    )

                    let fresh = response.messages.filter { seen.insert($0.id).inserted }
                    if !fresh.isEmpty {
                        continuation.yield(fresh)
                    }

                    // `createdAt` is already an ISO-8601 string on the wire.
                    // Pass it back verbatim rather than round-tripping through
                    // a Date, which risks reformatting into something the
                    // server's `since` parser doesn't accept.
                    if let cursor = response.cursor {
                        since = cursor
                    } else if let latest = response.messages.last?.createdAt {
                        since = latest
                    }

                    try await Task.sleep(for: pollInterval)
                } catch is CancellationError {
                    break
                } catch {
                    // A transient failure is not a reason to end the stream.
                    // If the sleep is cancelled here, `try?` swallows it and
                    // the loop's `Task.isCancelled` check exits on the next
                    // pass.
                    try? await Task.sleep(for: backoffInterval)
                }
            }

            continuation.finish()
        }

        // Finishing the stream (consumer went away, task cancelled) must stop
        // the producer, or the poll loop outlives the screen that wanted it.
        continuation.onTermination = { _ in producer.cancel() }

        return stream
    }

    /// Post a message. The next poll picks up the echo, so there is nothing to
    /// merge locally.
    ///
    /// Note the endpoint: `chatbot/messages`, **not** `chatbot/chat`. Those
    /// are two different products. `chat` is a stateless AI turn — you send
    /// the whole transcript and it answers, nothing is stored, and a human
    /// can't join. This is the Front Desk flow: the thread lives on the
    /// platform, staff can see it and take over.
    @discardableResult
    public func send(_ text: String) async throws -> [ChatMessage] {
        let response: ChatMessagesResponse = try await client.post(
            "chatbot/messages",
            body: ChatSendInput(
                sessionID: sessionID,
                visitorToken: visitorToken,
                content: text
            )
        )
        return response.messages
    }
}

extension BdClient {
    public func chat(sessionID: String, visitorToken: String) -> ChatFeed {
        ChatFeed(client: self, sessionID: sessionID, visitorToken: visitorToken)
    }

    /// Mint (or resume) a Front Desk session for this visitor, then hand back
    /// a feed bound to it.
    ///
    /// A visitor token is NOT a session id — passing one where a session is
    /// expected polls a conversation that doesn't exist and returns nothing,
    /// forever, without erroring.
    public func startChat(visitorToken: String) async throws -> ChatFeed {
        let session: ChatSession = try await post(
            "chatbot/persisted-session",
            body: ChatSessionInput(visitorToken: visitorToken)
        )
        return ChatFeed(client: self, sessionID: session.sessionId, visitorToken: visitorToken)
    }
}
