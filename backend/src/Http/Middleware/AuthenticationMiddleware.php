<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Auth\SessionRepository;
use App\Domain\Exceptions\ApiException;
use DateTimeImmutable;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class AuthenticationMiddleware
{
    /** @param array<string, mixed> $sessionConfig */
    public function __construct(
        private readonly SessionRepository $sessions,
        private readonly array $sessionConfig,
        private readonly bool $required = true,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $token = $request->getCookieParams()[(string) $this->sessionConfig['cookie']] ?? null;
        $session = is_string($token) && $token !== '' ? $this->sessions->findActive($token) : null;

        if ($session !== null) {
            $lastUsed = new DateTimeImmutable((string) $session['last_used_at'], new \DateTimeZone('UTC'));
            $idleBoundary = new DateTimeImmutable('-' . (int) $this->sessionConfig['idle_minutes'] . ' minutes', new \DateTimeZone('UTC'));
            if ($lastUsed < $idleBoundary) {
                $this->sessions->revokeByToken($token);
                $session = null;
            } else {
                $this->sessions->touch((int) $session['session_id']);
            }
        }

        if ($this->required && $session === null) {
            throw new ApiException('AUTHENTICATION_REQUIRED', 'Sign in to continue.', 401);
        }

        return $handler->handle($request->withAttribute('auth', $session));
    }
}
