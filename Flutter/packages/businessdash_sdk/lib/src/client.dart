import 'dart:convert';

import 'package:http/http.dart' as http;

import 'errors.dart';

/// Transport for the BD Package API.
///
/// ## The token rule
///
/// A mobile app **holds its credential in the artifact** — `strings` on an APK
/// or IPA finds anything you ship. So `BdClient` takes a **publishable
/// `pk_…` token** and asserts on an `sk_…` key rather than letting a secret
/// ride to the store.
///
/// That is barely limiting: the publishable scope set covers the entire
/// customer-facing surface — storefront, cart, checkout, blog, marketing
/// content, chat, forms, **the whole customer portal**, sign-in, and public
/// custom-object reads. Only operator/admin writes need a secret key, and a
/// customer app never makes those. If you need one, put it behind a server you
/// control and point the app at that.
///
/// ## What it does not leave to callers
///
/// The **access gate**. A read against a lapsed plan answers HTTP **200** with
/// `available: false` in the BODY — reads use a body-only signal so a cached
/// CDN response can't hard-fail a page. A client that only checks
/// `statusCode` decodes an empty screen and never notices, so [_decode]
/// inspects the body first.
class BdClient {
  BdClient({
    required Uri host,
    required String publishableKey,
    required this.siteId,
    http.Client? httpClient,
  })  : assert(
          !publishableKey.startsWith('sk_'),
          'BdClient was given a SECRET key. A mobile app ships its '
          'credential inside the binary, where `strings` finds it — use a '
          'publishable pk_ token instead, and route anything that genuinely '
          'needs a secret key through a server you control.',
        ),
        _baseUrl = host.replace(
          path: '${host.path.replaceAll(RegExp(r'/$'), '')}/api/package/v1',
        ),
        _apiKey = publishableKey,
        _http = httpClient ?? http.Client();

  final Uri _baseUrl;
  final String _apiKey;
  final String siteId;
  final http.Client _http;

  /// Path prefix for every site-scoped route.
  String sitePath(String suffix) =>
      'sites/${Uri.encodeComponent(siteId)}/$suffix';

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String?> query = const {},
    Map<String, String> headers = const {},
  }) =>
      _send('GET', path, query: query, headers: headers);

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, String> headers = const {},
  }) =>
      _send('POST', path, body: body ?? const {}, headers: headers);

  Future<Map<String, dynamic>> patch(
    String path, {
    required Object body,
    Map<String, String> headers = const {},
  }) =>
      _send('PATCH', path, body: body, headers: headers);

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, String> headers = const {},
  }) =>
      _send('DELETE', path, headers: headers);

  void close() => _http.close();

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, String?> query = const {},
    Object? body,
    Map<String, String> headers = const {},
  }) async {
    // Nulls are dropped rather than sent as empty — the platform treats an
    // empty `search=` differently from an absent one.
    final params = <String, String>{
      for (final entry in query.entries)
        if (entry.value != null) entry.key: entry.value!,
    };

    final uri = _baseUrl.replace(
      path: '${_baseUrl.path}/$path',
      queryParameters: params.isEmpty ? null : params,
    );

    final request = http.Request(method, uri)
      ..headers.addAll({
        'Authorization': 'Bearer $_apiKey',
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        ...headers,
      });

    if (body != null) request.body = jsonEncode(body);

    final http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request));
    } catch (error) {
      throw BdTransportException(error);
    }

    return _decode(response, path);
  }

  Map<String, dynamic> _decode(http.Response response, String path) {
    Map<String, dynamic> body;
    try {
      final decoded = response.body.isEmpty ? {} : jsonDecode(response.body);
      body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } on FormatException catch (error) {
      throw BdDecodingException(path, error);
    }

    // Checked BEFORE the status code, deliberately: reads signal the gate
    // with a 200 and a body flag, so a status-first check would let an empty
    // screen through as success.
    if (body['available'] == false && body['reason'] is String) {
      throw BdAccessRejectedException(
        reason: AccessRejectionReason.parse(body['reason'] as String),
        message: body['message'] as String? ?? 'Unavailable.',
        upgradeUrl: body['upgradeUrl'] as String?,
      );
    }

    if (response.statusCode >= 300) {
      throw BdHttpException(
        status: response.statusCode,
        path: path,
        message: body['message'] as String?,
      );
    }

    return body;
  }
}
