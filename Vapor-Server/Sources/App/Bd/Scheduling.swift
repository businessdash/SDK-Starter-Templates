import Foundation
import Vapor

/// Percent-encode a path segment. The server client has no shared escape
/// helper, unlike the app one.
private func esc(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
}

/// Booking and conference calls.
///
/// ## Both sides of every flow
///
/// An invitee acts with a signed TOKEN from their confirmation email; staff act
/// with the API key. Both reach the same service, so the invitee AND every host
/// are notified either way, the reminders queued against the old time are
/// cancelled either way, and the booking records which side made the change.
///
/// ## Three tokens, not one
///
/// A confirmed booking yields `manageToken`, `rescheduleToken` and
/// `cancelToken` separately. A cancel link in an email must not also be able to
/// reschedule, and neither should read the whole booking.
///
/// ## The conference link is re-minted on reschedule
///
/// Read `conferenceLink` back from the reschedule result rather than reusing
/// the one from confirmation — otherwise the calendar invite you send points at
/// a dead room.
struct SchedulingResource: Sendable {
    let client: BdClient
    let siteID: String

    private func path(_ suffix: String) -> String {
        "sites/\(esc(siteID))/scheduling/\(suffix)"
    }

    /// What the org offers to book.
    func eventTypes() async throws -> JSONValue {
        try await client.get(path("event-types"))
    }

    /// One event type, plus the questions asked when booking it.
    func eventType(_ slug: String) async throws -> JSONValue {
        try await client.get(path("event-types/\(esc(slug))"))
    }

    /// Free slots in a window.
    ///
    /// Ask for the window you are about to render, not the whole month: slot
    /// computation walks every host's calendar, so a wide range is a slow one.
    func availableSlots(_ slug: String, from: String, to: String) async throws -> JSONValue {
        try await client.get(
            path("event-types/\(esc(slug))/slots"),
            query: ["from": from, "to": to]
        )
    }

    /// Book a slot.
    ///
    /// Returns `pending` rather than `confirmed` when the event type requires
    /// approval — say "requested" in the UI for that case, because telling
    /// someone their meeting is booked when staff still have to accept it is
    /// the kind of thing they plan a day around.
    func book(_ input: [String: String]) async throws -> JSONValue {
        try await client.post(path("bookings"), body: input)
    }

    /// Read a booking with one of its signed tokens.
    func booking(_ token: String, type: String = "manage") async throws -> JSONValue {
        try await client.get(
            path("bookings/\(esc(token))"),
            query: ["type": type]
        )
    }

    /// Move a booking — the INVITEE side, with their reschedule token.
    func reschedule(token: String, newStartAt: String, reason: String? = nil) async throws -> JSONValue {
        var body = ["action": "reschedule", "newStartAt": newStartAt]
        if let reason { body["reason"] = reason }
        return try await client.post(path("bookings/\(esc(token))"), body: body)
    }

    /// Cancel a booking — the INVITEE side, with their cancel token.
    ///
    /// `reason` reaches the hosts. Worth collecting: "something came up" and
    /// "I booked the wrong service" lead to different follow-ups, and the
    /// second is recoverable revenue.
    func cancel(token: String, reason: String? = nil) async throws -> JSONValue {
        var body = ["action": "cancel"]
        if let reason { body["reason"] = reason }
        return try await client.post(path("bookings/\(esc(token))"), body: body)
    }

    /// Move a booking as STAFF, with the API key rather than an invitee token.
    ///
    /// `actorUserId` records WHO moved it, which is what lets a customer's
    /// history say "they rescheduled" rather than leaving an unexplained change.
    func rescheduleAsStaff(
        bookingID: String,
        newStartAt: String,
        reason: String? = nil,
        actorUserID: String? = nil
    ) async throws -> JSONValue {
        var body = ["action": "reschedule", "newStartAt": newStartAt]
        if let reason { body["reason"] = reason }
        if let actorUserID { body["actorUserId"] = actorUserID }
        return try await client.post(
            path("bookings/\(esc(bookingID))/manage"),
            body: body
        )
    }

    /// Cancel a booking as STAFF. Notifies the invitee and every host.
    func cancelAsStaff(
        bookingID: String,
        reason: String? = nil,
        actorUserID: String? = nil
    ) async throws -> JSONValue {
        var body = ["action": "cancel"]
        if let reason { body["reason"] = reason }
        if let actorUserID { body["actorUserId"] = actorUserID }
        return try await client.post(
            path("bookings/\(esc(bookingID))/manage"),
            body: body
        )
    }
}

extension BdClient {
    /// Booking and conference calls for a site.
    func scheduling(siteID: String) -> SchedulingResource {
        SchedulingResource(client: self, siteID: siteID)
    }
}
