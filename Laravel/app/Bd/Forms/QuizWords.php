<?php

namespace App\Bd\Forms;

/**
 * Every word a quiz shows, as BD's hosted quiz words them. Replace any to
 * reword or localize; `{name}` placeholders are filled in by `fill`.
 */
final class QuizWords
{
    public string $empty = 'This quiz has no questions yet.';

    public string $readyTitle = 'Ready to begin?';

    public string $readyLimitOne = 'You have 1 minute. The quiz submits automatically when time expires, and unanswered questions are marked incorrect.';

    public string $readyLimitMany = 'You have {minutes} minutes. The quiz submits automatically when time expires, and unanswered questions are marked incorrect.';

    public string $readyElapsed = 'The elapsed timer begins when you press Start. It does not impose a deadline.';

    public string $start = 'Start quiz';

    public string $starting = 'Starting…';

    public string $timeRemaining = 'Time remaining';

    public string $elapsedTime = 'Elapsed time';

    public string $paused = 'Paused';

    public string $questionOf = 'Question {number} of {total}';

    public string $answeredOf = '{answered} of {total} answered';

    public string $locksWhenChecked = 'Answers lock when checked';

    public string $endNotice = 'Answers and rationale appear after the complete quiz is submitted.';

    public string $endNoticeHidden = 'Your answers are reviewed after you submit.';

    public string $checkAnswer = 'Check answer';

    public string $lockAnswer = 'Lock answer & check';

    public string $checking = 'Checking…';

    public string $next = 'Next';

    public string $nextQuestion = 'Next question';

    public string $back = 'Back';

    public string $seeResults = 'See results';

    public string $finish = 'Finish quiz';

    public string $submit = 'Submit quiz';

    public string $submitting = 'Submitting…';

    public string $dontKnow = 'I don\'t know';

    public string $required = '{label} is required.';

    public string $correct = 'Correct';

    public string $partiallyCorrect = 'Partially correct';

    public string $incorrect = 'Incorrect';

    public string $pendingAi = 'AI review pending';

    public string $unscored = 'Not scored';

    public string $accurate = '{percent}% accurate';

    public string $yourAnswer = 'Your answer';

    public string $acceptedAnswer = 'Accepted answer';

    public string $why = 'Why';

    public string $whyAccepted = 'Why the accepted answer is correct';

    public string $whyOthers = 'Why the other choices are wrong';

    public string $noAnswer = 'No answer';

    public string $yes = 'Yes';

    public string $no = 'No';

    public string $resultsEyebrow = 'Quiz results';

    public string $provisional = 'Provisional score · AI review is still pending';

    public string $passed = 'Passing score achieved';

    public string $notPassed = 'Passing score not achieved';

    public string $tally = '{correct} / {total} correct';

    public string $timeLimitReached = 'Time limit reached';

    public string $completed = 'Completed';

    public string $inDuration = '{label} in {duration}';

    public string $messageExcellent = 'Excellent. You know this material well.';

    public string $messageSolid = 'Solid. Review the ones you missed.';

    public string $messageGettingThere = 'Getting there. Review the ones you missed and try again.';

    public string $messageKeepGoing = 'Keep going. Study the material and try again.';

    public string $retake = 'Retake';

    public string $submittedEyebrow = 'Quiz submitted';

    public string $submittedTitle = 'Thanks — your responses are in.';

    public string $submittedBody = 'The team will review your answers and follow up with next steps.';

    public string $lockedEyebrow = 'Quiz complete';

    public string $lockedTitle = 'Your results are ready.';

    public string $lockedBody = 'Sign in — or create a free account with the email this invitation was sent to — to see how you did.';

    public string $lockedAction = 'Sign in to see your results';

    public string $startFailed = 'Couldn\'t start quiz.';

    public string $lockFailed = 'Couldn\'t lock answer.';

    public string $submitFailed = 'Couldn\'t submit quiz.';

    public string $draftFailed = 'Couldn\'t save quiz progress.';

    public string $timedSubmitFailed = 'Couldn\'t submit the timed quiz.';

    public string $unscorable = 'The answer could not be scored.';

    public string $loading = 'Loading your quiz…';

    public string $loadFailed = 'We couldn\'t load your quiz just now. Your progress is saved.';

    public string $tryAgain = 'Try again';

    public string $invalid = 'This quiz invitation isn\'t valid or has been withdrawn.';

    public string $expired = 'This quiz invitation has expired.';

    public string $closed = 'This quiz is not currently accepting responses.';

    public string $signInTitle = 'Sign in to begin';

    public string $switchAccountTitle = 'Different account required';

    public string $accountBody = 'This invitation must be completed by the account matching {email}.';

    public string $signInAction = 'Sign in to continue';

    public string $switchAccountAction = 'Sign out and switch account';

    public string $eyebrow = 'Competency quiz';

    public string $practiceEyebrow = 'Practice quiz';

    public string $forRecipient = 'For {name}';

    public string $aboutMinutes = 'About {minutes} minutes';

    public string $minuteLimit = '{minutes} minute limit';

    public string $authenticatedResponse = 'Authenticated response';

    public string $oneResponse = 'One response per invitation';

    public string $practiceNote = 'Practice — nothing is recorded';

    /** `{name}` → its value; an unknown name stays as written. */
    public static function fill(string $template, array $values): string
    {
        return Js::fill($template, $values);
    }
}
