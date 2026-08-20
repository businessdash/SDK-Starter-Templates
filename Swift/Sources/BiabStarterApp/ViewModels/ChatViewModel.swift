import BiabKit
import Foundation
import Observation

/// The Front Desk chat.
///
/// The feed lives here rather than in the view because it is state with a
/// lifetime: minting a second one silently starts a second conversation, and
/// the visitor never finds out which one staff are reading.
@MainActor
@Observable
final class ChatViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    private(set) var messages: [ChatMessage] = []
    private(set) var isSending = false
    var draft = ""

    /// Minted once, on first appear. A visitor token is NOT a session id —
    /// polling with one returns nothing, forever, without erroring, which is
    /// the kind of bug that reads as "the chat is broken" rather than as a
    /// mistake in the call.
    private var feed: ChatFeed?

    var canSend: Bool {
        !isSending && !draft.trimmingCharacters(in: .whitespaces).isEmpty && feed != nil
    }

    /// Start the session and stream messages until the caller cancels.
    ///
    /// The `for await` runs for the lifetime of the view's `.task`, so SwiftUI
    /// tears the poll down on disappear. No timer is owned here — a timer
    /// would outlive the screen and keep polling a conversation nobody is
    /// looking at.
    func observe() async {
        guard let client, let biab, !biab.visitorToken.isEmpty else { return }

        // Re-entrant `.task` must not mint a second conversation.
        if feed == nil {
            do {
                feed = try await client.startChat(visitorToken: biab.visitorToken)
            } catch {
                return
            }
        }
        guard let feed else { return }

        for await batch in feed.messages() {
            messages.append(contentsOf: batch)
        }
    }

    func send() async {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, let feed else { return }

        isSending = true
        defer { isSending = false }

        // Cleared before the await so the field is empty immediately; the next
        // poll picks up the echo, so nothing is merged locally.
        draft = ""
        // Discarded deliberately: the next poll is the source of truth for
        // what actually landed, so a failed send shows up as a message that
        // never appears rather than as a second, contradictory error state.
        _ = try? await feed.send(text)
    }
}

/// The customer's portal work feed, and signing in.
@MainActor
@Observable
final class AccountViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    /// Null before the first load — distinct from `.loading`, because a
    /// signed-out customer has nothing to load rather than something pending.
    private(set) var state: LoadState<CustomerWorkBundle>?
    private(set) var signInError: String?

    func loadWork() async {
        guard let portal = biab?.portal else {
            state = nil
            return
        }
        state = await LoadState { try await portal.work() }
    }

    /// The URL to open for hosted sign-in, or nil when it cannot be built.
    ///
    /// Returns the URL rather than opening it, so the view keeps the
    /// `openURL` dependency and this stays testable without a UI.
    ///
    /// A production app would present this in `ASWebAuthenticationSession` so
    /// the browser sheet closes itself and the callback is delivered directly.
    /// Returning a URL keeps the starter free of AuthenticationServices and
    /// UIKit presentation-anchor plumbing.
    func signInURL() async -> URL? {
        guard let auth = biab?.auth else {
            signInError = "Set BIABAuthCallbackURL in Info.plist to enable sign-in."
            return nil
        }
        do {
            signInError = nil
            return try await auth.startURL()
        } catch let error as BiabError {
            signInError = error.errorDescription
            return nil
        } catch {
            signInError = error.localizedDescription
            return nil
        }
    }
}

/// One BIAB form: its schema, the values typed into it, and the submit.
@MainActor
@Observable
final class FormViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    let slug: String
    private(set) var state: LoadState<FormSchema> = .loading
    private(set) var isSubmitting = false
    private(set) var result: String?
    var values: [String: String] = [:]

    init(slug: String) {
        self.slug = slug
    }

    func load() async {
        guard let client else { return }
        state = await LoadState { try await client.forms.schema(slug: slug) }
    }

    /// Client-side required check, so the button can be disabled rather than
    /// letting someone submit and be told no. The server validates again —
    /// this is courtesy, not enforcement.
    func isValid(_ schema: FormSchema) -> Bool {
        schema.fields
            .filter(\.isRequired)
            .allSatisfy { !(values[$0.id] ?? "").isEmpty }
    }

    func submit(_ schema: FormSchema) async {
        guard let client else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let outcome = try await client.forms.submit(
                slug: schema.slug,
                input: FormSubmitInput(data: values)
            )
            result = outcome.succeeded
                ? "Thanks — we'll be in touch."
                : (outcome.reason ?? "Could not send.")
            // Only clear on success. Wiping a form whose submit failed makes
            // the customer retype everything to retry.
            if outcome.succeeded { values = [:] }
        } catch let error as BiabError {
            result = error.errorDescription
        } catch {
            result = error.localizedDescription
        }
    }
}
