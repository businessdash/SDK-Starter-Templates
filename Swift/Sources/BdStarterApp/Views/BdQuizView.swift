import BdForms
import SwiftUI

/// A BD quiz, natively: an invitation sent to this customer, or a practice
/// quiz the org published.
///
/// `BdQuiz` (from `BdForms`) does the work: lettered choices, "I don't
/// know", open answers, a verdict after each answer or all at the end, an
/// elapsed or countdown timer that submits on its own, and the results.
/// This view supplies the keys and the signed-in session from
/// `BdEnvironment`; an invitation that needs the invited account asks for
/// sign-in through `onSignIn`, and reloads once the customer is in.
///
/// ```swift
/// BdQuizView(invitation: token, onSignIn: { showSignIn = true })
/// BdQuizView(practice: "food-safety")
/// ```
public struct BdQuizView: View {
    let source: BdQuiz.Source
    var onSignIn: (@MainActor () -> Void)?
    var onDone: (@MainActor (BdQuizCompletion) -> Void)?

    @Environment(BdEnvironment.self) private var bd

    /// An invited quiz, by the token in its link (`/quiz-invite/{token}`).
    public init(
        invitation token: String,
        onSignIn: (@MainActor () -> Void)? = nil,
        onDone: (@MainActor (BdQuizCompletion) -> Void)? = nil
    ) {
        source = .invitation(token: token)
        self.onSignIn = onSignIn
        self.onDone = onDone
    }

    /// A practice quiz: graded by BD, never recorded, retakeable.
    public init(practice slug: String, questionLimit: Int? = nil, onDone: (@MainActor (BdQuizCompletion) -> Void)? = nil) {
        source = .practice(slug: slug, questionLimit: questionLimit)
        self.onDone = onDone
    }

    public var body: some View {
        if let quizzes = bd.quizzes {
            BdQuiz(
                source,
                quizzes: quizzes,
                onSignIn: onSignIn,
                onSwitchAccount: { Task { await bd.signOut() } },
                onDone: onDone
            )
        } else {
            ContentUnavailableView(
                "Quiz unavailable",
                systemImage: "checklist",
                description: Text("Set BDPublishableKey and BDSiteID in Info.plist.")
            )
        }
    }
}
