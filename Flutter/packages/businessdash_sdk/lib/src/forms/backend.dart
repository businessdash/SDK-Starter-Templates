import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'dates.dart';
import 'json.dart';
import 'schema.dart';

/// Where a form comes from and where it goes. The default is
/// [BdPackageFormsBackend] (BD's Package API with a publishable key), but an
/// app can supply its own (a proxy through its server, a test double, a form
/// bundled offline) without touching the renderer.
abstract interface class BdFormsBackend {
  Future<BdFormSchema> schema(String form);

  Future<BdSubmitResult> submit(String form, BdSubmission submission);

  Future<BdUploadedFile> upload(String form, String fieldId, BdPickedFile file);

  /// Open booking start times (ISO instants) between two epoch-ms times.
  Future<List<String>> scheduleSlots(
      String form, String fieldId, int fromMs, int toMs);

  Future<BdPaymentIntent> paymentIntent(String form, String fieldId);

  Future<List<BdCollectionOption>> collectionOptions(
      String form, String fieldId);
}

/// What goes over the wire on submit.
class BdSubmission {
  const BdSubmission({
    required this.data,
    this.submitterEmail,
    this.submitterName,
    this.dryRun,
    this.source,
    this.referrer,
    this.metadata,
  });

  final Map<String, BdJson> data;
  final String? submitterEmail;
  final String? submitterName;

  /// Validate server-side without saving, notifying, or running actions.
  final bool? dryRun;
  final String? source;
  final String? referrer;
  final Map<String, BdJson>? metadata;

  /// The request body. Absent options are left out, not sent as null.
  BdJson toJson() => BdObj({
        'data': BdObj(data),
        if (submitterEmail != null) 'submitterEmail': BdStr(submitterEmail!),
        if (submitterName != null) 'submitterName': BdStr(submitterName!),
        if (dryRun != null) 'dryRun': BdBool(dryRun!),
        if (source != null) 'source': BdStr(source!),
        if (referrer != null) 'referrer': BdStr(referrer!),
        if (metadata != null) 'metadata': BdObj(metadata!),
      });
}

/// A file the visitor picked, held in memory until submit uploads it.
class BdPickedFile {
  const BdPickedFile(
      {required this.data, required this.name, required this.mimeType});

  final Uint8List data;
  final String name;
  final String mimeType;

  int get size => data.length;
}

/// A file stored by BD: the value a `file_upload` field submits.
class BdUploadedFile {
  const BdUploadedFile({
    required this.storageId,
    required this.url,
    required this.name,
    required this.mimeType,
    required this.size,
  });

  final String storageId;
  final String url;
  final String name;
  final String mimeType;
  final int size;

  BdJson get json => BdObj({
        'storageId': BdStr(storageId),
        'url': BdStr(url),
        'name': BdStr(name),
        'mimeType': BdStr(mimeType),
        'size': BdNum(size.toDouble()),
      });
}

class BdPaymentIntent {
  const BdPaymentIntent({
    required this.mode,
    required this.clientSecret,
    required this.intentId,
    required this.publishableKey,
    required this.connectedAccountId,
  });

  /// `card_on_file` (SetupIntent) or `deposit` (PaymentIntent).
  final String mode;
  final String clientSecret;
  final String intentId;

  /// The platform's Stripe publishable key.
  final String publishableKey;

  /// The org's connected account: initialize Stripe with it.
  final String connectedAccountId;
}

/// One live option of a `collection_select`: a record from the org's
/// collection, with the columns its conditions compare.
class BdCollectionOption {
  const BdCollectionOption(
      {required this.value, required this.label, this.image, this.match});

  final String value;
  final String label;
  final String? image;
  final Map<String, String>? match;

  String get id => value;

  static BdCollectionOption? fromJson(BdJson json) {
    final value = json['value']?.stringValue;
    final label = json['label']?.stringValue;
    if (value == null || label == null) return null;
    final match = json['match']?.objectValue;
    return BdCollectionOption(
      value: value,
      label: label,
      image: json['image']?.stringValue,
      match: match == null
          ? null
          : {
              for (final e in match.entries)
                if (e.value.stringValue case final s?) e.key: s,
            },
    );
  }
}

class BdFormIssue {
  BdFormIssue(
      {required this.fieldId,
      required this.label,
      required this.reason,
      String? message})
      : message = message ?? BdFormMessages.message(reason, label, null);

  final String fieldId;
  final String label;

