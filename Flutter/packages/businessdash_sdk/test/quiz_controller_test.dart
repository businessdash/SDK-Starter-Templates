import 'dart:convert';

import 'package:businessdash_sdk/forms.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

/// A clock the test moves by hand.
class TestClock {
  double ms = 1767225600000;
  double now() => ms;
  void advance(double seconds) => ms += seconds * 1000;
}

BdFormField field(Map<String, Object?> json) => BdFormField.fromJson(json);

final capital = field({
  'id': 'q_capital', 'type': 'radio', 'label': 'Capital of France?', 'required': true, //
  'options': ['Paris', 'Lyon', 'Nice'],
  'quizOptionIds': ['o_paris', 'o_lyon', 'o_nice'],
  'quizAnswerKey': {
    'answer': {'option_id': 'o_paris'},
    'rationale': {'why_right': 'Since 987.'},
  },
});
final ocean = field({
  'id': 'q_ocean', 'type': 'text', 'label': 'Largest ocean?', //
  'quizAnswerKey': {
    'answer': {'text': 'Pacific'},
    'additional_accepted_answers': [
      {'text': 'The Pacific Ocean'},
    ],
  },
});
final essay = field({
  'id': 'q_essay', 'type': 'textarea', 'label': 'Explain photosynthesis.', //
  'quizAnswerKey': {
    'answer': {'text': 'Plants turn light into energy.', 'validate_with_ai': true},
  },
});

BdQuizQuestionResult result(String fieldId, BdQuizQuestionStatus status) => BdQuizQuestionResult(
      fieldId: fieldId,
      label: 'Q',
      status: status,
      pointsPossible: 1,
      pointsEarned: status == BdQuizQuestionStatus.correct ? 1 : 0,
      correctAnswers: const ['Paris'],
    );

BdQuizCompletion completion() => const BdQuizCompletion(
      status: 'scored',
      results: [],
      pointsEarned: 1,
      pointsPossible: 2,
      scorePercent: 50,
      provisionalScorePercent: 50,
      passed: false,
    );

