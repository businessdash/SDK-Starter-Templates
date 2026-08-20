import Foundation
import Vapor

// The surfaces a server-rendered portal needs: the customer's own records,
// their notification settings, the chatbot, and social links.
//
// This is the SERVER flavour — the client here holds a secret key and the full
// API. The customer's session token is still required on portal routes: the
// key says which org is asking, the session token says which customer, and one
// is not a substitute for the other. A secret key alone would happily return
// nothing and look like a signed-out customer.

// MARK: - Customer portal

/// The customer portal for one company.
///
/// `organizationId` chooses WHOSE data. A customer can buy from several
/// businesses on this platform, and notification preferences in particular are
/// stored per (org, customer): muting marketing email from one company must not
/// mute it from the others. They are separate relationships, and collapsing
/// them into a single setting would either leak a decision across companies or
/// force the customer to accept the loudest of them.
///
/// Build one per company from `otherOrgs()`.
struct PortalResource: Sendable {
    let client: BiabClient
    let sessionToken: String
    let organizationId: String?

    private var extraHeaders: [(String, String)] {
        var out = [("X-BIAB-Session-Token", sessionToken)]
        if let organizationId {
            out.append(("X-BIAB-Customer-Portal-Org", organizationId))
        }
        return out
    }

    /// Org branding and which portal features are on. Call before rendering.
    func context() async throws -> JSONValue {
        try await client.get("customer-portal/context", headers: extraHeaders)
    }

    /// The work feed: jobs, quotes, invoices and orders in one bundle.
    func work() async throws -> JSONValue {
        try await client.get("customer-portal/work", headers: extraHeaders)
    }

    func profile() async throws -> JSONValue {
        try await client.get("customer-portal/profile", headers: extraHeaders)
    }

    /// The other companies this customer belongs to. Each `orgId` builds
    /// another `PortalResource` — that is how a dashboard offers per-company
    /// notification settings.
    func otherOrgs() async throws -> JSONValue {
        try await client.get("customer-portal/other-orgs", headers: extraHeaders)
    }

    func orders(limit: Int? = nil) async throws -> JSONValue {
        try await client.get(
            "customer-portal/orders",
            query: ["limit": limit.map(String.init)],
            headers: extraHeaders
        )
    }

    /// `unpaid` filters on the computed BALANCE, not the status string — a
    /// partially-paid invoice still owes money whatever it is called.
    func invoices(unpaid: Bool = false) async throws -> JSONValue {
        try await client.get(
            "customer-portal/invoices",
            query: ["unpaid": unpaid ? "1" : nil],
            headers: extraHeaders
        )
    }

    func quotes(status: String? = nil) async throws -> JSONValue {
        try await client.get(
            "customer-portal/quotes",
            query: ["status": status],
            headers: extraHeaders
        )
    }

    func contracts(status: String? = nil) async throws -> JSONValue {
        try await client.get(
            "customer-portal/contracts",
            query: ["status": status],
            headers: extraHeaders
        )
    }

    func shipments(active: Bool = false) async throws -> JSONValue {
        try await client.get(
            "customer-portal/shipments",
            query: ["active": active ? "1" : nil],
            headers: extraHeaders
        )
    }

    // MARK: Notification preferences

    /// This company's preference matrix, plus the category and channel
    /// definitions needed to render it.
    func notificationPreferences() async throws -> JSONValue {
        try await client.get(
            "customer-portal/notification-preferences",
            headers: extraHeaders
        )
    }

    /// Merge a sparse preference update into this company's stored matrix.
    ///
    /// Send `["marketing": ["email": false]]` and only that flips; send the
    /// full matrix to overwrite. The response is the MERGED result and that is
    /// what should be rendered — echoing the request back shows the customer a
    /// matrix the server never agreed to.
    func updateNotificationPreferences(
        _ preferences: [String: [String: Bool]]
    ) async throws -> JSONValue {
        try await client.post(
            "customer-portal/notification-preferences",
            body: ["preferences": preferences],
            headers: extraHeaders
        )
    }

    /// Send a verification link (`kind: "email"`, 15-minute TTL) or a 6-digit
    /// OTP (`kind: "phone"`, 5 minutes).
    ///
    /// A destination stays **inert until verified**. That is the point of the
    /// flow, not an inconvenience in it: without it anyone holding a session
    /// could point a company's notifications at an address they do not control.
    func startVerification(kind: String, destination: String) async throws -> JSONValue {
        try await client.post(
            "notifications/preferences/verify",
            body: ["kind": kind, "destination": destination],
            headers: extraHeaders
        )
    }

    func startEmailVerification(_ destination: String) async throws -> JSONValue {
        try await startVerification(kind: "email", destination: destination)
    }

    func startPhoneVerification(_ destination: String) async throws -> JSONValue {
        try await startVerification(kind: "phone", destination: destination)
    }

    // MARK: Subscription

    /// Subscription state plus the org's live offerings.
    ///
    /// Render entitlement from `hasAccess`, never from `status`: a lifetime
    /// purchase has no period to expire, and a cancelled subscription keeps
    /// access until the period already paid for ends. `hasAccess` is computed
    /// server-side by the same function the content gates use.
    func subscription() async throws -> JSONValue {
        try await client.get("customer-portal/subscription", headers: extraHeaders)
    }

