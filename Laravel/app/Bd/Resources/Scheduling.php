<?php

namespace App\Bd\Resources;

use App\Bd\Client;

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
class Scheduling
{
    public function __construct(
        private readonly Client $client,
        private readonly string $siteId,
    ) {
    }

    private function path(string $suffix): string
    {
        return 'sites/'.rawurlencode($this->siteId).'/scheduling/'.$suffix;
    }

    /** @return array<string, mixed> What the org offers to book. */
    public function eventTypes(): array
    {
        return $this->client->get($this->path('event-types'));
    }

    /** @return array<string, mixed> One event type, plus its booking questions. */
    public function eventType(string $slug): array
    {
        return $this->client->get($this->path('event-types/'.rawurlencode($slug)));
    }

    /**
     * Free slots in a window.
     *
     * Ask for the window you are about to render, not the whole month: slot
     * computation walks every host's calendar, so a wide range is a slow one.
     *
     * @return array<string, mixed>
     */
    public function availableSlots(string $slug, string $from, string $to): array
    {
        return $this->client->get(
            $this->path('event-types/'.rawurlencode($slug).'/slots'),
            ['from' => $from, 'to' => $to]
        );
    }

    /**
     * Book a slot.
     *
     * Returns `pending` rather than `confirmed` when the event type requires
     * approval — say "requested" in the UI for that case, because telling
     * someone their meeting is booked when staff still have to accept it is the
     * kind of thing they plan a day around.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function book(array $input): array
    {
        return $this->client->post($this->path('bookings'), $input);
    }

    /** @return array<string, mixed> Read a booking with one of its signed tokens. */
    public function booking(string $token, string $type = 'manage'): array
    {
        return $this->client->get(
            $this->path('bookings/'.rawurlencode($token)),
            ['type' => $type]
        );
    }

    /**
     * Move a booking — the INVITEE side, with their reschedule token.
     *
     * @return array<string, mixed>
     */
    public function reschedule(string $token, string $newStartAt, ?string $reason = null): array
    {
        return $this->client->post($this->path('bookings/'.rawurlencode($token)), array_filter([
            'action' => 'reschedule',
            'newStartAt' => $newStartAt,
            'reason' => $reason,
        ], fn ($v) => $v !== null));
    }

    /**
     * Cancel a booking — the INVITEE side, with their cancel token.
     *
     * `$reason` reaches the hosts. Worth collecting: "something came up" and "I
     * booked the wrong service" lead to different follow-ups, and the second is
     * recoverable revenue.
     *
     * @return array<string, mixed>
     */
    public function cancel(string $token, ?string $reason = null): array
    {
        return $this->client->post($this->path('bookings/'.rawurlencode($token)), array_filter([
            'action' => 'cancel',
            'reason' => $reason,
        ], fn ($v) => $v !== null));
    }

    /**
     * Move a booking as STAFF, with the API key rather than an invitee token.
     *
     * `$actorUserId` records WHO moved it, which is what lets a customer's
     * history say "they rescheduled" rather than leaving an unexplained change.
     *
     * @return array<string, mixed>
     */
    public function rescheduleAsStaff(
        string $bookingId,
        string $newStartAt,
        ?string $reason = null,
        ?string $actorUserId = null,
    ): array {
        return $this->client->post(
            $this->path('bookings/'.rawurlencode($bookingId).'/manage'),
            array_filter([
                'action' => 'reschedule',
                'newStartAt' => $newStartAt,
                'reason' => $reason,
                'actorUserId' => $actorUserId,
            ], fn ($v) => $v !== null)
        );
    }

    /**
     * Cancel a booking as STAFF. Notifies the invitee and every host.
     *
     * @return array<string, mixed>
     */
    public function cancelAsStaff(
        string $bookingId,
        ?string $reason = null,
        ?string $actorUserId = null,
    ): array {
        return $this->client->post(
            $this->path('bookings/'.rawurlencode($bookingId).'/manage'),
            array_filter([
                'action' => 'cancel',
                'reason' => $reason,
                'actorUserId' => $actorUserId,
            ], fn ($v) => $v !== null)
        );
    }
}
