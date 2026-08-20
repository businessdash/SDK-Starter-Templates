import BusinessDashKit
import SwiftUI

/// Front Desk chat.
///
/// The BIAB chat API is polling-only — there is no SSE or WebSocket anywhere
/// in the Package API. `ChatFeed` wraps that loop in an `AsyncStream`, so
/// nothing here owns a timer: the `for await` inside the model's `observe()`
/// starts when this screen appears and SwiftUI cancels it on disappear, which
/// tears the poller down through the stream's `onTermination`.
struct ChatView: View {
    @Environment(BiabEnvironment.self) private var biab
    @State private var model = ChatViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                List(model.messages) { message in
                    MessageBubble(message: message).id(message.id)
                }
                .onChange(of: model.messages.count) {
                    guard let last = model.messages.last else { return }
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }

            HStack {
                TextField("Ask us anything…", text: $model.draft)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await model.send() } }

                Button("Send") { Task { await model.send() } }
                    .disabled(!model.canSend)
            }
            .padding()
        }
        .navigationTitle("Front desk")
        .task {
            model.bind(biab)
            await model.observe()
        }
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
