<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Auth\AuthService;
use App\Auth\CsrfService;
use App\Auth\SessionRepository;
use App\Http\JsonResponder;
use App\Support\Validation;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AuthController
{
    /** @param array<string, mixed> $config */
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionRepository $sessions,
        private readonly CsrfService $csrf,
        private readonly array $config,
    ) {
    }

    public function csrf(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = $this->csrf->issue();
        return JsonResponder::success($response->withAddedHeader('Set-Cookie', $this->csrfCookie($token)), ['csrf_token' => $token]);
    }

    public function register(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $result = $this->auth->register($this->body($request), $request->getHeaderLine('User-Agent'), $this->ip($request));
        return JsonResponder::success(
            $response->withAddedHeader('Set-Cookie', $this->sessionCookie($result['token'])),
            ['user' => $result['user'], 'verification' => $result['verification'] ?? null],
            201,
        );
    }

    public function login(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $result = $this->auth->login($this->body($request), $request->getHeaderLine('User-Agent'), $this->ip($request));
        return JsonResponder::success(
            $response->withAddedHeader('Set-Cookie', $this->sessionCookie($result['token'])),
            ['user' => $result['user']],
        );
    }

    public function logout(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = $request->getCookieParams()[(string) $this->config['session']['cookie']] ?? '';
        if (is_string($token) && $token !== '') {
            $this->sessions->revokeByToken($token);
        }
        return JsonResponder::success(
            $response->withAddedHeader('Set-Cookie', $this->expiredSessionCookie()),
            ['message' => 'Signed out.'],
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
            'email_verified_at' => $auth['email_verified_at'],
        ]]);
    }

    public function forgotPassword(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $email = Validation::email($this->body($request));
        return JsonResponder::success($response, $this->auth->requestPasswordReset($email, $this->ip($request)));
    }

    public function resetPassword(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $this->auth->resetPassword($this->body($request));
        return JsonResponder::success($response, ['message' => 'Password updated. Sign in again.']);
    }

    public function requestEmailVerification(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $email = Validation::email($this->body($request));
        return JsonResponder::success($response, $this->auth->requestEmailVerification($email, $this->ip($request)));
    }

    public function confirmEmailVerification(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $this->auth->confirmEmailVerification($this->body($request));
        return JsonResponder::success($response, ['message' => 'Email verified.']);
    }

    /** @return array<string, mixed> */
    private function body(ServerRequestInterface $request): array
    {
        return is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
    }

    private function ip(ServerRequestInterface $request): string
    {
        $params = $request->getServerParams();
        return (string) ($params['REMOTE_ADDR'] ?? 'unknown');
    }

    private function sessionCookie(string $token): string
    {
        $parts = [
            rawurlencode((string) $this->config['session']['cookie']) . '=' . rawurlencode($token),
            'Path=/',
            'HttpOnly',
            'SameSite=' . $this->config['session']['same_site'],
            'Max-Age=' . ((int) $this->config['session']['absolute_hours'] * 3600),
        ];
        if ($this->config['session']['secure']) {
            $parts[] = 'Secure';
        }
        return implode('; ', $parts);
    }

    private function expiredSessionCookie(): string
    {
        return rawurlencode((string) $this->config['session']['cookie'])
            . '=; Path=/; HttpOnly; SameSite=' . $this->config['session']['same_site'] . '; Max-Age=0';
    }

    private function csrfCookie(string $token): string
    {
        $parts = [rawurlencode(CsrfService::COOKIE) . '=' . rawurlencode($token), 'Path=/', 'SameSite=Lax', 'Max-Age=7200'];
        if ($this->config['session']['secure']) {
            $parts[] = 'Secure';
        }
        return implode('; ', $parts);
    }
}
