// BD's side of a quiz, an invited quiz or a practice run, for
// [BdQuizController]. [BdQuizzes] reads them from BD's Package API with the
// app's publishable key (or through the app's own server); an app can supply
// any [BdQuizBackend] instead (a test double, a quiz bundled offline).

import 'package:http/http.dart' as http;

import 'backend.dart' show BdFormsException;
import 'json.dart';
import 'quiz.dart';
import 'quiz_page.dart';
import 'quiz_scoring.dart';
import 'quiz_words.dart';
import 'schema.dart';

/// What the controller asks of BD. Leave a step null where the quiz has none.
class BdQuizBackend {
  const BdQuizBackend({this.start, this.saveDraft, this.lockAnswer, required this.submit});

  final Future<BdQuizStartInfo> Function()? start;
  final Future<void> Function(Map<String, BdJson> answers)? saveDraft;
  final Future<BdQuizQuestionResult> Function(String fieldId, BdJson answer)? lockAnswer;

  /// Finish. `questionFieldIds` are the questions this run asked: all, or a
  /// local run's subset.
  final Future<BdQuizCompletion> Function(Map<String, BdJson> answers, List<String> questionFieldIds) submit;
}

// ── Wire types ──────────────────────────────────────────────────────────────

/// How a quiz is taken: the builder's quiz switches (`settings.quiz`).
class BdQuizTakingSettings {
  const BdQuizTakingSettings({this.shuffleChoices = false, this.shuffleQuestions = false, this.allowDontKnow = false});

  factory BdQuizTakingSettings.fromJson(BdJson? settings) {
    final quiz = settings?['quiz'];
    return BdQuizTakingSettings(
      shuffleChoices: quiz?['shuffleChoices']?.boolValue == true,
      shuffleQuestions: quiz?['shuffleQuestions']?.boolValue == true,
      allowDontKnow: quiz?['allowDontKnow']?.boolValue == true,
    );
  }

  final bool shuffleChoices;
  final bool shuffleQuestions;
  final bool allowDontKnow;
}

List<BdFormField> _fields(BdJson raw) =>
    [for (final f in raw['fields']?.arrayValue ?? const <BdJson>[]) BdFormField.make(f)];

BdQuizFeedbackMode _mode(BdJson raw) =>
    raw['feedbackMode']?.stringValue == 'immediate' ? BdQuizFeedbackMode.immediate : BdQuizFeedbackMode.end;

/// An invited quiz, as its taker's page shows it.
class BdQuizInvitation implements BdQuizInvitationPageInfo {
  BdQuizInvitation(this.raw)
      : id = raw['id']?.stringValue ?? '',
        quizId = raw['quizId']?.stringValue ?? '',
        name = raw['name']?.stringValue ?? '',
        description = raw['description']?.stringValue ?? '',
        competency = raw['competency']?.stringValue,
        estimatedMinutes = raw['estimatedMinutes']?.doubleValue,
        passingScore = raw['passingScore']?.doubleValue ?? BdQuizScoring.defaultPassingGrade,
        feedbackMode = _mode(raw),
        showScore = raw['showScore']?.boolValue != false,
        resultsRequireAccount = raw['resultsRequireAccount']?.boolValue == true,
        resultsUnlocked = raw['resultsUnlocked']?.boolValue == true,
        requireAuthentication = raw['requireAuthentication']?.boolValue == true,
        authenticationStatus = raw['authenticationStatus']?.stringValue ?? 'not_required',
        recipientEmailHint = raw['recipientEmailHint']?.stringValue ?? '',
        showTimer = raw['showTimer']?.boolValue == true,
        timeLimitMinutes = raw['timeLimitMinutes']?.doubleValue,
        startedAt = raw['startedAt']?.stringValue,
        deadlineAt = raw['deadlineAt']?.stringValue,
        serverNow = raw['serverNow']?.doubleValue ?? DateTime.now().millisecondsSinceEpoch.toDouble(),
        timedOut = raw['timedOut']?.boolValue == true,
        questionFieldIds = raw['questionFieldIds']?.stringArray ?? const [],
        fields = _fields(raw),
        settings = BdQuizTakingSettings.fromJson(raw['settings']),
        recipientName = raw['recipientName']?.stringValue,
        recipientEmail = raw['recipientEmail']?.stringValue,
        status = raw['status']?.stringValue ?? 'pending',
        expired = raw['expired']?.boolValue == true,
        active = raw['active']?.boolValue != false,
        lockedAnswers = raw['lockedAnswers']?.objectValue ?? const {},
        lockedResults = [
          for (final r in raw['lockedResults']?.arrayValue ?? const <BdJson>[]) BdQuizQuestionResult.fromJson(r),
        ],
        attempt = quizPresent(raw['attempt']) == null ? null : BdQuizCompletion.fromJson(raw['attempt']!);

