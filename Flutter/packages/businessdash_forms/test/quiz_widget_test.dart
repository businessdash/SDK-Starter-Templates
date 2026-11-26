import 'dart:convert';

import 'package:businessdash_forms/businessdash_forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

final _capital = BdFormField.fromJson({
  'id': 'q_capital', 'type': 'radio', 'label': 'Capital of France?',
  'required': true, //
  'options': ['Paris', 'Lyon', 'Nice'],
  'quizOptionIds': ['o_paris', 'o_lyon', 'o_nice'],
  'quizAnswerKey': {
    'answer': {'option_id': 'o_paris'},
    'rationale': {
      'why_right': 'It has been since 987.',
      'why_wrong': 'Lyon is the second city.'
    },
  },
});
final _ocean = BdFormField.fromJson({
  'id': 'q_ocean', 'type': 'text', 'label': 'Largest ocean?', //
  'quizAnswerKey': {
    'answer': {'text': 'Pacific'},
  },
});
final _essay = BdFormField.fromJson({
  'id': 'q_essay', 'type': 'textarea',
  'label': 'Why do leaves change colour?', //
  'quizAnswerKey': {
    'answer': {'text': 'Chlorophyll breaks down.'},
    'no_wrong_answer': true,
  },
});

/// A clock the test moves by hand.
class _Clock {
  double ms = 1767225600000;
  double now() => ms;
}

Widget _app(Widget child) => MaterialApp(home: Scaffold(body: child));

