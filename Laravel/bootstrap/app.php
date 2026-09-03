<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // The revalidate webhook is a server-to-server call authenticated by
        // HMAC over the raw body, not by session — there is no CSRF token to
        // present, and requiring one would reject every legitimate event.
        $middleware->validateCsrfTokens(except: [
            'api/bd/revalidate',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
