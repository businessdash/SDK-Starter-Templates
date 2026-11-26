// The page around a quiz: a header (name, description, facts) and, when the
// quiz can't be taken here and now, a gate in its place. The TypeScript
// forms-core's `quizInvitationPage` / `quizPracticePage`, so an app words
// these exactly as BD's hosted `/quiz-invite` page does.

import 'json.dart';
import 'quiz_words.dart';

/// What a quiz's page reads from a practice quiz or an invitation.
abstract interface class BdQuizPageInfo {
  String get name;
  String get description;
  double? get estimatedMinutes;
  double? get timeLimitMinutes;
}

/// What an invitation's page reads, beyond the basics.
abstract interface class BdQuizInvitationPageInfo implements BdQuizPageInfo {
  String? get recipientName;
  bool get requireAuthentication;

  /// `not_required`, `required`, `verified` or `mismatch`.
  String get authenticationStatus;
  String get recipientEmailHint;

  /// `pending`, `opened` or `completed`.
  String get status;
  bool get expired;
  bool get active;
}

class BdQuizPageHeader {
  const BdQuizPageHeader(
      {required this.eyebrow,
      required this.title,
      this.description,
      required this.facts});

  final String eyebrow;
  final String title;
  final String? description;
  final List<String> facts;

  Map<String, Object?> toJson() => {
        'eyebrow': eyebrow,
        'title': title,
        'description': description,
        'facts': facts
      };
}

enum BdQuizGateKind {
  invalid('invalid'),
  expired('expired'),
  closed('closed'),
  signIn('signIn'),
  switchAccount('switchAccount');

  const BdQuizGateKind(this.wire);
  final String wire;
}

class BdQuizGateAction {
  const BdQuizGateAction({required this.id, required this.label, this.href});

  /// [BdQuizGateKind.signIn] or [BdQuizGateKind.switchAccount].
  final BdQuizGateKind id;
  final String label;
  final String? href;

  Map<String, Object?> toJson() =>
      {'id': id.wire, 'label': label, 'href': href};
}

class BdQuizGate {
  const BdQuizGate(
      {required this.kind, this.title, required this.body, this.action});

  final BdQuizGateKind kind;
  final String? title;
  final String body;
  final BdQuizGateAction? action;

  Map<String, Object?> toJson() => {
        'kind': kind.wire,
        'title': title,
        'body': body,
        'action': action?.toJson()
      };
}

class BdQuizPage {
  const BdQuizPage({this.header, this.gate});

  final BdQuizPageHeader? header;

  /// Shown in place of the quiz. Null: show the quiz under the header.
  final BdQuizGate? gate;

  BdQuizPage withoutHeader() => BdQuizPage(gate: gate);

  Map<String, Object?> toJson() =>
      {'header': header?.toJson(), 'gate': gate?.toJson()};

  static List<String> _minutesFacts(BdQuizWords w, BdQuizPageInfo page) => [
        if (page.estimatedMinutes case final m? when m != 0)
          BdQuizWords.fill(w.aboutMinutes, {'minutes': BdJS.formatNumber(m)}),
        if (page.timeLimitMinutes case final m? when m != 0)
          BdQuizWords.fill(w.minuteLimit, {'minutes': BdJS.formatNumber(m)}),
      ];

  /// An invitation's page. Null is an invitation that doesn't exist (or
  /// isn't this org's). The hrefs are where the sign-in and switch-account
  /// buttons go; an app can leave them null and handle the action itself.
  static BdQuizPage invitation(
    BdQuizInvitationPageInfo? invitation, {
    BdQuizWords words = const BdQuizWords(),
    String? signInHref,
    String? switchAccountHref,
  }) {
    final w = words;
    BdQuizPage gate(BdQuizGateKind kind, String body) =>
        BdQuizPage(gate: BdQuizGate(kind: kind, body: body));
    if (invitation == null) return gate(BdQuizGateKind.invalid, w.invalid);
    if (invitation.expired) return gate(BdQuizGateKind.expired, w.expired);
    if (!invitation.active && invitation.status != 'completed') {
      return gate(BdQuizGateKind.closed, w.closed);
    }
    final facts = [
      if (invitation.recipientName case final name? when name.isNotEmpty)
        BdQuizWords.fill(w.forRecipient, {'name': name}),
      ..._minutesFacts(w, invitation),
      invitation.requireAuthentication
          ? w.authenticatedResponse
          : w.oneResponse,
    ];
    final header = BdQuizPageHeader(
      eyebrow: w.eyebrow,
      title: invitation.name,
      description:
          invitation.description.isEmpty ? null : invitation.description,
      facts: facts,
    );
    final status = invitation.authenticationStatus;
    if (status != 'required' && status != 'mismatch') {
      return BdQuizPage(header: header);
    }
    final signIn = status == 'required';
    final kind = signIn ? BdQuizGateKind.signIn : BdQuizGateKind.switchAccount;
    return BdQuizPage(
      header: header,
      gate: BdQuizGate(
        kind: kind,
        title: signIn ? w.signInTitle : w.switchAccountTitle,
        body: BdQuizWords.fill(
            w.accountBody, {'email': invitation.recipientEmailHint}),
        action: BdQuizGateAction(
          id: kind,
          label: signIn ? w.signInAction : w.switchAccountAction,
          href: signIn ? signInHref : switchAccountHref,
        ),
      ),
    );
  }

  /// A practice quiz's page.
  static BdQuizPage practice(BdQuizPageInfo practice,
          {BdQuizWords words = const BdQuizWords()}) =>
      BdQuizPage(
        header: BdQuizPageHeader(
          eyebrow: words.practiceEyebrow,
          title: practice.name,
          description:
              practice.description.isEmpty ? null : practice.description,
          facts: [..._minutesFacts(words, practice), words.practiceNote],
        ),
      );
}