  /// `required | type | format | min | max | options | regex | business_email | unknown_field | …`
  final String reason;
  final String message;
}

/// How a submit ended: [BdSubmitSuccess] or [BdSubmitFailure].
sealed class BdSubmitResult {
  const BdSubmitResult();

  bool get isSuccess => this is BdSubmitSuccess;
}

final class BdSubmitSuccess extends BdSubmitResult {
  const BdSubmitSuccess(
      {this.status = 201,
      this.submissionId,
      this.dryRun = false,
      this.body = const {}});

  final int status;
  final String? submissionId;
  final bool dryRun;

  /// The whole response body, for anything the server adds.
  final Map<String, BdJson> body;
}

enum BdSubmitFailureReason {
  clientValidationFailed('client_validation_failed'),
  validationFailed('validation_failed'),
  unauthorized('unauthorized'),
  forbidden('forbidden'),
  planRequired('plan_required'),
  paymentRequired('payment_required'),
  serviceSuspended('service_suspended'),
  rateLimited('rate_limited'),
  notFound('not_found'),
  invalidRequest('invalid_request'),
  serverError('server_error'),
  networkError('network_error');

  const BdSubmitFailureReason(this.wire);

  final String wire;
}

final class BdSubmitFailure extends BdSubmitResult {
  const BdSubmitFailure(
      {required this.status,
      required this.reason,
      required this.message,
      this.issues = const []});

  final int status;
  final BdSubmitFailureReason reason;
  final String message;
  final List<BdFormIssue> issues;
}

/// A request BD refused, or one that never reached it (status 0). The
/// message is fit to show.
class BdFormsException implements Exception {
  const BdFormsException(this.message, {this.status = 0});

  final int status;
  final String message;

  @override
  String toString() => 'BdFormsException($status): $message';
}

// ── Package API ──────────────────────────────────────────────────────────

/// BD's Package API, authenticated with a publishable (`pk_…`) key.
///
/// A publishable key is meant to ship inside an app. A secret key is not,
/// and passing one fails construction rather than letting it ride along.
///
/// [host] is e.g. `https://businessdash.us` (`/api/package/v1` is appended).
/// Use the apex host: `www` answers with a cross-host redirect, and a
/// redirected request loses its `Authorization` header.
class BdPackageFormsBackend implements BdFormsBackend {
  BdPackageFormsBackend({
    required String publishableKey,
    String host = 'https://businessdash.us',
    http.Client? httpClient,
  })  : _key = publishableKey,
        baseUrl = '${host.replaceAll(RegExp(r'/+$'), '')}/api/package/v1',
        _http = httpClient ?? http.Client() {
    // Allow, don't deny: secret keys start with bd_, so only "is it a pk_
    // token" catches every one. Empty means the app has no key yet.
    final key = publishableKey.trim();
    if (key.isNotEmpty && !key.startsWith('pk_')) {
      throw ArgumentError(
          'BdForms: an app takes a publishable pk_ key only, never a secret key.');
    }
  }

  final String baseUrl;
  final String _key;
  final http.Client _http;

  Uri _url(String form, [String? suffix, Map<String, String>? query]) {
    final path = ['forms', form, if (suffix != null) suffix]
        .map(Uri.encodeComponent)
        .join('/');
    final base = Uri.parse('$baseUrl/$path');
    return query == null || query.isEmpty
        ? base
        : base.replace(queryParameters: query);
  }

  Future<http.Response> _call(String method, String form,
      {String? suffix, Map<String, String>? query, BdJson? json}) async {
    final request = http.Request(method, _url(form, suffix, query))
      ..headers.addAll({
        'Authorization': 'Bearer $_key',
        'Accept': 'application/json',
        'X-BD-Client': 'dart-forms/1',
        if (json != null) 'Content-Type': 'application/json',
      });
    if (json != null) request.body = json.toJsonString();
    return http.Response.fromStream(await _http.send(request));
  }

  static bool _ok(http.Response r) => r.statusCode >= 200 && r.statusCode < 300;

  static BdJson? _tryParse(String text) {
    try {
      return BdJson.parse(text);
    } catch (_) {
      return null;
    }
  }

  /// The decoded body of a 2xx response, else a [BdFormsException].
  static BdJson _decode(http.Response response) {
    if (!_ok(response)) {
      final message = _tryParse(response.body)?['message']?.stringValue;
      throw BdFormsException(message ?? 'BD returned ${response.statusCode}.',
          status: response.statusCode);
    }
    return _tryParse(response.body) ??
        (throw BdFormsException('BD sent a response this app can\'t read.',
            status: response.statusCode));
  }