Future<void> _tap(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.pump();
  await tester.tap(find.text(text));
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('a local quiz: pick, check, see why, then the results',
      (tester) async {
    final quiz = BdQuizController(
      BdQuizOptions(
          fields: [_capital, _ocean],
          feedbackMode: BdQuizFeedbackMode.immediate),
    );
    final done = <BdQuizCompletion>[];
    await tester.pumpWidget(_app(BdQuiz.controller(quiz, onDone: done.add)));

    expect(find.text('Question 1 of 2'), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
    // Required: checking nothing says so.
    await _tap(tester, 'Check answer');
    expect(find.text('Capital of France? is required.'), findsOneWidget);

    await _tap(tester, 'Lyon');
    await _tap(tester, 'Check answer');
    expect(find.text('Incorrect'), findsOneWidget);
    expect(find.text('Lyon is the second city.'), findsWidgets);
    expect(find.byIcon(Icons.check), findsOneWidget); // Paris, the right one
    expect(find.byIcon(Icons.close), findsOneWidget); // Lyon, picked

    await _tap(tester, 'Next question');
    await tester.enterText(find.byType(TextField), 'pacific');
    await tester.pump();
    await _tap(tester, 'Check answer');
    expect(find.text('Correct'), findsOneWidget);

    await _tap(tester, 'See results');
    expect(find.text('50%'), findsOneWidget);
    expect(find.text('1 / 2 correct'), findsOneWidget);
    expect(done, hasLength(1));

    // A result opens to its verdict.
    await _tap(tester, '1. Capital of France?');
    await tester.pumpAndSettle();
    expect(find.text('Lyon is the second city.'), findsWidgets);

    // Retake starts over, typed answers too.
    await _tap(tester, 'Retake');
    await tester.pumpAndSettle();
    expect(find.text('Question 1 of 2'), findsOneWidget);
    expect(quiz.state.answers, isEmpty);
    quiz.dispose();
  });

  testWidgets('an open question with no wrong answer, at the end',
      (tester) async {
    final quiz = BdQuizController(BdQuizOptions(fields: [_essay]));
    await tester.pumpWidget(_app(BdQuiz.controller(quiz)));
    await tester.enterText(find.byType(TextField), 'The days get shorter.');
    await tester.pump();
    await _tap(tester, 'Submit quiz');
    expect(find.text('100%'), findsOneWidget);
    quiz.dispose();
  });

  testWidgets('a countdown: ready, ticking, warning, then it submits itself',
      (tester) async {
    final clock = _Clock();
    final quiz = BdQuizController(
      BdQuizOptions(fields: [_capital], timeLimitMinutes: 1),
      clock: clock.now,
    );
    await tester.pumpWidget(_app(BdQuiz.controller(quiz)));
    expect(find.text('Ready to begin?'), findsOneWidget);
    expect(find.byIcon(Icons.hourglass_empty), findsOneWidget);

    await _tap(tester, 'Start quiz');
    expect(find.text('1:00'), findsOneWidget);
    await _tap(tester, 'Paris');

    clock.ms += 45000;
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('0:15'), findsOneWidget);

    clock.ms += 16000;
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(quiz.state.timeUp, isTrue);
    expect(find.text('100%'), findsOneWidget);
    expect(find.textContaining('Time limit reached'), findsOneWidget);
    quiz.dispose();
  });

  testWidgets('Cupertino controls when asked', (tester) async {
    final quiz = BdQuizController(BdQuizOptions(fields: [_ocean]));
    await tester.pumpWidget(_app(BdQuiz.controller(quiz,
        style: const BdFormStyle(controls: BdControlStyle.cupertino))));
    expect(find.byType(CupertinoTextField), findsOneWidget);
    expect(find.byType(CupertinoButton), findsWidgets);
    expect(find.byType(TextField), findsNothing);
    quiz.dispose();
  });

  testWidgets('a practice quiz loads from BD with its page', (tester) async {
    final requests = <String>[];
    final quizzes = BdQuizzes.packageApi(
      publishableKey: 'pk_test',
      host: 'https://bd.test',
      httpClient: MockClient((request) async {
        requests.add('${request.method} ${request.url.path}');
        return http.Response(
          jsonEncode({
            'quizId': 'qz', 'slug': 'capitals', 'name': 'Capitals',
            'description': 'Warm up.', //
            'estimatedMinutes': 3, 'passingScore': 70, 'feedbackMode': 'end',
            'showTimer': false,
            'questionFieldIds': ['q_capital'],
            'fields': [
              {
                'id': 'q_capital',
                'type': 'radio',
                'label': 'Capital of France?',
                'options': ['Paris', 'Lyon']
              },
            ],
            'settings': {'quiz': {}},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    await tester.pumpWidget(_app(BdQuiz(
        source: const BdQuizSource.practice('capitals'), quizzes: quizzes)));
    expect(find.text('Loading your quiz…'), findsOneWidget);
    await tester.pump();
    await tester.pump();
    expect(requests, ['GET /api/package/v1/quizzes/capitals']);
    expect(find.text('PRACTICE QUIZ'), findsOneWidget);
    expect(find.text('Capitals'), findsOneWidget);
    expect(find.text('About 3 minutes'), findsOneWidget);
    expect(find.text('Capital of France?'), findsOneWidget);
  });

  testWidgets('an invitation for a signed-out taker asks them to sign in',
      (tester) async {
    var signIns = 0;
    final quizzes = BdQuizzes.packageApi(
      publishableKey: 'pk_test',
      host: 'https://bd.test',
      httpClient: MockClient((_) async => http.Response(
            jsonEncode({
              'id': 'inv_1', 'quizId': 'qz', 'name': 'Onboarding check',
              'description': '', //
              'requireAuthentication': true, 'authenticationStatus': 'required',
              'recipientEmailHint': 'a***@example.com',
              'status': 'pending', 'expired': false, 'active': true,
              'fields': [], 'questionFieldIds': [],
            }),
            200,
            headers: {'content-type': 'application/json'},
          )),
    );
    await tester.pumpWidget(_app(BdQuiz(
      source: const BdQuizSource.invitation('tok'),
      quizzes: quizzes,
      onSignIn: () => signIns++,
    )));
    await tester.pump();
    await tester.pump();
    expect(find.text('Onboarding check'), findsOneWidget);
    expect(find.textContaining('a***@example.com'), findsOneWidget);
    await tester.tap(find.text('Sign in to continue'));
    expect(signIns, 1);
  });

  testWidgets('a missing invitation says so; a failure offers a retry',
      (tester) async {
    var fail = true;
    final quizzes = BdQuizzes.packageApi(
      publishableKey: 'pk_test',
      host: 'https://bd.test',
      httpClient: MockClient((request) async => fail
          ? http.Response('{"message":"Something broke."}', 500,
              headers: {'content-type': 'application/json'})
          : http.Response('{"message":"Not found"}', 404,
              headers: {'content-type': 'application/json'})),
    );
    await tester.pumpWidget(_app(BdQuiz(
        source: const BdQuizSource.invitation('gone'), quizzes: quizzes)));
    await tester.pump();
    await tester.pump();
    expect(find.text('Something broke.'), findsOneWidget);
    fail = false;
    await _tap(tester, 'Try again');
    await tester.pump();
    expect(find.text("This quiz invitation isn't valid or has been withdrawn."),
        findsOneWidget);
  });
}
