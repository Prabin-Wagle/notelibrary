<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Exceptions\ApiException;

final class Validation
{
    /** @param array<string, mixed> $body */
    public static function requiredString(array $body, string $field, int $min = 1, int $max = 255): string
    {
        $value = isset($body[$field]) && is_string($body[$field]) ? trim($body[$field]) : '';
        if (mb_strlen($value) < $min || mb_strlen($value) > $max) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                $field => ["Must contain between {$min} and {$max} characters."],
            ]);
        }
        return $value;
    }

    /** @param array<string, mixed> $body */
    public static function email(array $body): string
    {
        $email = mb_strtolower(self::requiredString($body, 'email', 3, 254));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                'email' => ['Enter a valid email address.'],
            ]);
        }
        return $email;
    }

    /** @param array<string, mixed> $body */
    public static function password(array $body, string $field = 'password'): string
    {
        $password = isset($body[$field]) && is_string($body[$field]) ? $body[$field] : '';
        if (strlen($password) < 8 || strlen($password) > 200) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                $field => ['Use between 8 and 200 characters.'],
            ]);
        }
        return $password;
    }
}