  /// Transport failures become a [BdFormsException] with status 0.
  static Future<T> _guarded<T>(Future<T> Function() block) async {
    try {
      return await block();
    } on BdFormsException {
      rethrow;
    } catch (e) {
      throw BdFormsException('Could not reach BD: $e');
    }
  }

  static String _str(BdJson json, String key) =>
      json[key]?.stringValue ??
      (throw BdFormsException('BD\'s response is missing "$key".'));

  @override
  Future<BdFormSchema> schema(String form) => _guarded(() async {
        final plain = _decode(await _call('GET', form)).toPlain();
        return BdFormSchema.fromJson(
            plain is Map<String, Object?> ? plain : const {});
      });

  @override
  Future<BdSubmitResult> submit(String form, BdSubmission submission) async {
    final http.Response response;
    try {
      response = await _call('POST', form, json: submission.toJson());
    } catch (e) {
      return BdSubmitFailure(
          status: 0,
          reason: BdSubmitFailureReason.networkError,
          message: 'Could not reach BD: $e');
    }
    final json =
        _tryParse(response.body)?.objectValue ?? const <String, BdJson>{};
    if (_ok(response)) {
      return BdSubmitSuccess(
        status: response.statusCode,
        submissionId: json['submissionId']?.stringValue,
        dryRun: json['dryRun']?.boolValue ?? false,
        body: json,
      );
    }
    return failure(response.statusCode, json);
  }

  @override
  Future<BdUploadedFile> upload(
          String form, String fieldId, BdPickedFile file) =>
      _guarded(() async {
        final body = BdObj({
          'fieldId': BdStr(fieldId),
          'filename': BdStr(file.name),
          'contentType': BdStr(file.mimeType),
          'sizeBytes': BdNum(file.size.toDouble()),
        });
        final presign = _decode(
            await _call('POST', form, suffix: 'upload-url', json: body));
        // The presigned URL carries its own authorization: no bearer token.
        final put = await _http.put(
          Uri.parse(_str(presign, 'uploadUrl')),
          headers: {
            'Content-Type': file.mimeType.isEmpty
                ? 'application/octet-stream'
                : file.mimeType
          },
          body: file.data,
        );
        if (!_ok(put)) {
          throw BdFormsException(
              'Uploading ${file.name} failed (${put.statusCode}).',
              status: put.statusCode);
        }
        return BdUploadedFile(
          storageId: _str(presign, 'storageId'),
          url: _str(presign, 'publicUrl'),
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
        );
      });

  @override
  Future<List<String>> scheduleSlots(
          String form, String fieldId, int fromMs, int toMs) =>
      _guarded(() async {
        final query = {
          'fieldId': fieldId,
          'from': BdDates.isoString(fromMs),
          'to': BdDates.isoString(toMs)
        };
        final json = _decode(
            await _call('GET', form, suffix: 'schedule-slots', query: query));
        return [
          for (final slot in json['slots']?.arrayValue ?? const <BdJson>[])
            if (slot['startAt']?.stringValue case final s?) s,
        ];
      });

  @override
  Future<BdPaymentIntent> paymentIntent(String form, String fieldId) =>
      _guarded(() async {
        final json = _decode(
          await _call('POST', form,
              suffix: 'payment-intent',
              json: BdObj({'fieldId': BdStr(fieldId)})),
        );
        return BdPaymentIntent(
          mode: _str(json, 'mode'),
          clientSecret: _str(json, 'clientSecret'),
          intentId: _str(json, 'intentId'),
          publishableKey: _str(json, 'publishableKey'),
          connectedAccountId: _str(json, 'connectedAccountId'),
        );
      });

  @override
  Future<List<BdCollectionOption>> collectionOptions(
          String form, String fieldId) =>
      _guarded(() async {
        final json = _decode(await _call('GET', form,
            suffix: 'collection-options', query: {'fieldId': fieldId}));
        return [
          for (final raw in json['options']?.arrayValue ?? const <BdJson>[])
            if (BdCollectionOption.fromJson(raw) case final option?) option,
        ];
      });

  void close() => _http.close();