  final BdJson raw;
  final String id;
  final String quizId;
  @override
  final String name;
  @override
  final String description;
  final String? competency;
  @override
  final double? estimatedMinutes;
  final double passingScore;
  final BdQuizFeedbackMode feedbackMode;
  final bool showScore;
  final bool resultsRequireAccount;
  final bool resultsUnlocked;
  @override
  final bool requireAuthentication;

  /// `required`/`mismatch`: show the sign-in prompt instead of the quiz.
  @override
  final String authenticationStatus;
  @override
  final String recipientEmailHint;
  final bool showTimer;
  @override
  final double? timeLimitMinutes;
  final String? startedAt;
  final String? deadlineAt;
  final double serverNow;
  final bool timedOut;
  final List<String> questionFieldIds;
  final List<BdFormField> fields;
  final BdQuizTakingSettings settings;
  @override
  final String? recipientName;
  final String? recipientEmail;
  @override
  final String status;
  @override
  final bool expired;
  @override
  final bool active;
  final Map<String, BdJson> lockedAnswers;
  final List<BdQuizQuestionResult> lockedResults;
  final BdQuizCompletion? attempt;

  /// Engine options for this invitation. The seed is the invitation, so a
  /// reload never reorders.
  BdQuizOptions options({String? signInHref, BdQuizWords words = const BdQuizWords()}) => BdQuizOptions(
        fields: fields,
        questionFieldIds: questionFieldIds,
        feedbackMode: feedbackMode,
        passingScore: passingScore,
        showTimer: showTimer,
        timeLimitMinutes: timeLimitMinutes,
        showScore: showScore,
        resultsLocked: resultsRequireAccount && !resultsUnlocked,
        signInHref: signInHref,
        shuffleChoices: settings.shuffleChoices,
        shuffleQuestions: settings.shuffleQuestions,
        seed: id,
        allowDontKnow: settings.allowDontKnow,
        local: false,
        canRestart: false,
        words: words,
      );

  /// Where it was left: locked answers, the clock, a finished attempt.
  BdQuizInitial initial() => BdQuizInitial(
        answers: lockedAnswers,
        results: lockedResults,
        completion: attempt,
        startedAt: startedAt == null ? null : BdStr(startedAt!),
        deadlineAt: deadlineAt == null ? null : BdStr(deadlineAt!),
        serverNow: serverNow,
      );
}

/// A quiz the org lets its apps and sites run as practice.
class BdPracticeQuiz implements BdQuizPageInfo {
  BdPracticeQuiz(this.raw)
      : quizId = raw['quizId']?.stringValue ?? '',
        slug = raw['slug']?.stringValue ?? '',
        name = raw['name']?.stringValue ?? '',
        description = raw['description']?.stringValue ?? '',
        competency = raw['competency']?.stringValue,
        estimatedMinutes = raw['estimatedMinutes']?.doubleValue,
        passingScore = raw['passingScore']?.doubleValue ?? BdQuizScoring.defaultPassingGrade,
        feedbackMode = _mode(raw),
        showTimer = raw['showTimer']?.boolValue == true,
        timeLimitMinutes = raw['timeLimitMinutes']?.doubleValue,
        questionFieldIds = raw['questionFieldIds']?.stringArray ?? const [],
        fields = _fields(raw),
        settings = BdQuizTakingSettings.fromJson(raw['settings']);

