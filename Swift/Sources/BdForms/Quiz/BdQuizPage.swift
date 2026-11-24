import Foundation

// The page around a quiz: a header (name, description, facts) and, when the
// quiz can't be taken here and now, a gate in its place. The TypeScript
// forms-core's `quizInvitationPage` / `quizPracticePage`, so an app words
// these exactly as BD's hosted `/quiz-invite` page does.

/// What a quiz's page reads from a practice quiz or an invitation.
public protocol BdQuizPageInfo {
    var name: String { get }
    var description: String { get }
    var estimatedMinutes: Double? { get }
    var timeLimitMinutes: Double? { get }
}

/// What an invitation's page reads, beyond the basics.
public protocol BdQuizInvitationPageInfo: BdQuizPageInfo {
    var recipientName: String? { get }
    var requireAuthentication: Bool { get }
    /// `not_required`, `required`, `verified` or `mismatch`.
    var authenticationStatus: String { get }
    var recipientEmailHint: String { get }
    /// `pending`, `opened` or `completed`.
    var status: String { get }
    var expired: Bool { get }
    var active: Bool { get }
}

public struct BdQuizPage: Codable, Sendable, Hashable {
    public struct Header: Codable, Sendable, Hashable {
        public var eyebrow: String
        public var title: String
        public var description: String?
        public var facts: [String]
    }

    public enum GateKind: String, Codable, Sendable, Hashable {
        case invalid, expired, closed, signIn, switchAccount
    }

    public struct Gate: Codable, Sendable, Hashable {
        public struct Action: Codable, Sendable, Hashable {
            /// `signIn` or `switchAccount`.
            public var id: GateKind
            public var label: String
            public var href: String?
        }

        public var kind: GateKind
        public var title: String?
        public var body: String
        public var action: Action?
    }

    public var header: Header?
    /// Shown in place of the quiz. Nil: show the quiz under the header.
    public var gate: Gate?

    static func minutesFacts(_ w: BdQuizWords, _ page: some BdQuizPageInfo) -> [String] {
        var facts: [String] = []
        if let minutes = page.estimatedMinutes, minutes != 0 {
            facts.append(BdQuizWords.fill(w.aboutMinutes, ["minutes": BdJS.string(minutes)]))
        }
        if let minutes = page.timeLimitMinutes, minutes != 0 {
            facts.append(BdQuizWords.fill(w.minuteLimit, ["minutes": BdJS.string(minutes)]))
        }
        return facts
    }

    /// An invitation's page. Nil is an invitation that doesn't exist (or
    /// isn't this org's). The hrefs are where the sign-in and switch-account
    /// buttons go; an app can leave them nil and handle the action itself.
    public static func invitation(
        _ invitation: (some BdQuizInvitationPageInfo)?,
        words w: BdQuizWords = BdQuizWords(),
        signInHref: String? = nil,
        switchAccountHref: String? = nil
    ) -> BdQuizPage {
        func gate(_ kind: GateKind, _ body: String) -> BdQuizPage {
            BdQuizPage(header: nil, gate: Gate(kind: kind, title: nil, body: body, action: nil))
        }
        guard let invitation else { return gate(.invalid, w.invalid) }
        if invitation.expired { return gate(.expired, w.expired) }
        if !invitation.active && invitation.status != "completed" { return gate(.closed, w.closed) }
        var facts: [String] = []
        if let name = invitation.recipientName, !name.isEmpty {
            facts.append(BdQuizWords.fill(w.forRecipient, ["name": name]))
        }
        facts += minutesFacts(w, invitation)
        facts.append(invitation.requireAuthentication ? w.authenticatedResponse : w.oneResponse)
        let header = Header(
            eyebrow: w.eyebrow,
            title: invitation.name,
            description: invitation.description.isEmpty ? nil : invitation.description,
            facts: facts
        )
        let status = invitation.authenticationStatus
        guard status == "required" || status == "mismatch" else { return BdQuizPage(header: header, gate: nil) }
        let signIn = status == "required"
        return BdQuizPage(header: header, gate: Gate(
            kind: signIn ? .signIn : .switchAccount,
            title: signIn ? w.signInTitle : w.switchAccountTitle,
            body: BdQuizWords.fill(w.accountBody, ["email": invitation.recipientEmailHint]),
            action: .init(
                id: signIn ? .signIn : .switchAccount,
                label: signIn ? w.signInAction : w.switchAccountAction,
                href: signIn ? signInHref : switchAccountHref
            )
        ))
    }

    /// A practice quiz's page.
    public static func practice(_ practice: some BdQuizPageInfo, words w: BdQuizWords = BdQuizWords()) -> BdQuizPage {
        BdQuizPage(
            header: Header(
                eyebrow: w.practiceEyebrow,
                title: practice.name,
                description: practice.description.isEmpty ? nil : practice.description,
                facts: minutesFacts(w, practice) + [w.practiceNote]
            ),
            gate: nil
        )
    }
}
