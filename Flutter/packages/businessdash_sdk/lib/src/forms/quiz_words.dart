// Every word a quiz shows: the TypeScript forms-core's `QUIZ_WORDS`, so a
// Dart quiz reads exactly like BD's hosted quiz page. Replace any to reword
// or localize. `{name}` placeholders are filled by [BdQuizWords.fill].
//
// Generated from the forms-core words (the quiz-parity fixture checks them).

/// Every word a quiz shows. Replace any to reword or localize.
class BdQuizWords {
  const BdQuizWords({
    this.empty = "This quiz has no questions yet.",
    this.readyTitle = "Ready to begin?",
    this.readyLimitOne = "You have 1 minute. The quiz submits automatically when time expires, and unanswered questions are marked incorrect.",
    this.readyLimitMany = "You have {minutes} minutes. The quiz submits automatically when time expires, and unanswered questions are marked incorrect.",
    this.readyElapsed = "The elapsed timer begins when you press Start. It does not impose a deadline.",
    this.start = "Start quiz",
    this.starting = "Starting…",
    this.timeRemaining = "Time remaining",
    this.elapsedTime = "Elapsed time",
    this.paused = "Paused",
    this.questionOf = "Question {number} of {total}",
    this.answeredOf = "{answered} of {total} answered",
    this.locksWhenChecked = "Answers lock when checked",
    this.endNotice = "Answers and rationale appear after the complete quiz is submitted.",
    this.endNoticeHidden = "Your answers are reviewed after you submit.",
    this.checkAnswer = "Check answer",
    this.lockAnswer = "Lock answer & check",
    this.checking = "Checking…",
    this.next = "Next",
    this.nextQuestion = "Next question",
    this.back = "Back",
    this.seeResults = "See results",
    this.finish = "Finish quiz",
    this.submit = "Submit quiz",
    this.submitting = "Submitting…",
    this.dontKnow = "I don't know",
    this.required = "{label} is required.",
    this.correct = "Correct",
    this.partiallyCorrect = "Partially correct",
    this.incorrect = "Incorrect",
    this.pendingAi = "AI review pending",
    this.unscored = "Not scored",
    this.accurate = "{percent}% accurate",
    this.yourAnswer = "Your answer",
    this.acceptedAnswer = "Accepted answer",
    this.why = "Why",
    this.whyAccepted = "Why the accepted answer is correct",
    this.whyOthers = "Why the other choices are wrong",
    this.noAnswer = "No answer",
    this.yes = "Yes",
    this.no = "No",
    this.resultsEyebrow = "Quiz results",
    this.provisional = "Provisional score · AI review is still pending",
    this.passed = "Passing score achieved",
    this.notPassed = "Passing score not achieved",
    this.tally = "{correct} / {total} correct",
    this.timeLimitReached = "Time limit reached",
    this.completed = "Completed",
    this.inDuration = "{label} in {duration}",
    this.messageExcellent = "Excellent. You know this material well.",
    this.messageSolid = "Solid. Review the ones you missed.",
    this.messageGettingThere = "Getting there. Review the ones you missed and try again.",
    this.messageKeepGoing = "Keep going. Study the material and try again.",
    this.retake = "Retake",
    this.submittedEyebrow = "Quiz submitted",
    this.submittedTitle = "Thanks — your responses are in.",
    this.submittedBody = "The team will review your answers and follow up with next steps.",
    this.lockedEyebrow = "Quiz complete",
    this.lockedTitle = "Your results are ready.",
    this.lockedBody = "Sign in — or create a free account with the email this invitation was sent to — to see how you did.",
    this.lockedAction = "Sign in to see your results",
    this.startFailed = "Couldn't start quiz.",
    this.lockFailed = "Couldn't lock answer.",
    this.submitFailed = "Couldn't submit quiz.",
    this.draftFailed = "Couldn't save quiz progress.",
    this.timedSubmitFailed = "Couldn't submit the timed quiz.",
    this.unscorable = "The answer could not be scored.",
    this.loading = "Loading your quiz…",
    this.loadFailed = "We couldn't load your quiz just now. Your progress is saved.",
    this.tryAgain = "Try again",
    this.invalid = "This quiz invitation isn't valid or has been withdrawn.",
    this.expired = "This quiz invitation has expired.",
    this.closed = "This quiz is not currently accepting responses.",
    this.signInTitle = "Sign in to begin",
    this.switchAccountTitle = "Different account required",
    this.accountBody = "This invitation must be completed by the account matching {email}.",
    this.signInAction = "Sign in to continue",
    this.switchAccountAction = "Sign out and switch account",
    this.eyebrow = "Competency quiz",
    this.practiceEyebrow = "Practice quiz",
    this.forRecipient = "For {name}",
    this.aboutMinutes = "About {minutes} minutes",
    this.minuteLimit = "{minutes} minute limit",
    this.authenticatedResponse = "Authenticated response",
    this.oneResponse = "One response per invitation",
    this.practiceNote = "Practice — nothing is recorded",
  });