    /// Cancel at the end of the paid period.
    ///
    /// Ends the RENEWAL, not the access — the customer keeps everything until
    /// `accessUntil`. Say "active until <that>", because that is what is true.
    func cancelSubscription() async throws -> JSONValue {
        try await client.post(
            "customer-portal/subscription/cancel",
            body: ["resume": false],
            headers: extraHeaders
        )
    }

    /// Clear a pending cancellation.
    func resumeSubscription() async throws -> JSONValue {
        try await client.post(
            "customer-portal/subscription/cancel",
            body: ["resume": true],
            headers: extraHeaders
        )
    }

    /// What the subscription entitles them to.
    ///
    /// When `entitled` is false these are LOCKED previews, not an empty
    /// entitlement — show them beside the offer.
    func subscriberContent(limit: Int? = nil) async throws -> JSONValue {
        try await client.get(
            "customer-portal/subscription/content",
            query: ["limit": limit.map(String.init)],
            headers: extraHeaders
        )
    }

    /// Consume the token from the email link or the SMS code.
    ///
    /// Takes only the token: the server already knows which destination it was
    /// issued for, and accepting a caller-supplied one would let a token minted
    /// for one address verify another.
    func confirmVerification(token: String) async throws -> JSONValue {
        try await client.post(
            "notifications/preferences/verify/confirm",
            body: ["token": token],
            headers: extraHeaders
        )
    }
}

// MARK: - Customer auth

/// Signing a customer in, server-side.
///
/// The session token this returns is what every `PortalResource` call needs.
/// Store it in your own session cookie — it identifies the customer, so it
/// belongs where you keep the rest of their session, not in a URL.
struct CustomerAuthResource: Sendable {
    let client: BiabClient

    /// Who the bearer of this session token is.
    ///
    /// Note the header: `auth/me` takes a lowercase `x-biab-session`, while
    /// portal routes take `X-BIAB-Session-Token`. They are not interchangeable,
    /// and sending the wrong one reads as "not signed in" rather than as an
    /// error — which is exactly the bug that wastes an afternoon.
    func me(sessionToken: String) async throws -> JSONValue {
        try await client.get("auth/me", headers: [("x-biab-session", sessionToken)])
    }

    func signIn(email: String, password: String) async throws -> JSONValue {
        try await client.post(
            "auth/sign-in",
            body: ["email": email, "password": password]
        )
    }

    func signUp(email: String, password: String, name: String? = nil) async throws -> JSONValue {
        var body = ["email": email, "password": password]
        if let name { body["name"] = name }
        return try await client.post("auth/sign-up", body: body)
    }

    func requestPasswordReset(email: String) async throws -> JSONValue {
        try await client.post("auth/request-password-reset", body: ["email": email])
    }
}

// MARK: - Chatbot

/// The Front Desk chatbot.
///
/// A chat is a `sessionToken`, not a user: `session()` mints an anonymous one,
/// and everything else takes it. Losing the token loses the thread — there is
/// no other handle on it — so store it before rendering the first message.
///
/// `requestHuman()` is a REQUEST, not a transfer. Staff may be offline and the
/// org decides. Check `availability()` first if you want to show the option
/// only when it can actually be answered: offering "talk to a human" at 2am and
/// delivering silence is worse than not offering it.
struct ChatbotResource: Sendable {
    let client: BiabClient
    let sessionToken: String?

    private var extraHeaders: [(String, String)] {
        sessionToken.map { [("X-BIAB-Chat-Session", $0)] } ?? []
    }

    func config() async throws -> JSONValue {
        try await client.get("chatbot/config", headers: extraHeaders)
    }

    /// Whether a human could pick up right now.
    func availability() async throws -> JSONValue {
        try await client.get("chatbot/availability", headers: extraHeaders)
    }

    /// Mint a new anonymous chat session. Store the returned token.
    func session() async throws -> JSONValue {
        try await client.post("chatbot/session", body: EmptyBody(), headers: extraHeaders)
    }

    /// Resume the session this browser already holds — a reload otherwise
    /// starts a fresh thread and the visitor repeats themselves.
    func persistedSession(token: String) async throws -> JSONValue {
        try await client.post(
            "chatbot/persisted-session",
            body: ["sessionToken": token],
            headers: extraHeaders
        )
    }

    func chat(message: String) async throws -> JSONValue {
        try await client.post(
            "chatbot/chat",
            body: ["message": message],
            headers: extraHeaders
        )
    }

    func messages() async throws -> JSONValue {
        try await client.get("chatbot/messages", headers: extraHeaders)
    }

    func requestHuman() async throws -> JSONValue {
        try await client.post(
            "chatbot/request-human",
            body: EmptyBody(),
            headers: extraHeaders
        )
    }
}

// MARK: - Namespaces

extension BiabClient {
    /// The portal for one company. Pass `organizationId` from `otherOrgs()` to
    /// read or write another company's data — notification preferences
    /// especially, which are stored per company.
    func portal(sessionToken: String, organizationId: String? = nil) -> PortalResource {
        PortalResource(
            client: self,
            sessionToken: sessionToken,
            organizationId: organizationId
        )
    }

    var customerAuth: CustomerAuthResource { CustomerAuthResource(client: self) }

    func chatbot(sessionToken: String? = nil) -> ChatbotResource {
        ChatbotResource(client: self, sessionToken: sessionToken)
    }
}