  /// Map a non-2xx response the way the JS SDK does, so the same server
  /// answer becomes the same reason in every language.
  static BdSubmitFailure failure(int status, Map<String, BdJson> body) {
    final rawMessage = body['message']?.stringValue;
    final message = rawMessage == null || rawMessage.isEmpty
        ? 'Submission failed ($status).'
        : rawMessage;
    final code = body['error']?.stringValue;
    final gate = body['reason']?.stringValue;
    final issues = [
      for (final raw in body['issues']?.arrayValue ?? const <BdJson>[])
        () {
          final id =
              raw['id']?.stringValue ?? raw['fieldId']?.stringValue ?? '';
          final label =
              raw['label']?.stringValue ?? (id.isEmpty ? 'field' : id);
          final reason = raw['reason']?.stringValue ?? 'type';
          return BdFormIssue(
              fieldId: id,
              label: label,
              reason: reason,
              message: raw['message']?.stringValue);
        }(),
    ];
    final reason = switch (status) {
      401 => BdSubmitFailureReason.unauthorized,
      403 => BdSubmitFailureReason.forbidden,
      402 => switch (gate) {
          'payment_required' => BdSubmitFailureReason.paymentRequired,
          'service_suspended' => BdSubmitFailureReason.serviceSuspended,
          _ => BdSubmitFailureReason.planRequired,
        },
      429 => BdSubmitFailureReason.rateLimited,
      404 => BdSubmitFailureReason.notFound,
      400 || 422 => code == 'validation_failed' || issues.isNotEmpty
          ? BdSubmitFailureReason.validationFailed
          : BdSubmitFailureReason.invalidRequest,
      _ => BdSubmitFailureReason.serverError,
    };
    return BdSubmitFailure(
        status: status, reason: reason, message: message, issues: issues);
  }
}

// ── Messages ─────────────────────────────────────────────────────────────

/// What a visitor reads under a field. One function so every element says
/// the same thing for the same problem; an app rewords or localizes by giving
/// the controller its own `messages` function.
abstract final class BdFormMessages {
  static String message(String reason, String label, BdFormField? field) {
    final name = label.isEmpty ? 'This field' : label;
    switch (reason) {
      case 'required':
        if (field?.type == 'boolean' && field?.mustBeTrue == true) {
          return 'Please confirm to continue.';
        }
        if (field?.type == 'or_condition') {
          return 'Fill in at least one side to continue.';
        }
        if (field?.type == 'multi_populator') return 'Add at least one entry.';
        return '$name is required.';
      case 'business_email':
        return 'Please use your work email address.';
      case 'regex':
        return "$name isn't in the expected format.";
      case 'options':
        return 'Choose one of the listed options.';
      case 'unknown_field':
        return "$name isn't part of this form.";
      case 'range_order':
        return 'The end must come after the start.';
      case 'range_same_day':
        return 'Choose an end date after the start date.';
      case 'format':
        return switch (field?.type) {
          'email' => 'Enter a valid email address.',
          'phone' => 'Enter a valid phone number.',
          'url' ||
          'image_input' =>
            'Enter a valid web address, like example.com.',
          'address' => 'Enter a 5-digit ZIP code.',
          'month_year' => 'Choose a month and a year.',
          'color_picker' => 'Enter a hex color, like #3366FF.',
          'schedule' => 'Choose a valid time.',
          'number' || 'measurement' => 'Enter a whole number.',
          'currency' => field?.currencyConfig?.allowDecimal == false
              ? 'Enter a whole amount.'
              : 'Enter an amount of 0 or more.',
          _ => "$name isn't valid.",
        };
      case 'min':
        final min = field?.validation?.min ?? field?.sliderConfig?.min;
        return min != null
            ? 'Enter ${BdJS.formatNumber(min)} or more.'
            : 'Enter 0 or more.';
      case 'max':
        final max = field?.validation?.max ?? field?.sliderConfig?.max;
        if (max != null) return 'Enter ${BdJS.formatNumber(max)} or less.';
        if (field?.type == 'file_upload') {
          final n = field?.fileConfig?.maxFiles ?? 1;
          return 'Attach at most $n file${n == 1 ? '' : 's'}.';
        }
        if (field?.type == 'star_rating') {
          return 'Choose up to ${field?.starRatingConfig?.maxStars ?? 5} stars.';
        }
        return '$name is too long.';
      case 'type':
        return '$name has an invalid value.';
      default:
        // A repeater reports its child: "Age: max".
        final colon = reason.indexOf(':');
        if (colon >= 0) {
          return '${reason.substring(0, colon)}: ${message(reason.substring(colon + 1).trim(), '', null).toLowerCase()}';
        }
        return "$name isn't valid.";
    }
  }
}
