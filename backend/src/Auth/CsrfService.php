<?php

declare(strict_types=1);

namespace App\Auth;

use App\Domain\Exceptions\ApiException;
use App\Support\Id;

final class CsrfService
{
    public const COOKIE = 'nl_csrf';

    public function __construct(private readonly string $key)
    {
        if (strlen($this->key) < 32) {
            throw new \RuntimeException('APP_KEY must contain at least 32 characters.');
        }
    }

    public function issue(): string
    {
        $nonce = Id::token(24);
        return $nonce . '.' . hash_hmac('sha256', $nonce, $this->key);
    }

    public function assertValid(?string $cookieToken, ?string $headerToken): void
    {
        if ($cookieToken === null || $headerToken === null || !hash_equals($cookieToken, $headerToken)) {
            throw new ApiException('CSRF_TOKEN_INVALID', 'Refresh the page and try again.', 419);
        }

        [$nonce, $signature] = array_pad(explode('.', $headerToken, 2), 2, '');
        $expected = hash_hmac('sha256', $nonce, $this->key);
        if ($nonce === '' || !hash_equals($expected, $signature)) {
            throw new ApiException('CSRF_TOKEN_INVALID', 'Refresh the page and try again.', 419);
        }
    }
}
