<?php

namespace App\Bd\Forms;

/** Where a form or quiz comes from: BD with this server's secret key, or the bundled samples. */
final class Forms
{
    /** The sample quiz's slug: `/quiz/sample`, and `/quiz` until BD is connected. */
    public const SAMPLE_QUIZ = 'sample';

    /** BD's Package API, or the sample's stand-in; null for a BD form while BD isn't configured. */
    public static function backend(string $slug): ?Backend
    {
        return $slug === SampleBackend::SLUG ? new SampleBackend : PackageBackend::fromConfig();
    }

    public static function schema(string $slug): Schema
    {
        $backend = self::backend($slug) ?? throw new FormsError("BD isn't configured (BD_API_KEY / BD_SITE_ID).");

        return $backend->schema($slug);
    }

    /** The home page's contact form: BD_CONTACT_FORM once BD is connected, else the sample. */
    public static function contactSlug(): string
    {
        $slug = (string) config('bd.contact_form');

        return PackageBackend::fromConfig() !== null && $slug !== '' ? $slug : SampleBackend::SLUG;
    }

    /** The practice quiz /quiz shows: BD_QUIZ once BD is connected, else the sample. */
    public static function quizSlug(): string
    {
        $slug = (string) config('bd.quiz');

        return Quizzes::fromConfig() !== null && $slug !== '' ? $slug : self::SAMPLE_QUIZ;
    }
}
