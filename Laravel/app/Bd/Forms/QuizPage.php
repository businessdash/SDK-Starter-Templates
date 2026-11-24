<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * The page around a quiz: a header (name, description, facts) and, when the
 * quiz can't be taken here and now, a gate in its place. Worded exactly as
 * BD's hosted `/quiz-invite` page (forms-core's `quizInvitationPage` /
 * `quizPracticePage`).
 *
 * A page is `['header' => ?{eyebrow, title, description, facts}, 'gate' =>
 * ?{kind, title, body, action: ?{id, label, href}}]`; a gate's kind is
 * invalid, expired, closed, signIn or switchAccount.
 */
final class QuizPage
{
    /** @return list<string> "About 10 minutes", "15 minute limit". */
    private static function minutesFacts(QuizWords $w, stdClass $page): array
    {
        $facts = [];
        $estimated = Json::num($page->estimatedMinutes ?? null);
        if ($estimated !== null && $estimated != 0) {
            $facts[] = QuizWords::fill($w->aboutMinutes, ['minutes' => Js::string($estimated)]);
        }
        $limit = Json::num($page->timeLimitMinutes ?? null);
        if ($limit !== null && $limit != 0) {
            $facts[] = QuizWords::fill($w->minuteLimit, ['minutes' => Js::string($limit)]);
        }

        return $facts;
    }

    private static function gate(string $kind, string $body): array
    {
        return ['header' => null, 'gate' => ['kind' => $kind, 'title' => null, 'body' => $body, 'action' => null]];
    }

    /** An invitation's page; null (BD found none) is the invalid gate. */
    public static function invitation(
        ?stdClass $invitation,
        QuizWords $w = new QuizWords,
        ?string $signInHref = null,
        ?string $switchAccountHref = null,
    ): array {
        if ($invitation === null) {
            return self::gate('invalid', $w->invalid);
        }
        if (($invitation->expired ?? null) === true) {
            return self::gate('expired', $w->expired);
        }
        if (($invitation->active ?? null) !== true && ($invitation->status ?? null) !== 'completed') {
            return self::gate('closed', $w->closed);
        }
        $facts = [];
        $recipient = Json::str($invitation->recipientName ?? null);
        if ($recipient !== null && $recipient !== '') {
            $facts[] = QuizWords::fill($w->forRecipient, ['name' => $recipient]);
        }
        $facts = [...$facts, ...self::minutesFacts($w, $invitation)];
        $facts[] = ($invitation->requireAuthentication ?? null) === true ? $w->authenticatedResponse : $w->oneResponse;
        $description = Json::str($invitation->description ?? null) ?? '';
        $header = [
            'eyebrow' => $w->eyebrow,
            'title' => Json::str($invitation->name ?? null) ?? '',
            'description' => $description === '' ? null : $description,
            'facts' => $facts,
        ];
        $status = $invitation->authenticationStatus ?? null;
        if ($status !== 'required' && $status !== 'mismatch') {
            return ['header' => $header, 'gate' => null];
        }
        $signIn = $status === 'required';

        return ['header' => $header, 'gate' => [
            'kind' => $signIn ? 'signIn' : 'switchAccount',
            'title' => $signIn ? $w->signInTitle : $w->switchAccountTitle,
            'body' => QuizWords::fill($w->accountBody, ['email' => Json::str($invitation->recipientEmailHint ?? null) ?? '']),
            'action' => [
                'id' => $signIn ? 'signIn' : 'switchAccount',
                'label' => $signIn ? $w->signInAction : $w->switchAccountAction,
                'href' => $signIn ? $signInHref : $switchAccountHref,
            ],
        ]];
    }

    public static function practice(stdClass $practice, QuizWords $w = new QuizWords): array
    {
        $description = Json::str($practice->description ?? null) ?? '';

        return ['header' => [
            'eyebrow' => $w->practiceEyebrow,
            'title' => Json::str($practice->name ?? null) ?? '',
            'description' => $description === '' ? null : $description,
            'facts' => [...self::minutesFacts($w, $practice), $w->practiceNote],
        ], 'gate' => null];
    }
}
