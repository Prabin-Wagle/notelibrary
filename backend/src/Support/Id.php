<?php

declare(strict_types=1);

namespace App\Support;

final class Id
{
    public static function request(): string
    {
        return bin2hex(random_bytes(12));
    }

    public static function token(int $bytes = 32): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}
