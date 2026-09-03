import 'client.dart';

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
class SchedulingResource {
  const SchedulingResource(this._client, this.siteId);

  final BdClient _client;
  final String siteId;

  String _path(String suffix) =>
      'sites/${Uri.encodeComponent(siteId)}/scheduling/$suffix';

  /// What the org offers to book.
  Future<Map<String, dynamic>> eventTypes() => _client.get(_path('event-types'));

  /// One event type, plus the questions asked when booking it.
  Future<Map<String, dynamic>> eventType(String slug) =>
      _client.get(_path('event-types/${Uri.encodeComponent(slug)}'));

  /// Free slots in a window.
  ///
  /// Ask for the window you are about to render, not the whole month: slot
  /// computation walks every host's calendar, so a wide range is a slow one.
  Future<Map<String, dynamic>> availableSlots(
    String slug, {
    required String from,
    required String to,
  }) =>
      _client.get(
        _path('event-types/${Uri.encodeComponent(slug)}/slots'),
        query: {'from': from, 'to': to},
      );

  /// Book a slot.
  ///
  /// Returns `pending` rather than `confirmed` when the event type requires
  /// approval — say "requested" in the UI for that case, because telling
  /// someone their meeting is booked when staff still have to accept it is the
  /// kind of thing they plan a day around.
  Future<Map<String, dynamic>> book(Map<String, dynamic> input) =>
      _client.post(_path('bookings'), body: input);

  /// Read a booking with one of its signed tokens.
  Future<Map<String, dynamic>> booking(String token, {String type = 'manage'}) =>
      _client.get(
        _path('bookings/${Uri.encodeComponent(token)}'),
        query: {'type': type},
      );

  /// Move a booking — the INVITEE side, with their reschedule token.
  Future<Map<String, dynamic>> reschedule(
    String token, {
    required String newStartAt,
    String? reason,
  }) =>
      _client.post(
        _path('bookings/${Uri.encodeComponent(token)}'),
        body: {
          'action': 'reschedule',
          'newStartAt': newStartAt,
          if (reason != null) 'reason': reason,
        },
      );

  /// Cancel a booking — the INVITEE side, with their cancel token.
  ///
  /// `reason` reaches the hosts. Worth collecting: "something came up" and "I
  /// booked the wrong service" lead to different follow-ups, and the second is
  /// recoverable revenue.
  Future<Map<String, dynamic>> cancel(String token, {String? reason}) =>
      _client.post(
        _path('bookings/${Uri.encodeComponent(token)}'),
        body: {'action': 'cancel', if (reason != null) 'reason': reason},
      );

  /// Move a booking as STAFF, with the API key rather than an invitee token.
  ///
  /// `actorUserId` records WHO moved it, which is what lets a customer's
  /// history say "they rescheduled" rather than leaving an unexplained change.
  Future<Map<String, dynamic>> rescheduleAsStaff(
    String bookingId, {
    required String newStartAt,
    String? reason,
    String? actorUserId,
  }) =>
      _client.post(
        _path('bookings/${Uri.encodeComponent(bookingId)}/manage'),
        body: {
          'action': 'reschedule',
          'newStartAt': newStartAt,
          if (reason != null) 'reason': reason,
          if (actorUserId != null) 'actorUserId': actorUserId,
        },
      );

  /// Cancel a booking as STAFF. Notifies the invitee and every host.
  Future<Map<String, dynamic>> cancelAsStaff(
    String bookingId, {
    String? reason,
    String? actorUserId,
  }) =>
      _client.post(
        _path('bookings/${Uri.encodeComponent(bookingId)}/manage'),
        body: {
          'action': 'cancel',
          if (reason != null) 'reason': reason,
          if (actorUserId != null) 'actorUserId': actorUserId,
        },
      );
}

extension BdScheduling on BdClient {
  /// Booking and conference calls for [siteId].
  SchedulingResource scheduling(String siteId) =>
      SchedulingResource(this, siteId);
}
