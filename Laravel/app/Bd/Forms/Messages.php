<?php

namespace App\Bd\Forms;

/**
 * What a visitor reads for a problem: the same wording as the web renderer
 * and the other native ports. Replace `FormController::$messages` to reword
 * or localize.
 */
final class Messages
{
    public static function message(string $reason, string $label, ?Field $field): string
    {
        $name = $label === '' ? 'This field' : $label;
        switch ($reason) {
            case 'required':
                if ($field?->type === 'boolean' && $field->mustBeTrue()) {
                    return 'Please confirm to continue.';
                }
                if ($field?->type === 'or_condition') {
                    return 'Fill in at least one side to continue.';
                }
                if ($field?->type === 'multi_populator') {
                    return 'Add at least one entry.';
                }

                return "{$name} is required.";
            case 'business_email':
                return 'Please use your work email address.';
            case 'regex':
                return "{$name} isn't in the expected format.";
            case 'options':
                return 'Choose one of the listed options.';
            case 'unknown_field':
                return "{$name} isn't part of this form.";
            case 'range_order':
                return 'The end must come after the start.';
            case 'range_same_day':
                return 'Choose an end date after the start date.';
            case 'format':
                return match ($field?->type) {
                    'email' => 'Enter a valid email address.',
                    'phone' => 'Enter a valid phone number.',
                    'url', 'image_input' => 'Enter a valid web address, like example.com.',
                    'address' => 'Enter a 5-digit ZIP code.',
                    'month_year' => 'Choose a month and a year.',
                    'color_picker' => 'Enter a hex color, like #3366FF.',
                    'schedule' => 'Choose a valid time.',
                    'number', 'measurement' => 'Enter a whole number.',
                    'currency' => $field->config('currencyConfig', 'allowDecimal') === false
                        ? 'Enter a whole amount.' : 'Enter an amount of 0 or more.',
                    default => "{$name} isn't valid.",
                };
            case 'min':
                $min = $field === null ? null
                    : (Json::num($field->config('validation', 'min')) ?? Json::num($field->config('sliderConfig', 'min')));

                return $min !== null ? 'Enter '.Js::numberString($min).' or more.' : 'Enter 0 or more.';
            case 'max':
                $max = $field === null ? null
                    : (Json::num($field->config('validation', 'max')) ?? Json::num($field->config('sliderConfig', 'max')));
                if ($max !== null) {
                    return 'Enter '.Js::numberString($max).' or less.';
                }
                if ($field?->type === 'file_upload') {
                    $n = (int) (Json::num($field->config('fileConfig', 'maxFiles')) ?? 1);

                    return "Attach at most {$n} file".($n === 1 ? '' : 's').'.';
                }
                if ($field?->type === 'star_rating') {
                    return 'Choose up to '.(int) (Json::num($field->config('starRatingConfig', 'maxStars')) ?? 5).' stars.';
                }

                return "{$name} is too long.";
            case 'type':
                return "{$name} has an invalid value.";
            default:
                // A repeater reports its child: "Age: max".
                $colon = strpos($reason, ':');
                if ($colon !== false) {
                    $inner = self::message(trim(substr($reason, $colon + 1), ' '), '', null);

                    return substr($reason, 0, $colon).': '.Js::lower($inner);
                }

                return "{$name} isn't valid.";
        }
    }
}
