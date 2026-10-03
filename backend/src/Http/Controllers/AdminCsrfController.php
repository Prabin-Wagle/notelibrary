<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Auth\CsrfService;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminCsrfController
{
    /** @param array<string, mixed> $config */
    public function __construct(private readonly CsrfService $csrf, private readonly array $config)
    {
    }

    public function issue(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = $this->csrf->issue();
        $parts = [
            'nl_admin_csrf=' . rawurlencode($token),
            'Path=/api/v1/admin',
            'SameSite=' . $this->config['admin_session']['same_site'],
            'Max-Age=7200',
        ];
        if ($this->config['admin_session']['secure']) {
            $parts[] = 'Secure';
        }
        return JsonResponder::success($response->withAddedHeader('Set-Cookie', implode('; ', $parts)), ['csrf_token' => $token]);
    }
}
