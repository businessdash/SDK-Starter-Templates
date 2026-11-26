import 'package:businessdash_forms/businessdash_forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../forms/demo_quiz.dart';

/// A BusinessDash quiz in native widgets: no web view.
///
/// Run with `--dart-define=BD_QUIZ=<slug>` (a practice quiz) and `BD_PK`, and
/// this is that quiz, graded by BD. Without it, it's a bundled sample graded
/// on the device, so the tab works on a fresh clone: a 5-minute countdown,
/// verdicts as you go, multiple choice, a typed answer and an open one.
///
/// An invited quiz is the same widget with `BdQuizSource.invitation(token)`,
/// and the signed-in customer's session on [BdQuizzes] when the invitation
/// needs their account.
class QuizPage extends StatefulWidget {
  const QuizPage(
      {super.key,
      required this.host,
      required this.publishableKey,
      required this.quiz});

  final String host;
  final String publishableKey;
  final String quiz;

  bool get isLive => quiz.isNotEmpty && publishableKey.isNotEmpty;

  @override
  State<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends State<QuizPage> {
  BdQuizzes? _quizzes;
  BdQuizController? _sample;

  @override
  void initState() {
    super.initState();
    if (widget.isLive) {
      _quizzes = BdQuizzes.packageApi(
          publishableKey: widget.publishableKey, host: widget.host);
    } else {
      _sample = BdQuizController(BdQuizOptions(
        fields: BdFormSchema.parse(demoQuizJson).fields,
        feedbackMode: BdQuizFeedbackMode.immediate,
        timeLimitMinutes: 5,
        allowDontKnow: true,
      ));
    }
  }

  @override
  void dispose() {
    _sample?.dispose();
    _quizzes?.close();
    super.dispose();
  }

  void _done(BdQuizCompletion completion) {
    final score = completion.scorePercent ?? completion.provisionalScorePercent;
    final text = score == null
        ? 'Quiz submitted'
        : 'Scored ${BdQuizEngine.percent(score)}%';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: _quizzes != null
            ? BdQuiz(
                source: BdQuizSource.practice(widget.quiz),
                quizzes: _quizzes!,
                onDone: _done)
            : BdQuiz.controller(_sample!,
                page: BdQuizPage.practice(const _SampleQuiz()), onDone: _done),
      );
}

class _SampleQuiz implements BdQuizPageInfo {
  const _SampleQuiz();

  @override
  String get name => 'Sample quiz';
  @override
  String get description =>
      'Bundled with the starter and graded on this device. Run with --dart-define=BD_QUIZ to take one of your practice quizzes.';
  @override
  double? get estimatedMinutes => 2;
  @override
  double? get timeLimitMinutes => 5;
}