  final BdJson raw;
  final String quizId;
  final String slug;
  @override
  final String name;
  @override
  final String description;
  final String? competency;
  @override
  final double? estimatedMinutes;
  final double passingScore;
  final BdQuizFeedbackMode feedbackMode;
  final bool showTimer;
  @override
  final double? timeLimitMinutes;
  final List<String> questionFieldIds;
  final List<BdFormField> fields;
  final BdQuizTakingSettings settings;

  /// Engine options: graded by BD (the app never sees answer keys) but run
  /// like a local quiz: the clock pauses on a verdict, it can be retaken, and
  /// a limit asks a subset. A new order each run unless [seed] pins one.
  BdQuizOptions options({String? seed, int? questionLimit, BdQuizWords words = const BdQuizWords()}) => BdQuizOptions(
        fields: fields,
        questionFieldIds: questionFieldIds,
        feedbackMode: feedbackMode,
        passingScore: passingScore,
        showTimer: showTimer,
        timeLimitMinutes: timeLimitMinutes,
        shuffleChoices: settings.shuffleChoices,
        shuffleQuestions: settings.shuffleQuestions,
        seed: seed,
        questionLimit: questionLimit,
        allowDontKnow: settings.allowDontKnow,
        local: true,
        canRestart: true,
        words: words,
      );
}

// ── Client ──────────────────────────────────────────────────────────────────

/// BD's quiz routes, with the app's publishable key and, for invitations that
/// need the invited account, the signed-in customer's session (from
/// `BdSignIn`):
///
/// ```dart
/// final quizzes = BdQuizzes.packageApi(publishableKey: 'pk_live_…', sessionToken: session?.sessionToken);
/// ```
///
/// Or [BdQuizzes.endpoint] for the app's own server running the JS SDK's
/// `createQuizHandler`, which serves the same routes.
class BdQuizzes {
  BdQuizzes._(this.baseUrl, this._headers, this._http);

  /// BD directly. [host] is e.g. `https://businessdash.us`.
  factory BdQuizzes.packageApi({
    required String publishableKey,
    String host = 'https://businessdash.us',
    String? sessionToken,
    http.Client? httpClient,
  }) {
    // Allow, don't deny: secret keys start with bd_, so only "is it a pk_
    // token" catches every one. Empty means the app has no key yet.
    final key = publishableKey.trim();
    if (key.isNotEmpty && !key.startsWith('pk_')) {
      throw ArgumentError('BdForms: an app takes a publishable pk_ key only, never a secret key.');
    }
    return BdQuizzes._(
      '${host.replaceAll(RegExp(r'/+$'), '')}/api/package/v1/quizzes',
      {
        'Authorization': 'Bearer $publishableKey',
        if (sessionToken != null && sessionToken.isNotEmpty) sessionHeader: sessionToken,
      },
      httpClient ?? http.Client(),
    );
  }

  /// The app's own quiz routes, e.g. `https://example.com/api/bd-auth/quizzes`.
  factory BdQuizzes.endpoint(String url, {Map<String, String> headers = const {}, http.Client? httpClient}) =>
      BdQuizzes._(url.replaceAll(RegExp(r'/+$'), ''), {...headers}, httpClient ?? http.Client());

  static const sessionHeader = 'X-BD-Session-Token';

  final String baseUrl;
  final Map<String, String> _headers;
  final http.Client _http;

  /// The signed-in customer's session, if one was given.
  String? get sessionToken => _headers[sessionHeader];

  /// The same client for another signed-in customer (or none).
  BdQuizzes withSession(String? token) => BdQuizzes._(
        baseUrl,
        {
          for (final e in _headers.entries)
            if (e.key != sessionHeader) e.key: e.value,
          if (token != null && token.isNotEmpty) sessionHeader: token,
        },
        _http,
      );

  /// Same routes, same credentials: a widget can tell whether to reload.
  @override
  bool operator ==(Object other) =>
      other is BdQuizzes &&
      other.baseUrl == baseUrl &&
      other._headers.length == _headers.length &&
      _headers.entries.every((e) => other._headers[e.key] == e.value);

