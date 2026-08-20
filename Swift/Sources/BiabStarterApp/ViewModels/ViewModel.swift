import BiabKit
import Foundation
import Observation

/// Shared plumbing for the screen view models.
///
/// ## Why the environment is bound rather than injected
///
/// `@Environment` is not readable from a `View`'s `init`, so a view model that
/// took `BiabEnvironment` as an init parameter could not be built by the view
/// that owns it. The alternatives are worse: making every `@State` model
/// optional pushes `model?.` through every call site, and passing the
/// environment into each method turns the view model back into a bag of
/// functions.
///
/// So the model is created empty and `bind(_:)` hands it the environment on
/// first `.task`. The call is idempotent — SwiftUI re-runs `.task` on identity
/// changes, and a second bind must not swap the dependency underneath work
/// already in flight.
@MainActor
protocol ScreenViewModel: AnyObject {
    var biab: BiabEnvironment? { get set }
}

extension ScreenViewModel {
    /// Attach the app environment. Safe to call on every `.task`.
    func bind(_ environment: BiabEnvironment) {
        if biab == nil { biab = environment }
    }

    /// The API client, or nil when the app has no BIAB credentials.
    ///
    /// Not an error: a fresh clone with no Info.plist keys renders local
    /// fallbacks and a setup notice rather than a wall of failures, which is
    /// what makes `swift run` useful before anyone has an account.
    var client: BiabClient? { biab?.client }
}

/// Turn a thrown error into the message a person should read.
///
/// `isUnavailable` keeps a lapsed plan or a suspended site distinct from a
/// network blip — the same distinction `BiabError` already draws, and the one
/// that decides whether "try again" is useful advice.
@MainActor
func failureState<T>(_ error: Error) -> LoadState<T> {
    if let biabError = error as? BiabError {
        return .failed(
            biabError.errorDescription ?? "Something went wrong.",
            isUnavailable: biabError.isUnavailable
        )
    }
    return .failed(error.localizedDescription, isUnavailable: false)
}