/// Let queued async work (a timed submit) run.
Future<void> settle(bool Function() until) async {
  for (var i = 0; i < 200 && !until(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
}

void main() {
  group('BdQuizController', () {
    test('a local immediate run locks, checks and finishes', () async {
      final clock = TestClock();
      final quiz = BdQuizController(
        BdQuizOptions(fields: [capital, ocean], feedbackMode: BdQuizFeedbackMode.immediate),
        clock: clock.now,
      );
      addTearDown(quiz.dispose);
      final done = <BdQuizCompletion>[];
      quiz.onDone = done.add;

      // Required: checking an empty answer shows the error.
      await quiz.advance();
      expect(quiz.screen.questions.first.error, 'Capital of France? is required.');

      quiz.choose('q_capital', 'Paris');
      await quiz.advance();
      expect(quiz.screen.phase, BdQuizPhase.feedback);
      expect(quiz.screen.feedback?.badge.label, 'Correct');
      expect(quiz.screen.questions[0].choices?.first.state, BdQuizChoiceState.correct);
      // A locked answer can't change.
      quiz.choose('q_capital', 'Lyon');
      expect(quiz.state.answers['q_capital'], const BdStr('Paris'));

      await quiz.advance();
      quiz.setAnswer('q_ocean', const BdStr('  the pacific   ocean '));
      await quiz.advance();
      expect(quiz.screen.feedback?.badge.label, 'Correct');
      expect(quiz.screen.actions.first.id, BdQuizActionId.finish);

      await quiz.advance();
      expect(quiz.screen.phase, BdQuizPhase.done);
      final r = quiz.screen.done! as BdQuizResults;
      expect(r.score, '100%');
      expect(r.tally, '2 / 2 correct');
      expect(done, hasLength(1));
      expect(quiz.screen.actions.map((a) => a.id), [BdQuizActionId.retake]);
    });

    test('a countdown submits on its own and keeps the answers', () async {
      final clock = TestClock();
      final quiz = BdQuizController(BdQuizOptions(fields: [capital, ocean], timeLimitMinutes: 1), clock: clock.now);
      addTearDown(quiz.dispose);
      expect(quiz.screen.phase, BdQuizPhase.ready);
      expect(quiz.screen.ready!.body, startsWith('You have 1 minute.'));
      await quiz.start();
      expect(quiz.screen.timer?.value, '1:00');

      quiz.choose('q_capital', 'Paris');
      clock.advance(30);
      quiz.tick();
      expect(quiz.screen.timer?.value, '0:30');
      expect(quiz.screen.timer?.warning, isTrue);

      clock.advance(31);
      quiz.tick();
      await settle(() => quiz.state.completion != null);
      expect(quiz.state.timeUp, isTrue);
      final r = quiz.screen.done! as BdQuizResults;
      expect(r.timing, 'Time limit reached in 1:01');
      expect(quiz.state.completion?.results.first.status, BdQuizQuestionStatus.correct);
      expect(quiz.state.completion?.results.last.status, BdQuizQuestionStatus.incorrect);
    });

    test('open answers match alternatives, or wait for AI', () {
      final score = BdQuizScoring.score(
        [ocean, essay],
        {'q_ocean': const BdStr('<b>Pacific</b>'), 'q_essay': const BdStr('Light makes sugar.')},
        80,
      );
      expect(score.results[0].status, BdQuizQuestionStatus.correct);
      expect(score.results[1].status, BdQuizQuestionStatus.pendingAi);
      expect(score.status, 'pending_ai_review');
      expect(score.scorePercent, isNull);
      expect(score.provisionalScorePercent, 50);
    });

    test('an invited quiz uses BD for every step', () async {
      final log = <String>[];
      Map<String, BdJson>? lastAnswers;
      List<String>? lastIds;
      final quiz = BdQuizController(
        BdQuizOptions(fields: [capital, ocean], showTimer: true, local: false),
        backend: BdQuizBackend(
          start: () async {
            log.add('start');
            return const BdQuizStartInfo(startedAt: BdStr('2026-01-01T00:00:00.000Z'), serverNow: 1767225600000);
          },
          saveDraft: (_) async => log.add('draft'),
          lockAnswer: (id, _) async {
            log.add('lock $id');
            return result(id, BdQuizQuestionStatus.correct);
          },
          submit: (answers, ids) async {
            log.add('submit');
            lastAnswers = answers;
            lastIds = ids;
            return completion();
          },
        ),
        draftDelay: const Duration(milliseconds: 5),
      );
      addTearDown(quiz.dispose);
      await quiz.start();
      quiz.choose('q_capital', 'Lyon');
      await Future<void>.delayed(const Duration(milliseconds: 60));
      await quiz.advance();
      quiz.setAnswer('q_ocean', const BdStr('Atlantic'));
      await quiz.advance();

      expect(log.first, 'start');
      expect(log, contains('draft'));
      expect(log.last, 'submit');
      expect(lastAnswers, {'q_capital': const BdStr('Lyon'), 'q_ocean': const BdStr('Atlantic')});
      expect(lastIds, ['q_capital', 'q_ocean']);
      // Not a local run: no retake.
      expect(quiz.screen.actions, isEmpty);
    });

    test("BD's errors show BD's words, others the quiz's", () async {
      final quiz = BdQuizController(
        BdQuizOptions(fields: [capital], feedbackMode: BdQuizFeedbackMode.immediate, local: false),
        backend: BdQuizBackend(
          lockAnswer: (_, __) async => throw const BdFormsException('That answer is already locked.', status: 409),
          submit: (_, __) async => completion(),
        ),
      );
      addTearDown(quiz.dispose);
      quiz.choose('q_capital', 'Paris');
      await quiz.advance();
      expect(quiz.screen.error, 'That answer is already locked.');
      expect(quiz.state.pending, isNull);

      final offline = BdQuizController(
        BdQuizOptions(fields: [capital], feedbackMode: BdQuizFeedbackMode.immediate, local: false),
        backend: BdQuizBackend(
          lockAnswer: (_, __) async => throw const BdFormsException('Could not reach BD: offline'),
          submit: (_, __) async => completion(),
        ),
      );
      addTearDown(offline.dispose);
      offline.choose('q_capital', 'Paris');
      await offline.advance();
      expect(offline.screen.error, "Couldn't lock answer.");
    });

    test('a practice run is timed here and can be retaken', () async {
      final clock = TestClock();
      final quiz = BdQuizController(
        BdQuizOptions(fields: [capital, ocean], showTimer: true, shuffleQuestions: true, local: true, canRestart: true),
        backend: BdQuizBackend(submit: (_, ids) async {
          expect(ids.toSet(), {'q_capital', 'q_ocean'});
          return completion();
        }),
        clock: clock.now,
      );
      addTearDown(quiz.dispose);
      await quiz.start();
      for (final question in quiz.config.questions) {
        if (question.id == 'q_capital') {
          quiz.choose(question.id, 'Paris');
        } else {
          quiz.setAnswer(question.id, const BdStr('Pacific'));
        }
        clock.advance(40);
        await quiz.advance();
      }
      expect(quiz.state.completion?.durationSeconds, 80);
      expect(quiz.state.completion?.timedOut, isFalse);

      quiz.restart();
      expect(quiz.state.completion, isNull);
      expect(quiz.state.answers, isEmpty);
      expect(quiz.screen.phase, BdQuizPhase.ready);
    });

    test("I don't know: only on optional multiple choice", () async {
      final optional = field({
        'id': 'q_primes', 'type': 'checkbox', 'label': 'Primes?', 'options': ['4', '7'], //
        'quizOptionIds': ['o4', 'o7'],
        'quizAnswerKey': {
          'answer': {'option_id': 'o7'},
        },
      });
      final quiz = BdQuizController(
        BdQuizOptions(fields: [capital, optional], feedbackMode: BdQuizFeedbackMode.immediate, allowDontKnow: true),
      );
      addTearDown(quiz.dispose);
      expect(quiz.screen.questions[0].dontKnow, isNull); // required
      quiz.choose('q_capital', 'Nice');
      await quiz.advance();
      await quiz.advance();
      expect(quiz.screen.questions[0].dontKnow?.label, "I don't know");
      quiz.chooseDontKnow('q_primes');
      expect(quiz.state.answers['q_primes'], const BdArr([]));
      await quiz.advance();
      expect(quiz.screen.feedback?.badge.tone, BdQuizTone.unsure);
      expect(quiz.screen.feedback?.answer, "I don't know");
    });

    test('choices keep their order unless asked', () {
      final plain = BdQuizConfig(BdQuizOptions(fields: [capital]), 's');
      expect(plain.questions[0].options, ['Paris', 'Lyon', 'Nice']);
      final kept = field({
        'id': 'q_kept', 'type': 'radio', 'label': 'Kept', 'options': ['A', 'B', 'C', 'D', 'E'], //
        'quizKeepChoiceOrder': true,
        'quizOptionIds': ['a', 'b', 'c', 'd', 'e'],
        'quizAnswerKey': {
          'answer': {'option_id': 'a'},
        },
      });
      final shuffled = BdQuizConfig(BdQuizOptions(fields: [kept], shuffleChoices: true), 's');
      expect(shuffled.questions[0].options, ['A', 'B', 'C', 'D', 'E']);
    });
  });

  group('BdQuizzes', () {
    test('refuses a secret key', () {
      expect(() => BdQuizzes.packageApi(publishableKey: 'bd_3ZxQf9'), throwsArgumentError);
      expect(() => BdQuizzes.packageApi(publishableKey: 'sk_live_oops'), throwsArgumentError);
    });

    test('sends the key, the session and the Package API paths', () async {
      final seen = <http.Request>[];
      final quizzes = BdQuizzes.packageApi(
        publishableKey: 'pk_test',
        host: 'https://bd.test/',
        sessionToken: 'sess_1',
        httpClient: MockClient((request) async {
          seen.add(request);
          final headers = {'content-type': 'application/json'};
          return switch (request.url.toString()) {
            'https://bd.test/api/package/v1/quizzes/invitations/tok%2F1/lock' => http.Response(
                jsonEncode({
                  'result': {'fieldId': 'q', 'label': 'Q', 'status': 'correct', 'pointsPossible': 1, 'pointsEarned': 1},
                }),
                200,
                headers: headers,
              ),
            'https://bd.test/api/package/v1/quizzes/capitals/score' => http.Response(
                jsonEncode({
                  'status': 'scored', 'results': [], 'pointsEarned': 0, 'pointsPossible': 0, //
                  'scorePercent': 0, 'provisionalScorePercent': 0, 'passed': false,
                }),
                200,
                headers: headers,
              ),
            _ => http.Response(jsonEncode({'error': 'not_found', 'message': "This quiz invitation isn't valid."}), 404,
                headers: headers),
          };
        }),
      );
      // A token is one path segment, slashes and all (encodeURIComponent).
      final locked = await quizzes.lockInvitationAnswer('tok/1', 'q', const BdStr('Paris'));
      expect(locked.status, BdQuizQuestionStatus.correct);

      final request = seen.first;
      expect(request.method, 'POST');
      expect(request.headers['Authorization'], 'Bearer pk_test');
      expect(request.headers['X-BD-Session-Token'], 'sess_1');
      expect(request.body, '{"fieldId":"q","answer":"Paris"}');

      await quizzes.scorePractice('capitals', {'q': const BdStr('x')}, ['q']);
      expect(seen[1].body, '{"answers":{"q":"x"},"questionFieldIds":["q"]}');

      await expectLater(
        quizzes.invitation('missing'),
        throwsA(isA<BdFormsException>()
            .having((e) => e.status, 'status', 404)
            .having((e) => e.message, 'message', "This quiz invitation isn't valid.")),
      );

      // Signed out: no session header.
      try {
        await quizzes.withSession(null).invitation('x');
      } on BdFormsException catch (_) {}
      expect(seen.last.headers.containsKey('X-BD-Session-Token'), isFalse);
    });

    test('reads an invitation into quiz options', () async {
      final quizzes = BdQuizzes.packageApi(
        publishableKey: 'pk_test',
        host: 'https://bd.test',
        httpClient: MockClient((_) async => http.Response(
              jsonEncode({
                'id': 'inv_1', 'quizId': 'qz', 'name': 'Capitals', 'description': '', 'passingScore': 70, //
                'feedbackMode': 'immediate', 'showScore': true, 'resultsRequireAccount': true, 'resultsUnlocked': false,
                'requireAuthentication': false, 'authenticationStatus': 'not_required', 'recipientEmailHint': '',
                'showTimer': false, 'timeLimitMinutes': 5, 'startedAt': null, 'deadlineAt': null, 'serverNow': 1767225600000,
                'timedOut': false, 'questionFieldIds': ['q_capital'], 'status': 'opened', 'expired': false, 'active': true,
                'settings': {
                  'quiz': {'shuffleChoices': true, 'allowDontKnow': true},
                },
                'fields': [
                  {'id': 'q_capital', 'type': 'radio', 'label': 'Capital?', 'options': ['Paris', 'Lyon']},
                ],
                'lockedAnswers': {'q_capital': 'Paris'},
                'lockedResults': [
                  {'fieldId': 'q_capital', 'label': 'Capital?', 'status': 'correct', 'pointsPossible': 1, 'pointsEarned': 1},
                ],
                'attempt': null,
              }),
              200,
              headers: {'content-type': 'application/json'},
            )),
      );
      final invitation = await quizzes.invitation('tok');
      final options = invitation.options();
      expect(options.seed, 'inv_1');
      expect(options.feedbackMode, BdQuizFeedbackMode.immediate);
      expect(options.resultsLocked, isTrue);
      expect(options.shuffleChoices, isTrue);
      expect(options.shuffleQuestions, isFalse);
      expect(options.timeLimitMinutes, 5);
      final initial = invitation.initial();
      expect(initial.answers?['q_capital'], const BdStr('Paris'));
      expect(initial.results?.single.status, BdQuizQuestionStatus.correct);
      expect(initial.completion, isNull);
      expect(BdQuizPage.invitation(invitation).gate, isNull);
    });
  });
}
