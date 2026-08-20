import 'client.dart';

/// The customer portal, and the notification settings that hang off it.
///
/// ## Every call is scoped to a signed-in customer
///
/// [sessionToken] identifies the PERSON. Without it these routes are
/// unauthenticated, which does not error so much as return an empty portal —
/// and an empty portal reads like a bug in your own code.
///
/// ## [organizationId] chooses WHOSE data
///
/// A customer can buy from several businesses on this platform. The org id
/// says which tenant's records to read; the server still checks the customer
/// belongs to it, so this widens nothing.
///
/// It matters most for notification preferences, which are stored per
/// (org, customer): muting marketing email from one company must not mute it
/// from the others. They are separate relationships, and collapsing them into
/// one setting would either leak a decision across companies or force the
/// customer to accept the loudest of them.
///
/// Build one of these per company from [PortalResource.otherOrgs].
class PortalResource {
  const PortalResource(this._client, this.sessionToken, {this.organizationId});

  final BiabClient _client;
  final String sessionToken;
  final String? organizationId;

  Map<String, String> get _headers => {
        'X-BIAB-Session-Token': sessionToken,
        if (organizationId != null)
          'X-BIAB-Customer-Portal-Org': organizationId!,
      };

  /// Org branding and which portal features are on. Call before rendering.
  Future<Map<String, dynamic>> context() =>
      _client.get('customer-portal/context', headers: _headers);

  /// The work feed: jobs, quotes, invoices and orders in one bundle.
  Future<Map<String, dynamic>> work() =>
      _client.get('customer-portal/work', headers: _headers);

  Future<Map<String, dynamic>> profile() =>
      _client.get('customer-portal/profile', headers: _headers);

  /// The other companies this customer belongs to.
  ///
  /// Each returned `orgId` can build another [PortalResource] — that is how a
  /// dashboard offers per-company notification settings.
  Future<Map<String, dynamic>> otherOrgs() =>
      _client.get('customer-portal/other-orgs', headers: _headers);

  Future<Map<String, dynamic>> orders({int? limit}) => _client.get(
        'customer-portal/orders',
        query: {'limit': limit?.toString()},
        headers: _headers,
      );

  Future<Map<String, dynamic>> order(String id) => _client.get(
        'customer-portal/orders/${Uri.encodeComponent(id)}',
        headers: _headers,
      );

  Future<Map<String, dynamic>> invoices({bool? unpaid}) => _client.get(
        'customer-portal/invoices',
        query: {if (unpaid == true) 'unpaid': '1'},
        headers: _headers,
      );

  Future<Map<String, dynamic>> quotes({String? status}) => _client.get(
        'customer-portal/quotes',
        query: {'status': status},
        headers: _headers,
      );

  Future<Map<String, dynamic>> contracts({String? status}) => _client.get(
        'customer-portal/contracts',
        query: {'status': status},
        headers: _headers,
      );

  Future<Map<String, dynamic>> shipments({bool? active}) => _client.get(
        'customer-portal/shipments',
        query: {if (active == true) 'active': '1'},
        headers: _headers,
      );

  // ── Notification preferences ────────────────────────────────────────────

  /// This company's preference matrix, plus the category and channel
  /// definitions needed to render it.
  Future<Map<String, dynamic>> notificationPreferences() => _client.get(
        'customer-portal/notification-preferences',
        headers: _headers,
      );

  /// Merge a sparse preference update into this company's stored matrix.
  ///
  /// Send `{'marketing': {'email': false}}` and only that flips; send the full
  /// matrix to overwrite. The response is the MERGED result and that is what
  /// you should render — echoing the request back shows the customer a matrix
  /// the server never agreed to.
  Future<Map<String, dynamic>> updateNotificationPreferences(
    Map<String, Map<String, bool>> preferences,
  ) =>
      _client.post(
        'customer-portal/notification-preferences',
        body: {'preferences': preferences},
        headers: _headers,
      );

  /// Send a verification link (`kind: 'email'`, 15-minute TTL) or a 6-digit
  /// OTP (`kind: 'phone'`, 5 minutes) to [destination].
  ///
  /// A destination stays **inert until verified**. That is the point of the
  /// flow, not an inconvenience in it: without it anyone holding a session
  /// could point a company's notifications at an address they do not control.
  Future<Map<String, dynamic>> startVerification({
    required String kind,
    required String destination,
  }) =>
      _client.post(
        'notifications/preferences/verify',
        body: {'kind': kind, 'destination': destination},
        headers: _headers,
      );

  /// Consume the token from the email link or the SMS code.
  ///
  /// Takes only the token: the server already knows which destination it was
  /// issued for, and accepting a caller-supplied one would let a token minted
  /// for one address verify another.
  Future<Map<String, dynamic>> confirmVerification(String token) => _client.post(
        'notifications/preferences/verify/confirm',
        body: {'token': token},
        headers: _headers,
      );

  // ── Subscription ────────────────────────────────────────────────────────

  /// Subscription state plus the org's live offerings.
  ///
  /// Render entitlement from `hasAccess`, never from `status`: a lifetime
  /// purchase has no period to expire, and a cancelled subscription keeps
  /// access until the period already paid for ends.
  Future<Map<String, dynamic>> subscription() =>
      _client.get('customer-portal/subscription', headers: _headers);

  /// Cancel at the end of the paid period.
  ///
  /// Ends the RENEWAL, not the access — the customer keeps everything until
  /// `accessUntil`. Say "active until <that>", because that is what is true.
  Future<Map<String, dynamic>> cancelSubscription() => _client.post(
        'customer-portal/subscription/cancel',
        body: {'resume': false},
        headers: _headers,
      );

  /// Clear a pending cancellation.
  Future<Map<String, dynamic>> resumeSubscription() => _client.post(
        'customer-portal/subscription/cancel',
        body: {'resume': true},
        headers: _headers,
      );

  /// What the subscription entitles them to.
  ///
  /// When `entitled` is false these are LOCKED previews, not an empty
  /// entitlement — show them beside the offer.
  Future<Map<String, dynamic>> subscriberContent({int? limit}) => _client.get(
        'customer-portal/subscription/content',
        query: {'limit': limit?.toString()},
        headers: _headers,
      );
}

extension BiabPortal on BiabClient {
  /// The portal for one company.
  ///
  /// Pass [organizationId] from `otherOrgs()` to read or write a different
  /// company's data — notification preferences especially, which are stored
  /// per company.
  PortalResource portal(String sessionToken, {String? organizationId}) =>
      PortalResource(this, sessionToken, organizationId: organizationId);
}
