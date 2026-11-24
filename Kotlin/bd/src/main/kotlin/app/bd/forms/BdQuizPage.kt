package app.bd.forms

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// The page around a quiz: a header (name, description, facts) and, when the
// quiz can't be taken here and now, a gate in its place. The TypeScript
// forms-core's `quizInvitationPage` / `quizPracticePage`, so an app words these
// exactly as BD's hosted `/quiz-invite` page does.

/** What a quiz's page reads from a practice quiz or an invitation. */
public interface BdQuizPageInfo {
    public val name: String
    public val description: String
    public val estimatedMinutes: Double?
    public val timeLimitMinutes: Double?
}

/** What an invitation's page reads, beyond the basics. */
public interface BdQuizInvitationPageInfo : BdQuizPageInfo {
    public val recipientName: String?
    public val requireAuthentication: Boolean

    /** `not_required`, `required`, `verified` or `mismatch`. */
    public val authenticationStatus: String
    public val recipientEmailHint: String

    /** `pending`, `opened` or `completed`. */
    public val status: String
    public val expired: Boolean
    public val active: Boolean
}

@Serializable
public data class BdQuizPage(
    public val header: Header? = null,
    /** Shown in place of the quiz. Null: show the quiz under the header. */
    public val gate: Gate? = null,
) {
    @Serializable
    public data class Header(
        public val eyebrow: String,
        public val title: String,
        public val description: String? = null,
        public val facts: List<String>,
    )

    @Serializable
    public enum class GateKind {
        @SerialName("invalid") INVALID,
        @SerialName("expired") EXPIRED,
        @SerialName("closed") CLOSED,
        @SerialName("signIn") SIGN_IN,
        @SerialName("switchAccount") SWITCH_ACCOUNT,
    }

    @Serializable
    public data class Gate(
        public val kind: GateKind,
        public val title: String? = null,
        public val body: String,
        public val action: Action? = null,
    ) {
        @Serializable
        public data class Action(
            /** [GateKind.SIGN_IN] or [GateKind.SWITCH_ACCOUNT]. */
            public val id: GateKind,
            public val label: String,
            public val href: String? = null,
        )
    }

    public companion object {
        private fun minutes(n: Double): String = BdJS.string(n)

        private fun minutesFacts(w: BdQuizWords, page: BdQuizPageInfo): List<String> = buildList {
            page.estimatedMinutes?.takeIf { it != 0.0 }?.let { add(BdQuizWords.fill(w.aboutMinutes, mapOf("minutes" to minutes(it)))) }
            page.timeLimitMinutes?.takeIf { it != 0.0 }?.let { add(BdQuizWords.fill(w.minuteLimit, mapOf("minutes" to minutes(it)))) }
        }

        /**
         * An invitation's page. Null is an invitation that doesn't exist (or
         * isn't this org's). The hrefs are where the sign-in and switch-account
         * buttons go; an app can leave them null and handle the action itself.
         */
        public fun invitation(
            invitation: BdQuizInvitationPageInfo?,
            words: BdQuizWords = BdQuizWords(),
            signInHref: String? = null,
            switchAccountHref: String? = null,
        ): BdQuizPage {
            val w = words
            fun gate(kind: GateKind, body: String) = BdQuizPage(gate = Gate(kind, null, body, null))
            if (invitation == null) return gate(GateKind.INVALID, w.invalid)
            if (invitation.expired) return gate(GateKind.EXPIRED, w.expired)
            if (!invitation.active && invitation.status != "completed") return gate(GateKind.CLOSED, w.closed)
            val facts = buildList {
                invitation.recipientName?.takeIf { it.isNotEmpty() }?.let { add(BdQuizWords.fill(w.forRecipient, mapOf("name" to it))) }
                addAll(minutesFacts(w, invitation))
                add(if (invitation.requireAuthentication) w.authenticatedResponse else w.oneResponse)
            }
            val header = Header(w.eyebrow, invitation.name, invitation.description.ifEmpty { null }, facts)
            val status = invitation.authenticationStatus
            if (status != "required" && status != "mismatch") return BdQuizPage(header, null)
            val signIn = status == "required"
            val kind = if (signIn) GateKind.SIGN_IN else GateKind.SWITCH_ACCOUNT
            return BdQuizPage(
                header,
                Gate(
                    kind = kind,
                    title = if (signIn) w.signInTitle else w.switchAccountTitle,
                    body = BdQuizWords.fill(w.accountBody, mapOf("email" to invitation.recipientEmailHint)),
                    action = Gate.Action(kind, if (signIn) w.signInAction else w.switchAccountAction, if (signIn) signInHref else switchAccountHref),
                ),
            )
        }

        /** A practice quiz's page. */
        public fun practice(practice: BdQuizPageInfo, words: BdQuizWords = BdQuizWords()): BdQuizPage = BdQuizPage(
            header = Header(
                eyebrow = words.practiceEyebrow,
                title = practice.name,
                description = practice.description.ifEmpty { null },
                facts = minutesFacts(words, practice) + words.practiceNote,
            ),
        )
    }
}
