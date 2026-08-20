defmodule BiabStarter.Biab.Resources.Scheduling do
  @moduledoc """
  Booking and conference calls.

  ## Both sides of every flow

  An invitee acts with a signed TOKEN from their confirmation email; staff act
  with the API key. Both reach the same service, so the invitee AND every host
  are notified either way, the reminders queued against the old time are
  cancelled either way, and the booking records which side made the change.

  ## Three tokens, not one

  A confirmed booking yields `manageToken`, `rescheduleToken` and `cancelToken`
  separately. A cancel link in an email must not also be able to reschedule,
  and neither should read the whole booking.

  ## The conference link is re-minted on reschedule

  Read `conferenceLink` back from the reschedule result rather than reusing the
  one from confirmation — otherwise the calendar invite you send points at a
  dead room.
  """

  alias BiabStarter.Biab.Client

  @doc "What the org offers to book."
  def event_types(client, site_id),
    do: Client.get(client, path(site_id, "event-types"))

  @doc "One event type, plus the questions asked when booking it."
  def event_type(client, site_id, slug),
    do: Client.get(client, path(site_id, "event-types/#{enc(slug)}"))

  @doc """
  Free slots in a window.

  Ask for the window you are about to render, not the whole month: slot
  computation walks every host's calendar, so a wide range is a slow one.
  """
  def available_slots(client, site_id, slug, from, to),
    do:
      Client.get(
        client,
        path(site_id, "event-types/#{enc(slug)}/slots"),
        from: from,
        to: to
      )

  @doc """
  Book a slot.

  Returns `pending` rather than `confirmed` when the event type requires
  approval — say "requested" in the UI for that case, because telling someone
  their meeting is booked when staff still have to accept it is the kind of
  thing they plan a day around.
  """
  def book(client, site_id, input),
    do: Client.post(client, path(site_id, "bookings"), input)

  @doc "Read a booking with one of its signed tokens."
  def booking(client, site_id, token, type \\ "manage"),
    do: Client.get(client, path(site_id, "bookings/#{enc(token)}"), type: type)

  @doc "Move a booking — the INVITEE side, with their reschedule token."
  def reschedule(client, site_id, token, new_start_at, reason \\ nil),
    do:
      Client.post(
        client,
        path(site_id, "bookings/#{enc(token)}"),
        compact(%{"action" => "reschedule", "newStartAt" => new_start_at, "reason" => reason})
      )

  @doc """
  Cancel a booking — the INVITEE side, with their cancel token.

  `reason` reaches the hosts. Worth collecting: "something came up" and "I
  booked the wrong service" lead to different follow-ups, and the second is
  recoverable revenue.
  """
  def cancel(client, site_id, token, reason \\ nil),
    do:
      Client.post(
        client,
        path(site_id, "bookings/#{enc(token)}"),
        compact(%{"action" => "cancel", "reason" => reason})
      )

  @doc """
  Move a booking as STAFF, with the API key rather than an invitee token.

  `actor_user_id` records WHO moved it, which is what lets a customer's history
  say "they rescheduled" rather than leaving an unexplained change.
  """
  def reschedule_as_staff(client, site_id, booking_id, new_start_at, reason \\ nil, actor_user_id \\ nil),
    do:
      Client.post(
        client,
        path(site_id, "bookings/#{enc(booking_id)}/manage"),
        compact(%{
          "action" => "reschedule",
          "newStartAt" => new_start_at,
          "reason" => reason,
          "actorUserId" => actor_user_id
        })
      )

  @doc "Cancel a booking as STAFF. Notifies the invitee and every host."
  def cancel_as_staff(client, site_id, booking_id, reason \\ nil, actor_user_id \\ nil),
    do:
      Client.post(
        client,
        path(site_id, "bookings/#{enc(booking_id)}/manage"),
        compact(%{"action" => "cancel", "reason" => reason, "actorUserId" => actor_user_id})
      )

  defp path(site_id, suffix), do: "sites/#{enc(site_id)}/scheduling/#{suffix}"

  defp compact(map), do: :maps.filter(fn _k, v -> v != nil end, map)

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
