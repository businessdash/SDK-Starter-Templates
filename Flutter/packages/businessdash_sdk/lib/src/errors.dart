/// Why a BD call failed.
sealed class BdException implements Exception {
  const BdException();

  /// True when the org's site is lapsed or suspended, as opposed to a
  /// transient blip. Screens that want a specific notice branch on this;
  /// everything else falls back to local content.
  bool get isUnavailable => false;
}

/// A non-2xx response.
class BdHttpException extends BdException {
  const BdHttpException({
    required this.status,
    required this.path,
    this.message,
  });

  final int status;
  final String path;
  final String? message;

  @override
  String toString() =>
      message ?? 'BD request to $path failed with status $status.';
}

/// The org's billing / entitlement gate refused to serve.
///
/// The platform signals this two ways and the client normalises both: a 402
/// on writes, and a **200** whose body carries
/// `{ available: false, reason, upgradeUrl, message }` on reads.
class BdAccessRejectedException extends BdException {
  const BdAccessRejectedException({
    required this.reason,
    required this.message,
    this.upgradeUrl,
  });

  final AccessRejectionReason reason;
  final String message;
  final String? upgradeUrl;

  @override
  bool get isUnavailable =>
      reason == AccessRejectionReason.paymentRequired ||
      reason == AccessRejectionReason.serviceSuspended;

  @override
  String toString() => message;
}

class BdDecodingException extends BdException {
  const BdDecodingException(this.path, this.underlying);

  final String path;
  final Object underlying;

  @override
  String toString() => 'Could not decode the BD response for $path.';
}

class BdTransportException extends BdException {
  const BdTransportException(this.underlying);

  final Object underlying;

  @override
  String toString() => 'Could not reach BD: $underlying';
}

enum AccessRejectionReason {
  planRequired,
  paymentRequired,
  serviceSuspended;

  static AccessRejectionReason parse(String raw) => switch (raw) {
        'payment_required' => AccessRejectionReason.paymentRequired,
        'service_suspended' => AccessRejectionReason.serviceSuspended,
        _ => AccessRejectionReason.planRequired,
      };
}