  @override
  int get hashCode => Object.hash(baseUrl, Object.hashAllUnordered(_headers.entries.map((e) => '${e.key}=${e.value}')));

  void close() => _http.close();

  Future<BdJson> _call(String method, List<String> path, [BdJson? body]) async {
    final http.Response response;
    try {
      final url = Uri.parse('$baseUrl/${path.map(Uri.encodeComponent).join('/')}');
      final request = http.Request(method, url)
        ..headers.addAll({
          'Accept': 'application/json',
          'X-BD-Client': 'dart-quiz/1',
          ..._headers,
          if (body != null) 'Content-Type': 'application/json',
        });
      if (body != null) request.body = body.toJsonString();
      response = await http.Response.fromStream(await _http.send(request));
    } catch (e) {
      throw BdFormsException('Could not reach BD: $e');
    }
    BdJson? json;
    try {
      json = BdJson.parse(response.body);
    } catch (_) {
      json = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw BdFormsException(json?['message']?.stringValue ?? 'BD returned ${response.statusCode}.', status: response.statusCode);
    }
    return json ?? (throw BdFormsException('BD sent an answer this app can\'t read.', status: response.statusCode));
  }

  Future<BdQuizInvitation> invitation(String token) async => BdQuizInvitation(await _call('GET', ['invitations', token]));

  Future<BdQuizStartInfo> startInvitation(String token) async =>
      BdQuizStartInfo.fromJson(await _call('POST', ['invitations', token, 'start']));

  Future<void> saveInvitationDraft(String token, Map<String, BdJson> answers) =>
      _call('POST', ['invitations', token, 'draft'], BdObj({'answers': BdObj(answers)}));

  /// Lock one answer for good and get its verdict (immediate feedback).
  Future<BdQuizQuestionResult> lockInvitationAnswer(String token, String fieldId, BdJson answer) async {
    final response = await _call('POST', ['invitations', token, 'lock'], BdObj({'fieldId': BdStr(fieldId), 'answer': answer}));
    return BdQuizQuestionResult.fromJson(response['result'] ?? const BdNull());
  }

  /// Immediate-feedback quizzes submit what was locked: pass null.
  Future<BdQuizCompletion> submitInvitation(String token, Map<String, BdJson>? answers) async =>
      BdQuizCompletion.fromJson(
        await _call('POST', ['invitations', token, 'submit'], BdObj({if (answers != null) 'answers': BdObj(answers)})),
      );

  Future<BdPracticeQuiz> practice(String slug) async => BdPracticeQuiz(await _call('GET', [slug]));

  Future<BdQuizQuestionResult> checkPracticeAnswer(String slug, String fieldId, BdJson answer) async =>
      BdQuizQuestionResult.fromJson(
        await _call('POST', [slug, 'check'], BdObj({'fieldId': BdStr(fieldId), 'answer': answer})),
      );

  Future<BdQuizCompletion> scorePractice(String slug, Map<String, BdJson> answers, [List<String>? questionFieldIds]) async =>
      BdQuizCompletion.fromJson(
        await _call(
          'POST',
          [slug, 'score'],
          BdObj({
            'answers': BdObj(answers),
            if (questionFieldIds != null) 'questionFieldIds': BdArr([for (final id in questionFieldIds) BdStr(id)]),
          }),
        ),
      );

  /// BD's side of an invited quiz.
  BdQuizBackend invitationBackend(String token) => BdQuizBackend(
        start: () => startInvitation(token),
        saveDraft: (answers) => saveInvitationDraft(token, answers),
        lockAnswer: (fieldId, answer) => lockInvitationAnswer(token, fieldId, answer),
        submit: (answers, _) => submitInvitation(token, answers),
      );

  /// BD's side of a practice run: graded there, never recorded.
  BdQuizBackend practiceBackend(String slug) => BdQuizBackend(
        lockAnswer: (fieldId, answer) => checkPracticeAnswer(slug, fieldId, answer),
        submit: (answers, ids) => scorePractice(slug, answers, ids),
      );
}
