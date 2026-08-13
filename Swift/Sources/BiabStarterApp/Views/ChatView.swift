import BiabKit
import SwiftUI

/// Front Desk chat.
///
/// The BIAB chat API is polling-only — there is no SSE or WebSocket anywhere
/// in the Package API. `ChatFeed` wraps that loop in an `AsyncStream`, so this
/// view owns no timer: the `for await` inside `.task` starts the poll when the
/// screen appears and SwiftUI cancels it on disappear, which tears the poller
/// down through the stream's `onTermination`.
struct ChatView: View {
    @Environment(BiabEnvironment.self) private var biab

    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var isSending = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                List(messages) { message in
                    MessageBubble(message: message).id(message.id)
                }
                .onChange(of: messages.count) {
                    guard let last = messages.last else { return }
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }

            HStack {
                TextField("Ask us anything…", text: $draft)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await send() } }

                Button("Send") { Task { await send() } }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || isSending)
            }
            .padding()
        }
        .navigationTitle("Front desk")
        .task { await observe() }
    }

    /// Minted once, on appear. A visitor token is NOT a session id — polling
    /// with one returns nothing, forever, without erroring.
    @State private var feed: ChatFeed?

    private func observe() async {
        guard let client = biab.client, !biab.visitorToken.isEmpty else { return }

        let feed: ChatFeed
        do {
            feed = try await client.startChat(visitorToken: biab.visitorToken)
        } catch {
            return
        }

        self.feed = feed

        for await batch in feed.messages() {
            messages.append(contentsOf: batch)
        }
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, let feed else { return }

        isSending = true
        defer { isSending = false }

        draft = ""
        // The next poll picks up the echo, so nothing is merged locally.
        try? await feed.send(text)
    }
}

struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(message.role.capitalized)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(message.content)
        }
        .frame(maxWidth: .infinity, alignment: message.role == "visitor" ? .trailing : .leading)
    }
}
