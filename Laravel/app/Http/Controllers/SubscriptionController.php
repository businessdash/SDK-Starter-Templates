<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class SubscriptionController extends Controller
{
    public function index(): View
    {
        $plans = Bd::remember(
            'subscriptions:list',
            ['bd:subscriptions'],
            static fn (Client $c) => $c->subscriptions()->list(),
            default: ['items' => []],
        );

        return view('pages.subscriptions', [
            'plans' => $plans['items'] ?? [],
        ]);
    }

    public function checkout(string $id): RedirectResponse
    {
        $session = Bd::attempt(static fn (Client $c) => $c->subscriptions()->checkout($id, [
            'successUrl' => route('subscriptions').'?status=success',
            'cancelUrl' => route('subscriptions').'?status=cancelled',
        ]));

        $url = $session['stripeUrl'] ?? $session['url'] ?? null;
        if (! is_string($url)) {
            return back()->with('subscription_error', 'Could not start checkout.');
        }

        return redirect()->away($url, 303);
    }
}
