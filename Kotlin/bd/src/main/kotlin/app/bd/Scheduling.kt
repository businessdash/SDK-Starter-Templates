package app.bd

import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.JsonElement

/**
 * Booking and conference calls.
 *
 * ## Both sides of every flow
 *
 * An invitee acts with a signed TOKEN from their confirmation email; staff act
 * with the API key. Both reach the same service, so the invitee AND every host
 * are notified either way, the reminders queued against the old time are
 * cancelled either way, and the booking records which side made the change.
 *
 * ## Three tokens, not one
 *
 * A confirmed booking yields `manageToken`, `rescheduleToken` and `cancelToken`
 * separately. A cancel link in an email must not also be able to reschedule,
 * and neither should read the whole booking.
 *
 * ## The conference link is re-minted on reschedule
 *
 * Read `conferenceLink` back from the reschedule result rather than reusing the
 * one from confirmation — otherwise the calendar invite you send points at a
 * dead room.
 */
public class SchedulingResource internal constructor(
    private val client: BdClient,
    private val siteId: String,
) {
    private fun path(suffix: String): String =
        "sites/${siteId.encodeURLPathPart()}/scheduling/$suffix"

    /** What the org offers to book. */
    public suspend fun eventTypes(): JsonElement = client.get(path("event-types"))

    /** One event type, plus the questions asked when booking it. */
    public suspend fun eventType(slug: String): JsonElement =
        client.get(path("event-types/${slug.encodeURLPathPart()}"))

    /**
     * Free slots in a window.
     *
     * Ask for the window you are about to render, not the whole month: slot
     * computation walks every host's calendar, so a wide range is a slow one.
     */
    public suspend fun availableSlots(slug: String, from: String, to: String): JsonElement =
        client.get(
            path("event-types/${slug.encodeURLPathPart()}/slots"),
            mapOf("from" to from, "to" to to),
        )

    /**
     * Book a slot.
     *
     * Returns `pending` rather than `confirmed` when the event type requires
     * approval — say "requested" in the UI for that case, because telling
     * someone their meeting is booked when staff still have to accept it is
     * the kind of thing they plan a day around.
     */
    public suspend fun book(input: Map<String, Any?>): JsonElement =
        client.post(path("bookings"), input)

    /** Read a booking with one of its signed tokens. */
    public suspend fun booking(token: String, type: String = "manage"): JsonElement =
        client.get(path("bookings/${token.encodeURLPathPart()}"), mapOf("type" to type))

    /** Move a booking — the INVITEE side, with their reschedule token. */
    public suspend fun reschedule(token: String, newStartAt: String, reason: String? = null): JsonElement =
        client.post(
            path("bookings/${token.encodeURLPathPart()}"),
            buildMap {
                put("action", "reschedule")
                put("newStartAt", newStartAt)
                reason?.let { put("reason", it) }
            },
        )

    /**
     * Cancel a booking — the INVITEE side, with their cancel token.
     *
     * `reason` reaches the hosts. Worth collecting: "something came up" and "I
     * booked the wrong service" lead to different follow-ups, and the second is
     * recoverable revenue.
     */
    public suspend fun cancel(token: String, reason: String? = null): JsonElement =
        client.post(
            path("bookings/${token.encodeURLPathPart()}"),
            buildMap {
                put("action", "cancel")
                reason?.let { put("reason", it) }
            },
        )

    /**
     * Move a booking as STAFF, with the API key rather than an invitee token.
     *
     * `actorUserId` records WHO moved it, which is what lets a customer's
     * history say "they rescheduled" rather than leaving an unexplained change.
     */
    public suspend fun rescheduleAsStaff(
        bookingId: String,
        newStartAt: String,
        reason: String? = null,
        actorUserId: String? = null,
    ): JsonElement = client.post(
        path("bookings/${bookingId.encodeURLPathPart()}/manage"),
        buildMap {
            put("action", "reschedule")
            put("newStartAt", newStartAt)
            reason?.let { put("reason", it) }
            actorUserId?.let { put("actorUserId", it) }
        },
    )

    /** Cancel a booking as STAFF. Notifies the invitee and every host. */
    public suspend fun cancelAsStaff(
        bookingId: String,
        reason: String? = null,
        actorUserId: String? = null,
    ): JsonElement = client.post(
        path("bookings/${bookingId.encodeURLPathPart()}/manage"),
        buildMap {
            put("action", "cancel")
            reason?.let { put("reason", it) }
            actorUserId?.let { put("actorUserId", it) }
        },
    )
}

/** Booking and conference calls for [siteId]. */
public fun BdClient.scheduling(siteId: String): SchedulingResource =
    SchedulingResource(this, siteId)