  final String empty;
  final String readyTitle;
  final String readyLimitOne;
  final String readyLimitMany;
  final String readyElapsed;
  final String start;
  final String starting;
  final String timeRemaining;
  final String elapsedTime;
  final String paused;
  final String questionOf;
  final String answeredOf;
  final String locksWhenChecked;
  final String endNotice;
  final String endNoticeHidden;
  final String checkAnswer;
  final String lockAnswer;
  final String checking;
  final String next;
  final String nextQuestion;
  final String back;
  final String seeResults;
  final String finish;
  final String submit;
  final String submitting;
  final String dontKnow;
  final String required;
  final String correct;
  final String partiallyCorrect;
  final String incorrect;
  final String pendingAi;
  final String unscored;
  final String accurate;
  final String yourAnswer;
  final String acceptedAnswer;
  final String why;
  final String whyAccepted;
  final String whyOthers;
  final String noAnswer;
  final String yes;
  final String no;
  final String resultsEyebrow;
  final String provisional;
  final String passed;
  final String notPassed;
  final String tally;
  final String timeLimitReached;
  final String completed;
  final String inDuration;
  final String messageExcellent;
  final String messageSolid;
  final String messageGettingThere;
  final String messageKeepGoing;
  final String retake;
  final String submittedEyebrow;
  final String submittedTitle;
  final String submittedBody;
  final String lockedEyebrow;
  final String lockedTitle;
  final String lockedBody;
  final String lockedAction;
  final String startFailed;
  final String lockFailed;
  final String submitFailed;
  final String draftFailed;
  final String timedSubmitFailed;
  final String unscorable;
  final String loading;
  final String loadFailed;
  final String tryAgain;
  final String invalid;
  final String expired;
  final String closed;
  final String signInTitle;
  final String switchAccountTitle;
  final String accountBody;
  final String signInAction;
  final String switchAccountAction;
  final String eyebrow;
  final String practiceEyebrow;
  final String forRecipient;
  final String aboutMinutes;
  final String minuteLimit;
  final String authenticatedResponse;
  final String oneResponse;
  final String practiceNote;

  /// Every word by name, as the fixtures list them.
  Map<String, String> toMap() => {
        'empty': empty,
        'readyTitle': readyTitle,
        'readyLimitOne': readyLimitOne,
        'readyLimitMany': readyLimitMany,
        'readyElapsed': readyElapsed,
        'start': start,
        'starting': starting,
        'timeRemaining': timeRemaining,
        'elapsedTime': elapsedTime,
        'paused': paused,
        'questionOf': questionOf,
        'answeredOf': answeredOf,
        'locksWhenChecked': locksWhenChecked,
        'endNotice': endNotice,
        'endNoticeHidden': endNoticeHidden,
        'checkAnswer': checkAnswer,
        'lockAnswer': lockAnswer,
        'checking': checking,
        'next': next,
        'nextQuestion': nextQuestion,
        'back': back,
        'seeResults': seeResults,
        'finish': finish,
        'submit': submit,
        'submitting': submitting,
        'dontKnow': dontKnow,
        'required': required,
        'correct': correct,
        'partiallyCorrect': partiallyCorrect,
        'incorrect': incorrect,
        'pendingAi': pendingAi,
        'unscored': unscored,
        'accurate': accurate,
        'yourAnswer': yourAnswer,
        'acceptedAnswer': acceptedAnswer,
        'why': why,
        'whyAccepted': whyAccepted,
        'whyOthers': whyOthers,
        'noAnswer': noAnswer,
        'yes': yes,
        'no': no,
        'resultsEyebrow': resultsEyebrow,
        'provisional': provisional,
        'passed': passed,
        'notPassed': notPassed,
        'tally': tally,
        'timeLimitReached': timeLimitReached,
        'completed': completed,
        'inDuration': inDuration,
        'messageExcellent': messageExcellent,
        'messageSolid': messageSolid,
        'messageGettingThere': messageGettingThere,
        'messageKeepGoing': messageKeepGoing,
        'retake': retake,
        'submittedEyebrow': submittedEyebrow,
        'submittedTitle': submittedTitle,
        'submittedBody': submittedBody,
        'lockedEyebrow': lockedEyebrow,
        'lockedTitle': lockedTitle,
        'lockedBody': lockedBody,
        'lockedAction': lockedAction,
        'startFailed': startFailed,
        'lockFailed': lockFailed,
        'submitFailed': submitFailed,
        'draftFailed': draftFailed,
        'timedSubmitFailed': timedSubmitFailed,
        'unscorable': unscorable,
        'loading': loading,
        'loadFailed': loadFailed,
        'tryAgain': tryAgain,
        'invalid': invalid,
        'expired': expired,
        'closed': closed,
        'signInTitle': signInTitle,
        'switchAccountTitle': switchAccountTitle,
        'accountBody': accountBody,
        'signInAction': signInAction,
        'switchAccountAction': switchAccountAction,
        'eyebrow': eyebrow,
        'practiceEyebrow': practiceEyebrow,
        'forRecipient': forRecipient,
        'aboutMinutes': aboutMinutes,
        'minuteLimit': minuteLimit,
        'authenticatedResponse': authenticatedResponse,
        'oneResponse': oneResponse,
        'practiceNote': practiceNote,
      };

  static final _placeholder = RegExp(r'\{([a-zA-Z]+)\}');

  /// `{name}` placeholders filled from [values]; unknown ones stay as written.
  static String fill(String template, Map<String, String> values) =>
      template.replaceAllMapped(_placeholder, (m) => values[m.group(1)!] ?? m.group(0)!);
}
