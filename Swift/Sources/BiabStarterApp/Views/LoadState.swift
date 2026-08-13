import BiabKit
import SwiftUI

/// The three states every remote screen has, so each view doesn't reinvent
/// them — and so the "unavailable" case (lapsed plan, suspended site) reads
/// differently from a network blip, which is the distinction `BiabError`
/// already draws.
enum LoadState<Value: Sendable>: Sendable {
    case loading
    case loaded(Value)
    case failed(String, isUnavailable: Bool)

    /// `@MainActor` deliberately. Every caller is a SwiftUI view, and the
    /// closure captures view state — without the annotation the compiler sees
    /// a non-`Sendable` closure being sent across an isolation boundary and
    /// rejects it. Pinning the init to the main actor keeps the closure where
    /// it was created; the `await` inside still suspends rather than blocking,
    /// so the network work does not run on the main thread.
    @MainActor
    init(_ operation: () async throws -> Value) async {
        do {
            self = .loaded(try await operation())
        } catch let error as BiabError {
            self = .failed(error.errorDescription ?? "Something went wrong.", isUnavailable: error.isUnavailable)
        } catch {
            self = .failed(error.localizedDescription, isUnavailable: false)
        }
    }
}

/// Renders a `LoadState` with a consistent spinner / message / content shape.
struct LoadableView<Value: Sendable, Content: View>: View {
    let state: LoadState<Value>
    @ViewBuilder let content: (Value) -> Content

    var body: some View {
        switch state {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, alignment: .center).padding()
        case .loaded(let value):
            content(value)
        case .failed(let message, let isUnavailable):
            ContentUnavailableView(
                isUnavailable ? "Temporarily unavailable" : "Couldn't load",
                systemImage: isUnavailable ? "clock.badge.exclamationmark" : "wifi.exclamationmark",
                description: Text(message)
            )
        }
    }
}
