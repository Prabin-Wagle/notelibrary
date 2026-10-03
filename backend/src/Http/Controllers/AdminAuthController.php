<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminAuthService;
use App\Auth\SessionRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminAuthController
{
    /** @param array<string, mixed> $config */
    public function __construct(
        private readonly AdminAuthService $auth,
        private readonly SessionRepository $sessions,
        private readonly array $config,
    ) {
    }

    public function login(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $server = $request->getServerParams();
        $result = $this->auth->login(
            $body,
            $request->getHeaderLine('User-Agent'),
            (string) ($server['REMOTE_ADDR'] ?? 'unknown'),
        );
        return JsonResponder::success(
            $response->withAddedHeader('Set-Cookie', $this->cookie($result['token'])),
            ['user' => $result['user']],
        );
    }

    public function me(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $auth = (array) $request->getAttribute('auth');
        return JsonResponder::success($response, ['user' => [
            'id' => (int) $auth['user_id'],
            'email' => $auth['email'],
            'username' => $auth['username'],
            'display_name' => $auth['display_name'],
            'role' => $auth['role'],
        ]]);
    }

    public function logout(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $name = (string) $this->config['admin_session']['cookie'];
        $token = $request->getCookieParams()[$name] ?? '';
        if (is_string($token) && $token !== '') {
            $this->sessions->revokeByToken($token);
        }
        $expired = rawurlencode($name) . '=; Path=/api/v1/admin; HttpOnly; SameSite='
            . $this->config['admin_session']['same_site'] . '; Max-Age=0';
        return JsonResponder::success(
            $response->withAddedHeader('Set-Cookie', $expired),
            ['message' => 'Signed out.'],
        );
    }

    private function cookie(string $token): string
    {
        $config = $this->config['admin_session'];
        $parts = [
            rawurlencode((string) $config['cookie']) . '=' . rawurlencode($token),
            'Path=/api/v1/admin',
            'HttpOnly',
            'SameSite=' . $config['same_site'],
            'Max-Age=' . ((int) $config['absolute_hours'] * 3600),
        ];
        if ($config['secure']) {
            $parts[] = 'Secure';
        }
        return implode('; ', $parts);
    }
}
